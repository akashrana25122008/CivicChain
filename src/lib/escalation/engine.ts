/**
 * Phase 7 — Automated escalation engine.
 *
 * Evaluates enabled escalation rules against an active Issue and, when a rule
 * fires, creates an Escalation record through a centralized, idempotent path:
 * an issue is never escalated to a level it has already reached, so repeated
 * evaluation cannot create duplicate escalations or send duplicate
 * notifications. Escalation is its own concept (level, not Issue.status) and
 * never bypasses the lifecycle state machine.
 *
 * In the Phase 5 queue architecture this engine is driven by the SLA/escalation
 * worker on a schedule. Until Redis/BullMQ is provisioned, it is exposed here as
 * a callable service so it can be triggered from relevant domain actions without
 * duplicating any rule logic in route handlers.
 */
import { prisma } from '@/lib/db';
import { recordAudit } from '@/lib/server/audit';
import { createNotification } from '@/lib/server/notify';
import { evaluateRule, type RuleSnapshot } from '@/lib/escalation/rules';
import { nextEscalationLevel, escalationLevelLabel } from '@/lib/escalation/levels';

export interface EscalationEvaluationResult {
  evaluated: boolean;
  createdEscalationId: string | null;
  level: number | null;
  fires: Array<{ ruleId: string; name: string; targetLevel: number; reasons: string[] }>;
}

/** Percentage (0-100) of the SLA window elapsed between createdAt and deadline. */
function slaElapsedPct(createdAt: Date, deadline: Date, now = new Date()): number {
  const total = deadline.getTime() - createdAt.getTime();
  if (total <= 0) return 100;
  const elapsed = Math.max(0, Math.min(total, now.getTime() - createdAt.getTime()));
  return (elapsed / total) * 100;
}

/**
 * Core evaluation. Synchronous + transactional escalation creation with audit
 * + notification. Returns what happened; throws only on unexpected DB failure.
 */
export async function evaluateEscalations(issueId: string): Promise<EscalationEvaluationResult> {
  const issue = await prisma.issue.findUnique({
    where: { id: issueId },
    select: {
      id: true,
      publicId: true,
      status: true,
      severity: true,
      priority: true,
      reporterId: true,
      authorityId: true,
      createdAt: true,
      promise: { select: { deadline: true, status: true } },
    },
  });
  if (!issue) return { evaluated: false, createdEscalationId: null, level: null, fires: [] };

  const currentLevel = await prisma.escalation.aggregate({
    where: { issueId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    _max: { level: true },
  });
  const level = currentLevel._max.level ?? 0;

  const snapshot: RuleSnapshot = {
    status: issue.status,
    severity: issue.severity,
    priority: issue.priority,
    level,
    slaPct: issue.promise?.deadline
      ? slaElapsedPct(issue.createdAt, issue.promise.deadline)
      : null,
  };

  const rules = await prisma.escalationRule.findMany({
    where: { enabled: true },
    orderBy: { priority: 'asc' },
  });

  const fires: EscalationEvaluationResult['fires'] = [];
  let escalationId: string | null = null;
  let targetLevel = nextEscalationLevel(level);

  for (const rule of rules) {
    const decision = evaluateRule(rule, snapshot);
    if (!decision.matches) continue;

    // Idempotency: never re-escalate if this rule's target level is already
    // reached or if there is a pending escalation at that level.
    const target = clampLevel(rule.targetLevel);
    if (target <= level) continue;
    const existing = await prisma.escalation.findFirst({
      where: { issueId, level: target, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true },
    });
    if (existing) continue;

    fires.push({ ruleId: rule.id, name: rule.name, targetLevel: target, reasons: decision.reasons });
    targetLevel = Math.max(target, targetLevel);
    break; // one escalation per evaluation run (highest-priority matching rule)
  }

  if (fires.length > 0) {
    const matched = fires[0];
    escalationId = await createEscalationForRule(issue, matched.ruleId, matched.targetLevel);
  }

  return { evaluated: true, createdEscalationId: escalationId, level, fires };
}

function clampLevel(level: number): number {
  if (level < 1) return 1;
  if (level > 4) return 4;
  return level;
}

async function createEscalationForRule(
  issue: {
    id: string;
    publicId: string;
    reporterId: string;
    authorityId: string | null;
  },
  ruleId: string,
  level: number,
): Promise<string> {
  const escalation = await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction to protect against concurrent runners.
    const dup = await tx.escalation.findFirst({
      where: { issueId: issue.id, level, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true },
    });
    if (dup) return dup;

    const created = await tx.escalation.create({
      data: {
        issueId: issue.id,
        authorityId: issue.authorityId,
        level,
        status: 'OPEN',
        reason: `Automatic escalation triggered by rule ${ruleId} to ${escalationLevelLabel(level)}.`,
      },
    });

    await recordAudit({
      tx,
      issueId: issue.id,
      action: 'ESCALATION_CREATED',
      entityType: 'Issue',
      entityId: issue.id,
      metadata: { escalationId: created.id, level, ruleId, automated: true },
    });

    if (issue.reporterId) {
      await createNotification({
        tx,
        userId: issue.reporterId,
        issueId: issue.id,
        type: 'ESCALATION_CREATED',
        title: `Report ${issue.publicId} was escalated (Level ${level})`,
        message: `Your report has been escalated to the ${escalationLevelLabel(level)}.`,
      });
    }

    return created;
  });

  return escalation.id;
}
