import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJs = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const i18nJs = readFileSync(new URL('../src/wythI18n.js', import.meta.url), 'utf8');
const serverJs = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
const accountSettings = appJs.slice(appJs.indexOf('function renderAccountSettings'), appJs.indexOf('function renderAuthForm'));

test('account settings expose free user-supplied model configuration', () => {
  assert.match(appJs, /createByokSession/);
  assert.match(accountSettings, /renderModelSettings\(\)/);
  assert.match(appJs, /modelSession\.fetch\('\/api\/model\/test'/);
  assert.doesNotMatch(accountSettings, /renderBillingSettings\(\)/);
});

test('chat and language tools share the same request-scoped model session', () => {
  for (const route of ['chat', 'translate', 'language-assist']) {
    assert.match(appJs, new RegExp(`modelSession\\.fetch\\('\\/api\\/${route}'`));
  }
  assert.match(serverJs, /parseModelConfiguration\(request\.headers\['x-wyth-model'\]\)/);
});

test('legacy payment and global model configuration endpoints are retired', () => {
  assert.match(serverJs, /pathname\.startsWith\('\/api\/billing\/'\)/);
  assert.match(serverJs, /error: 'feature_removed', mode: 'free_byok'/);
  assert.match(serverJs, /pathname\.startsWith\('\/api\/commerce\/'\)/);
  assert.match(serverJs, /requestUrl\.pathname === '\/api\/model'/);
  assert.doesNotMatch(serverJs, /createPaddleBillingClient|createCommerceRuntime|createModelConfigStore/);
});

test('copy clearly explains free BYOK behavior and volatile credential storage', () => {
  assert.match(i18nJs, /Wyth 完全免费且不提供模型/);
  assert.match(i18nJs, /only in this tab memory/);
  assert.match(i18nJs, /关闭、刷新或退出登录即清除/);
});
