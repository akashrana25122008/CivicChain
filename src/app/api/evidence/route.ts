import { resolveProvider } from '@/lib/evidence/provider';
import type { IssueContext } from '@/lib/evidence/types';

export const runtime = 'nodejs';

/**
 * Evidence search endpoint.
 *
 * Runs the real search provider server-side. On each request it genuinely
 * queries a public, keyless image API for the location + issue, ranks the real
 * candidates, and returns structured results + evidence-based metrics. If no
 * verified same-location pair can be retrieved, `available` is false and the
 * client shows a genuine fallback — never fabricated images or scores.
 */
export async function POST(request: Request) {
  let body: Partial<IssueContext>;
  try {
    body = (await request.json()) as Partial<IssueContext>;
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body?.location || !body?.issueType) {
    return Response.json(
      { error: 'Both "location" and "issueType" are required' },
      { status: 422 },
    );
  }

  // Send a fresh request for each POST (no caching of evidence).
  const provider = resolveProvider();
  const context: IssueContext = {
    location: body.location,
    issueType: body.issueType,
    issueLabel: body.issueLabel,
    actionLabel: body.actionLabel,
    statusLabel: body.statusLabel,
    address: body.address,
    attempt: typeof body.attempt === 'number' ? body.attempt : 0,
  };

  const result = await provider.search(context);

  return Response.json({
    provider: provider.id,
    imagesAvailable: provider.imagesAvailable,
    context,
    result,
  });
}

export const dynamic = 'force-dynamic';
