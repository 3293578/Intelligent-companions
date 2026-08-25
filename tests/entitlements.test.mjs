import test from 'node:test';
import assert from 'node:assert/strict';

import { createTrialGrant, resolveCommercialAccess } from '../src/entitlements.js';

const NOW = '2026-08-25T10:00:00.000Z';

test('a trial begins only after the first successful hosted reply and lasts exactly 24 hours', () => {
  assert.equal(createTrialGrant({ userId: 'u1' }), null);
  assert.equal(createTrialGrant({ userId: 'u1', firstSuccessfulReplyAt: NOW, existingTrial: true }), null);

  assert.deepEqual(createTrialGrant({ userId: 'u1', firstSuccessfulReplyAt: NOW }), {
    userId: 'u1',
    kind: 'trial',
    startsAt: NOW,
    endsAt: '2026-08-26T10:00:00.000Z',
    sourceType: 'first_successful_ai_reply'
  });
});

test('active unlimited entitlement wins and is controlled by fair-use state', () => {
  const periods = [
    { kind: 'trial', startsAt: '2026-08-25T09:00:00Z', endsAt: '2026-08-26T09:00:00Z' },
    { kind: 'unlimited', startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' }
  ];
  assert.deepEqual(resolveCommercialAccess({ now: NOW, periods }), {
    allowed: true,
    plan: 'unlimited',
    reason: 'active_entitlement',
    expiresAt: '2026-09-01T00:00:00.000Z',
    allowanceUsd: null,
    usedUsd: 0,
    remainingUsd: null
  });
  assert.equal(resolveCommercialAccess({ now: NOW, periods, fairUseBlocked: true }).reason, 'fair_use_review');
  assert.equal(resolveCommercialAccess({ now: NOW, periods, fairUseBlocked: true }).allowed, false);
});

test('a verified active subscription grants access until its provider period ends', () => {
  const access = resolveCommercialAccess({
    now: NOW,
    subscription: {
      plan: 'standard',
      status: 'active',
      currentPeriodEnd: '2026-09-25T10:00:00Z'
    },
    usageUsd: 0.5
  });
  assert.equal(access.allowed, true);
  assert.equal(access.plan, 'standard');
  assert.equal(access.expiresAt, '2026-09-25T10:00:00.000Z');

  for (const status of ['past_due', 'paused', 'canceled']) {
    assert.equal(resolveCommercialAccess({
      now: NOW,
      subscription: { plan: 'unlimited', status, currentPeriodEnd: '2026-09-25T10:00:00Z' }
    }).allowed, false);
  }
});

test('standard, trial, and referral access share the configured allowance plus top-ups', () => {
  const periods = [
    { kind: 'referral', startsAt: '2026-08-24T00:00:00Z', endsAt: '2026-08-31T00:00:00Z' },
    { kind: 'top_up', startsAt: '2026-08-24T00:00:00Z', endsAt: '2026-08-31T00:00:00Z', creditUsd: 1.5 }
  ];
  const access = resolveCommercialAccess({
    now: NOW,
    periods,
    usageUsd: 4.25,
    standardAllowanceUsd: 4
  });
  assert.equal(access.allowed, true);
  assert.equal(access.plan, 'referral');
  assert.equal(access.allowanceUsd, 5.5);
  assert.equal(access.usedUsd, 4.25);
  assert.equal(access.remainingUsd, 1.25);
});

test('expired access and exhausted allowance fail closed with explicit reasons', () => {
  const expired = resolveCommercialAccess({
    now: NOW,
    periods: [{ kind: 'trial', startsAt: '2026-08-23T00:00:00Z', endsAt: '2026-08-24T00:00:00Z' }]
  });
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, 'not_entitled');

  const exhausted = resolveCommercialAccess({
    now: NOW,
    periods: [{ kind: 'standard', startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' }],
    usageUsd: 4,
    standardAllowanceUsd: 4
  });
  assert.equal(exhausted.allowed, false);
  assert.equal(exhausted.reason, 'allowance_exhausted');
  assert.equal(exhausted.remainingUsd, 0);
});

test('invalid or future periods never grant access', () => {
  const result = resolveCommercialAccess({
    now: NOW,
    periods: [
      { kind: 'standard', startsAt: '2026-08-26T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' },
      { kind: 'unlimited', startsAt: 'invalid', endsAt: '2026-09-01T00:00:00Z' },
      { kind: 'unknown', startsAt: '2026-08-01T00:00:00Z', endsAt: '2026-09-01T00:00:00Z' }
    ]
  });
  assert.equal(result.allowed, false);
});
