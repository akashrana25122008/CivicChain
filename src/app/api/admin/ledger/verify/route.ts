import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/server/api';
import { requireRole } from '@/lib/server/session';
import { getLedgerVerification } from '@/lib/server/ledger';
import { notifyUser } from '@/lib/server/notify';
import { NotificationChannel, NotificationType, RoleApprovalStatus, UserRole } from '../../../../../../generated/prisma/client';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * ADMIN-only verification of the append-only trust ledger. Scans the full
 * chain, recomputes every hash and link, and reports exactly which records
 * are tampered / have broken predecessor links / have gaps.
 *
 * If the ledger is found invalid, every ADMIN is alerted via the Phase 13
 * notification dispatcher (in-app + email by preference) using a dedupeKey so
 * a retried poll can never spam admins.
 */
export async function GET() {
  try {
    await requireRole('ADMIN');
    const { verification, depth, tipAt } = await getLedgerVerification();

    if (!verification.valid) {
      const key = `ledger-invalid::${verification.firstInvalidSeq ?? 'unknown'}::${tipAt ?? 'never'}`;
      const admins = await prisma.user.findMany({
        where: { role: UserRole.ADMIN, roleStatus: 'APPROVED' },
        select: { id: true },
      });
      await Promise.all(
        admins.map((admin) =>
          notifyUser({
            userId: admin.id,
            type: NotificationType.GENERAL,
            title: 'Audit ledger integrity alert',
            message: `The audit trust ledger failed verification: ${verification.tampered} tampered row(s), ${verification.brokenLinks} broken link(s), ${verification.gaps} gap(s). First invalid seq ${verification.firstInvalidSeq ?? 'n/a'}.`,
            link: '/admin/audit',
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
            dedupeKey: key,
          }),
        ),
      );
    }

    return NextResponse.json({
      valid: verification.valid,
      depth,
      tipAt,
      summary: {
        count: verification.count,
        genesisOk: verification.genesisOk,
        tampered: verification.tampered,
        brokenLinks: verification.brokenLinks,
        gaps: verification.gaps,
        firstInvalidSeq: verification.firstInvalidSeq,
      },
      checks: verification.checks,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
