import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migration = await readFile(new URL('../supabase/migrations/20260825102753_commercial_entitlement_foundation.sql', import.meta.url), 'utf8');
const serverFunctions = await readFile(new URL('../supabase/migrations/20260825103436_commercial_server_functions.sql', import.meta.url), 'utf8');

const clientOwnedTables = ['profiles', 'user_preferences', 'vocabulary_items'];
const serverOwnedTables = ['subscriptions', 'entitlement_periods', 'usage_events', 'webhook_events'];

test('every public commercial table enables row level security and denies anonymous access', () => {
  for (const table of [...clientOwnedTables, ...serverOwnedTables]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security;`));
    assert.match(migration, new RegExp(`revoke all on table public\\.${table} from anon;`));
  }
});

test('all user-visible policies bind rows to the authenticated user id', () => {
  for (const table of ['profiles', 'user_preferences', 'vocabulary_items', 'subscriptions', 'entitlement_periods', 'usage_events']) {
    const ownershipColumn = table === 'profiles' ? 'id' : 'user_id';
    assert.match(migration, new RegExp(`on public\\.${table}[\\s\\S]*?\\(\\(select auth\\.uid\\(\\)\\) = ${ownershipColumn}\\)`));
  }
});

test('billing, entitlement, usage, and webhook tables grant no authenticated writes', () => {
  for (const table of serverOwnedTables) {
    assert.doesNotMatch(migration, new RegExp(`grant [^;]*(?:insert|update|delete)[^;]*public\\.${table}`, 'i'));
  }
  assert.doesNotMatch(migration, /create policy webhook_events_/i);
});

test('usage and webhook ledgers are idempotent and contain no prompt or chat-content fields', () => {
  assert.match(migration, /unique index usage_events_request_unique_idx/);
  assert.match(migration, /unique index webhook_events_provider_event_unique_idx/);
  assert.doesNotMatch(migration, /\b(prompt|message_content|chat_content|api_key)\b/i);
});

test('trial and usage functions are server-only, invoker-rights, and idempotent', () => {
  assert.match(serverFunctions, /entitlement_periods_one_trial_per_user_idx/);
  assert.match(serverFunctions, /on conflict do nothing/);
  assert.doesNotMatch(serverFunctions, /security definer/i);
  for (const signature of [
    'grant_initial_trial\\(uuid, timestamptz\\)',
    'commercial_usage_total\\(uuid, timestamptz\\)'
  ]) {
    assert.match(serverFunctions, new RegExp(`revoke all on function public\\.${signature} from public, anon, authenticated;`));
    assert.match(serverFunctions, new RegExp(`grant execute on function public\\.${signature} to service_role;`));
  }
});
