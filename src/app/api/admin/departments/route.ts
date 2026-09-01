import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, badRequest, ApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { prisma } from '@/lib/db';
import { EscalationStatus, Prisma } from '../../../../../generated/prisma/client';

const ACTIVE = ['SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'ASSIGNED', 'IN_PROGRESS'];
const OPEN_ESCALATION: EscalationStatus[] = ['OPEN', 'IN_PROGRESS'];

/** ADMIN-only directory of authorities (departments) with live workload numbers. */
export async function GET() {
  try {
    await requireRole('ADMIN');

    const [authorities, issuesByStatus, escalationsByDept, promisesByDept, avgRows] =
      await Promise.all([
        prisma.authority.findMany({
          include: {
            user: { select: { name: true, email: true } },
            department: { select: { name: true } },
          },
        }),
        prisma.issue.groupBy({
          by: ['authorityId', 'status'],
          where: { authorityId: { not: null } },
          _count: { _all: true },
        }),
        prisma.escalation.groupBy({
          by: ['authorityId'],
          where: {
            authorityId: { not: null },
            status: { in: OPEN_ESCALATION },
          },
          _count: { _all: true },
        }),
        prisma.promise.groupBy({
          by: ['authorityId', 'status'],
          where: { authorityId: { not: null } },
          _count: { _all: true },
        }),
        prisma.$queryRaw<Array<{ authorityId: string; avg_minutes: number | null }>>(Prisma.sql`
          SELECT i."authorityId" AS "authorityId",
                 AVG(EXTRACT(EPOCH FROM (al."createdAt" - i."createdAt")) / 60)::float AS avg_minutes
          FROM "AuditEvent" al
          JOIN "Issue" i ON i.id = al."issueId"
          WHERE al.action = 'STATUS_CHANGED'
            AND al.metadata->>'to' = 'RESOLVED'
            AND i."authorityId" IS NOT NULL
          GROUP BY i."authorityId"
        `),
      ]);

    const escalationsMap = new Map(
      escalationsByDept.map((r) => [r.authorityId, (r._count as { _all: number })._all]),
    );
    const avgMap = new Map(avgRows.map((r) => [r.authorityId, r.avg_minutes]));

    const issuesByDept = new Map<string, { assigned: number; active: number; resolved: number; rejected: number }>();
    for (const row of issuesByStatus) {
      const id = row.authorityId as string;
      const bucket = issuesByDept.get(id) ?? { assigned: 0, active: 0, resolved: 0, rejected: 0 };
      bucket.assigned += row._count._all;
      if (ACTIVE.includes(row.status)) bucket.active += row._count._all;
      if (row.status === 'RESOLVED') bucket.resolved += row._count._all;
      if (row.status === 'REJECTED') bucket.rejected += row._count._all;
      issuesByDept.set(id, bucket);
    }

    const offsets = new Map<string, { active: number; broken: number }>();
    for (const row of promisesByDept) {
      const id = row.authorityId as string;
      const bucket = offsets.get(id) ?? { active: 0, broken: 0 };
      if (row.status === 'OPEN' || row.status === 'IN_PROGRESS') bucket.active += row._count._all;
      if (row.status === 'BROKEN') bucket.broken += row._count._all;
      offsets.set(id, bucket);
    }

    return NextResponse.json({
      authorities: authorities.map((a) => {
        const workload = issuesByDept.get(a.id) ?? { assigned: 0, active: 0, resolved: 0, rejected: 0 };
        const promises = offsets.get(a.id) ?? { active: 0, broken: 0 };
        const avg = avgMap.get(a.id);
        return {
          id: a.id,
          name: a.name,
          department: a.department?.name ?? null,
          jurisdiction: a.jurisdiction,
          email: a.email,
          operator: a.user ? a.user.name ?? a.user.email : null,
          assigned: workload.assigned,
          active: workload.active,
          resolved: workload.resolved,
          rejected: workload.rejected,
          escalationsOpen: escalationsMap.get(a.id) ?? 0,
          promisesActive: promises.active,
          promisesBroken: promises.broken,
          avgResolutionMinutes: avg == null ? null : Math.round(avg),
        };
      }),
      total: authorities.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/admin/departments — create a canonical Department, optionally with
 * a linked Authority (the department's operator face). Department names are
 * unique (they drive category→department routing in create.ts).
 */
export async function POST(request: NextRequest) {
  try {
    await requireRole('ADMIN');

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_INPUT', 'Request body must be JSON.');
    }

    const parseStr = (v: unknown, label: string): string | null =>
      typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;

    const name = parseStr(body.name, 'name');
    if (!name) throw badRequest('A department "name" is required.');
    if (name.length > 200) throw badRequest('Department name must be at most 200 characters.');

    const jurisdiction = parseStr(body.jurisdiction, 'jurisdiction');
    const authorityName = parseStr(body.authorityName, 'authorityName');
    const authorityEmail = parseStr(body.authorityEmail, 'authorityEmail');

    const existing = await prisma.department.findUnique({ where: { name }, select: { id: true } });
    if (existing) {
      throw new ApiError(409, 'DEPARTMENT_EXISTS', `A department named "${name}" already exists.`);
    }

    const created = await prisma.$transaction(async (tx) => {
      const department = await tx.department.create({
        data: { name, jurisdiction: jurisdiction ?? null },
      });
      const authority = authorityName
        ? await tx.authority.create({
            data: {
              name: authorityName,
              email: authorityEmail ?? null,
              jurisdiction: jurisdiction ?? null,
              departmentId: department.id,
            },
          })
        : null;
      return { department, authority };
    });

    return NextResponse.json(
      {
        department: {
          id: created.department.id,
          name: created.department.name,
          jurisdiction: created.department.jurisdiction,
        },
        authority: created.authority
          ? { id: created.authority.id, name: created.authority.name, email: created.authority.email }
          : null,
      },
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}