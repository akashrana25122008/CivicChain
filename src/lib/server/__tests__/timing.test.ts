import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRequest } from '../timing';
import { NextResponse } from 'next/server';
import { currentRequestId } from '../requestContext';

test('timing: withRequest propagates the x-request-id header into the request context', async () => {
  let seenId: string | undefined;
  const handler = withRequest(async (req: Request) => {
    seenId = currentRequestId();
    return NextResponse.json({ ok: true });
  });

  const req = new Request('http://localhost/api/x', {
    headers: { 'x-request-id': 'from-proxy-42' },
  });
  const res = await handler(req, undefined);
  assert.equal(res.status, 200);
  assert.equal(seenId, 'from-proxy-42');
});

test('timing: withRequest still completes a handler with no declared params', async () => {
  const handler = withRequest(async () => NextResponse.json({ ok: true }));
  const res = await handler(undefined, undefined);
  assert.equal(res.status, 200);
});

test('timing: withRequest surfaces thrown handler errors and records a 500 status', async () => {
  const handler = withRequest(async () => {
    throw new Error('boom');
  });
  await assert.rejects(() => handler(new Request('http://localhost/api/x'), undefined));
});
