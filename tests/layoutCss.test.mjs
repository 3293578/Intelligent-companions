import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function declarationsFor(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  assert.ok(match, `Missing CSS block for ${selector}`);
  return match[1];
}

test('desktop chat grid keeps the composer visible while messages scroll internally', () => {
  assert.match(declarationsFor('.app-shell'), /min-height:\s*0\s*;/);
  assert.match(declarationsFor('.chat-panel'), /min-height:\s*0\s*;/);
  assert.match(declarationsFor('.chat-panel'), /overflow:\s*hidden\s*;/);
  assert.match(declarationsFor('.message-list'), /min-height:\s*0\s*;/);
});

test('studio exposes a bounded backend memory clear action', () => {
  assert.match(appJs, /data-action="clear-memory"/);
  assert.match(appJs, /method:\s*'DELETE'/);
});

test('studio exposes latest companion emotion state', () => {
  assert.match(appJs, /function latestEmotionFor/);
  assert.match(appJs, /Care status/);
  assert.match(appJs, /Detected mood/);
});

test('creation form exposes English practice style controls', () => {
  assert.match(html, /name="correctionMode"/);
  assert.match(html, /name="correctionIntensity"/);
  assert.match(html, /name="replyLength"/);
  assert.match(html, /name="naturalPhrases"/);
  assert.match(appJs, /practiceStyle:\s*\{/);
  assert.match(appJs, /Practice style/);
});

test('chat source cards support saving Daily Picks for later', () => {
  assert.match(appJs, /data-action="\$\{escapeHtml\(item\.action\)\}"/);
  assert.match(appJs, /data-source-id/);
  assert.match(appJs, /function saveDailyPickFromAction/);
  assert.match(appJs, /Saved picks/);
});
