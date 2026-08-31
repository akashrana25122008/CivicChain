import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationChannel } from '../../../../generated/prisma/client';
import {
  resolveChannelPreferences,
  channelEnabled,
} from '../notify';

test('no preference rows → all channels enabled by default', () => {
  const prefs = resolveChannelPreferences([]);
  assert.equal(channelEnabled(prefs, NotificationChannel.IN_APP), true);
  assert.equal(channelEnabled(prefs, NotificationChannel.EMAIL), true);
  assert.equal(channelEnabled(prefs, NotificationChannel.PUSH), true);
});

test('explicitly disabled channel is off; others stay default-on', () => {
  const prefs = resolveChannelPreferences([
    { channel: NotificationChannel.EMAIL, enabled: false },
  ]);
  assert.equal(channelEnabled(prefs, NotificationChannel.EMAIL), false);
  assert.equal(channelEnabled(prefs, NotificationChannel.IN_APP), true);
  assert.equal(channelEnabled(prefs, NotificationChannel.PUSH), true);
});

test('explicitly enabled channel stays on even when others default', () => {
  const prefs = resolveChannelPreferences([
    { channel: NotificationChannel.PUSH, enabled: true },
  ]);
  assert.equal(channelEnabled(prefs, NotificationChannel.PUSH), true);
});

test('mixed set: EMAIL off, PUSH on, IN_APP default', () => {
  const prefs = resolveChannelPreferences([
    { channel: NotificationChannel.EMAIL, enabled: false },
    { channel: NotificationChannel.PUSH, enabled: true },
  ]);
  assert.equal(channelEnabled(prefs, NotificationChannel.EMAIL), false);
  assert.equal(channelEnabled(prefs, NotificationChannel.PUSH), true);
  assert.equal(channelEnabled(prefs, NotificationChannel.IN_APP), true);
});

test('resolveChannelPreferences marks explicitness', () => {
  const prefs = resolveChannelPreferences([
    { channel: NotificationChannel.EMAIL, enabled: true },
  ]);
  assert.equal(prefs.EMAIL.explicit, true);
  assert.equal(prefs.EMAIL.enabled, true);
  assert.equal(prefs.IN_APP.explicit, false);
  assert.equal(prefs.PUSH.explicit, false);
});
