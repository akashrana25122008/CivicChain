import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runWithContext, getRequestContext, currentRequestId } from '../requestContext';
import { requestLogger } from '../logger';

test('requestContext: runWithContext propagates the same requestId down async calls', async () => {
  const requestId = 'req-abc-123';
  const logger = requestLogger(requestId);

  const inner = async () => {
    const ctx = getRequestContext();
    return {
      id: currentRequestId(),
      sameLogger: ctx?.logger === logger,
      loggerId: ctx?.logger?.bindings?.().requestId,
    };
  };

  const result = await runWithContext({ requestId, logger, startedAt: 1, ip: '127.0.0.1' }, inner);
  assert.equal(result.id, requestId);
  assert.equal(result.sameLogger, true);
  assert.equal(result.loggerId, requestId);
});

test('requestContext: no context outside runWithContext', () => {
  assert.equal(getRequestContext(), undefined);
  assert.equal(currentRequestId(), undefined);
});

test('requestContext: nested runWithContext overrides the store for the inner scope', async () => {
  const outer = await runWithContext(
    { requestId: 'outer', logger: requestLogger('outer'), startedAt: 1, ip: 'x' },
    async () => {
      const inner = await runWithContext(
        { requestId: 'inner', logger: requestLogger('inner'), startedAt: 2, ip: 'y' },
        () => currentRequestId(),
      );
      const after = currentRequestId();
      return { inner, after };
    },
  );
  assert.equal(outer.inner, 'inner');
  assert.equal(outer.after, 'outer');
});
