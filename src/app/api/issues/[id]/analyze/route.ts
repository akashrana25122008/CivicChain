import { NextRequest, NextResponse, after } from 'next/server';
import { requireUser } from '@/lib/server/session';
import { handleApiError } from '@/lib/server/api';
import { analyzeIssue } from '@/lib/issues/actions';
import { runReportIntelligence } from '@/lib/server/intelligence/pipeline';

export interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/issues/:id/analyze — trigger the existing AI/intelligence pipeline
 * for an issue. Do NOT recreate AI logic here: this schedules the real pipeline
 * (classification, severity, priority, duplicate signals) which persists its own
 * results. Heavy work is launched after the response via the existing
 * `after()`/resume-on-read mechanism (Phase 5 relocates it onto a real queue).
 */
export async function POST(_req: NextRequest, ctx: RouteContext) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const { analysisStatus } = await analyzeIssue({ issueId: id });

    if (analysisStatus !== 'COMPLETED') {
      after(() => runReportIntelligence(id).catch(() => undefined));
    }

    return NextResponse.json({ issueId: id, analysisStatus: 'PROCESSING' });
  } catch (error) {
    return handleApiError(error);
  }
}
