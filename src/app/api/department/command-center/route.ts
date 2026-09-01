import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { withRequest } from '@/lib/server/timing';
import { requireOwnAuthority } from '@/lib/server/dept';
import { getCommandCenter, type CommandCenterParams } from '@/lib/server/department/commandCenter';
import type { IssueCategory, IssueStatus, PriorityLevel, Severity } from '../../../../../generated/prisma/client';

const VALID_CATEGORIES = new Set<string>(['POTHOLE', 'DRAINAGE', 'STREETLIGHT', 'GARBAGE', 'INFRASTRUCTURE', 'WATER', 'OTHER']);
const VALID_STATUSES = new Set<string>(['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'REJECTED']);
const VALID_SEVERITY = new Set<string>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_SLA = new Set<string>(['ON_TRACK', 'AT_RISK', 'BREACHED', 'RESOLVED']);
const VALID_RISK = new Set<string>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const VALID_PRIORITY = new Set<string>(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/**
 * GET /api/department/command-center — Department Command Center data.
 *
 * Returns real KPIs, priority-ordered work queue, SLA performance, live map
 * markers, escalation monitor, and available filters — all strictly scoped
 * to the caller's own AUTHORITY record (RBAC enforced backend-side).
 *
 * Query params (all optional):
 *   category, status, severity, priorityLevel, ward, slaState, riskLevel,
 *   q, limit, includeClosed
 */
export const GET = withRequest(async (request: NextRequest) => {
  try {
    const user = await requireUser();
    const authority = await requireOwnAuthority(user);
    const sp = request.nextUrl.searchParams;

    const category = sp.get('category');
    const status = sp.get('status');
    const severity = sp.get('severity');
    const priorityLevel = sp.get('priorityLevel');
    const ward = sp.get('ward');
    const slaState = sp.get('slaState');
    const riskLevel = sp.get('riskLevel');
    const q = sp.get('q');
    const limit = sp.get('limit') ? Number(sp.get('limit')) : 50;
    const includeClosed = sp.get('includeClosed') === 'true';

    // Validate filter values — invalid values short-circuit to empty results
    // rather than leaking rows (consistent with Phase 1 query convention).
    const params: CommandCenterParams = {
      authorityId: authority.id,
      limit: Math.min(200, Math.max(1, limit)),
      includeClosed,
    };
    if (category && VALID_CATEGORIES.has(category)) params.category = category as IssueCategory;
    if (status && VALID_STATUSES.has(status)) params.status = status as IssueStatus;
    if (severity && VALID_SEVERITY.has(severity)) params.severity = severity as Severity;
    if (priorityLevel && VALID_PRIORITY.has(priorityLevel)) params.priorityLevel = priorityLevel as PriorityLevel;
    if (ward) params.ward = ward;
    if (slaState && VALID_SLA.has(slaState)) params.slaState = slaState as CommandCenterParams['slaState'];
    if (riskLevel && VALID_RISK.has(riskLevel)) params.riskLevel = riskLevel;
    if (q) params.q = q;

    const result = await getCommandCenter({
      ...params,
      authority: {
        name: authority.name,
        department: authority.department?.name ?? null,
        jurisdiction: authority.jurisdiction,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
});
