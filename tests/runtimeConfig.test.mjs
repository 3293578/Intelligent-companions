import test from 'node:test';
import assert from 'node:assert/strict';

import { assertProductionEnvironment, resolveServerHost } from '../src/runtimeConfig.js';

const validProduction = {
  NODE_ENV: 'production',
  APP_ORIGIN: 'https://staging.thewyth.com',
  SUPABASE_URL: 'https://project-ref.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_abcdefghijklmnopqrstuvwxyz',
  AUTH_RECOVERY_SECRET: 'a-secure-random-value-with-more-than-32-characters',
  DEEPSEEK_API_KEY: 'a-server-only-deepseek-key'
};

test('production listens on the managed host while local development stays loopback-only', () => {
  assert.equal(resolveServerHost({ NODE_ENV: 'production' }), '0.0.0.0');
  assert.equal(resolveServerHost({ NODE_ENV: 'development' }), '127.0.0.1');
  assert.equal(resolveServerHost({ NODE_ENV: 'production', HOST: '10.0.0.2' }), '10.0.0.2');
});

test('production environment accepts an HTTPS origin and server-only provider configuration', () => {
  assert.doesNotThrow(() => assertProductionEnvironment(validProduction));
  assert.doesNotThrow(() => assertProductionEnvironment({ NODE_ENV: 'development' }));
});

test('production refuses missing, placeholder, or insecure deployment values', () => {
  for (const patch of [
    { DEEPSEEK_API_KEY: '' },
    { AUTH_RECOVERY_SECRET: 'replace_with_a_long_random_value' },
    { APP_ORIGIN: 'http://staging.thewyth.com' },
    { SUPABASE_URL: '' },
    { SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_replace_me' }
  ]) {
    assert.throws(
      () => assertProductionEnvironment({ ...validProduction, ...patch }),
      /Invalid production environment:/
    );
  }
});

test('production requires a server-only Supabase secret when commerce enforcement is enabled', () => {
  assert.throws(
    () => assertProductionEnvironment({ ...validProduction, COMMERCE_REQUIRED: '1' }),
    /SUPABASE_SECRET_KEY/
  );
  assert.doesNotThrow(() => assertProductionEnvironment({
    ...validProduction,
    COMMERCE_REQUIRED: '1',
    SUPABASE_SECRET_KEY: ['sb', 'secret', 'server-only-test-value'].join('_')
  }));
});
