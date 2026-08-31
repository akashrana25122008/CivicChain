import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { handleApiError } from '@/lib/server/api';
import { CATEGORY_LABELS, toDisplayStatus } from '@/lib/issues/mapping';
import type { Issue } from '../../../../../generated/prisma/client';

/**
 * /api/map/public — public, anonymous snapshot of located civic reports for the
 * landing "Civic Intelligence Map". Returns only non-personal fields (publicId,
 * title, category, status, coordinates, timestamps) and aggregate counts. No
 * auth: this is deliberately the public marketing surface, bounded and read-only.
 */
export async function GET() {
  try {
    const issues = await prisma.issue.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      orderBy: { updatedAt: 'desc' },
      take: 200,
    });

    const located = issues.map((i: Issue) => ({
      id: i.id,
      publicId: i.publicId,
      title: i.title,
      category: i.category,
      categoryLabel: CATEGORY_LABELS[i.category] ?? i.category,
      status: i.status,
      displayStatus: toDisplayStatus(i.status),
      priority: i.priority,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
      latitude: i.latitude as number,
      longitude: i.longitude as number,
    }));

    let center: { lat: number; lng: number } | null = null;
    if (located.length > 0) {
      center = {
        lat: located.reduce((s, i) => s + i.latitude, 0) / located.length,
        lng: located.reduce((s, i) => s + i.longitude, 0) / located.length,
      };
    }

    const active = issues.filter((i) => i.status !== 'RESOLVED' && i.status !== 'REJECTED').length;

    const stats = {
      total: issues.length,
      located: located.length,
      active,
      resolved: issues.filter((i) => i.status === 'RESOLVED').length,
      rejected: issues.filter((i) => i.status === 'REJECTED').length,
      inProgress: issues.filter((i) => i.status === 'IN_PROGRESS' || i.status === 'ASSIGNED').length,
    };

    return NextResponse.json({ located, stats, center });
  } catch (error) {
    return handleApiError(error);
  }
}
