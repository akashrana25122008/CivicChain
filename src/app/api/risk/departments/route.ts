import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { prisma } from '@/lib/db';

/**
 * GET /api/risk/departments — departments that currently have issues.
 *
 * Powers the risk dashboard's department filter. Citizen-safe: only the
 * canonical department id + name are returned, no workload internals.
 */
export async function GET() {
  try {
    await requireUser();

    const departments = await prisma.department.findMany({
      select: { id: true, name: true },
      where: { issues: { some: {} } },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ departments });
  } catch (error) {
    return handleApiError(error);
  }
}