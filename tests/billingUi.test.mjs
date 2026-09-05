import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJs = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const i18nJs = readFileSync(new URL('../src/wythI18n.js', import.meta.url), 'utf8');
const serverJs = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');

test('account settings expose server-backed billing status and checkout actions', () => {
  assert.match(appJs, /authUiState\.state === 'authenticated'[\s\S]*renderBillingSettings\(\)/);
  assert.match(appJs, /fetch\('\/api\/commerce\/status'/);
  assert.match(appJs, /fetch\('\/api\/billing\/checkout'/);
  assert.match(appJs, /data-action="billing-checkout"/);
  assert.match(appJs, /data-plan="standard"/);
  assert.match(appJs, /data-plan="unlimited"/);
});

test('billing status refresh never blocks authentication completion', () => {
  assert.match(appJs, /payload\.state === 'authenticated'\) void refreshCommerceStatus/);
  assert.doesNotMatch(appJs, /payload\.state === 'authenticated'\) await refreshCommerceStatus/);
});

test('checkout UI accepts server-owned plans and opens only server-created transactions', () => {
  assert.match(appJs, /BILLING_PLANS\s*=\s*Object\.freeze\(\['standard', 'unlimited'\]\)/);
  assert.match(appJs, /BILLING_PLANS\.includes\(plan\)/);
  assert.match(appJs, /paddleCheckout\.open\(/);
  assert.match(appJs, /transactionId:\s*payload\.transactionId/);
  assert.doesNotMatch(appJs, /window\.location\.assign\(checkoutUrl/);
  assert.doesNotMatch(appJs, /priceId\s*:/);
});

test('commerce status reports Paddle.js client configuration only when billing is complete', () => {
  assert.match(serverJs, /billingConfigured:\s*hostedBillingConfigured/);
  assert.match(serverJs, /paddle:\s*paddleClientConfig/);
});

test('billing copy discloses trial, recurring prices, and fair use', () => {
  for (const key of [
    'billing.title',
    'billing.trial',
    'billing.standard.title',
    'billing.unlimited.title',
    'billing.unlimited.fairUse',
    'billing.notConfigured',
    'billing.error.onboardingIncomplete'
  ]) {
    assert.match(i18nJs, new RegExp(`\\['${key}'`));
  }
  assert.match(i18nJs, /\['billing\.standard\.title', 'Standard · \$5\/月', 'Standard · \$5\/month'\]/);
  assert.match(i18nJs, /\['billing\.standard\.description', '[^']*2 美元[^']*', 'Includes about \$2 of monthly model usage\./);
  assert.match(i18nJs, /\['billing\.unlimited\.title', 'Unlimited · \$10\/月', 'Unlimited · \$10\/month'\]/);
});
