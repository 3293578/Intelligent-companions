import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const script = await readFile(new URL('../scripts/setup-wyth-cloud.ps1', import.meta.url), 'utf8');
const command = await readFile(new URL('../Setup-Wyth-Cloud.cmd', import.meta.url), 'utf8');
const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');

test('cloud setup keeps secrets in ignored local env and accepts only publishable Supabase keys', () => {
  assert.match(script, /\.env\.local/);
  assert.match(gitignore, /^\.env\.local$/m);
  assert.match(script, /\^sb_publishable_/);
  assert.match(script, /AUTH_RECOVERY_SECRET/);
  assert.match(script, /RandomNumberGenerator/);
  assert.match(script, /RandomNumberGenerator\]::Create\(\)/);
  assert.match(script, /\.GetBytes\(\$random\)/);
  assert.doesNotMatch(script, /RandomNumberGenerator\]::Fill/);
  assert.doesNotMatch(script, /SUPABASE_SECRET_KEY/);
});

test('cloud setup updates account values without deleting existing model configuration', () => {
  assert.match(script, /\$managedKeys/);
  assert.match(script, /\$preservedLines/);
  assert.match(script, /Get-Content\s+-LiteralPath\s+\$envPath/);
});

test('double-click cloud setup resolves its script relative to the project', () => {
  assert.match(command, /%~dp0scripts\\setup-wyth-cloud\.ps1/i);
  assert.match(command, /cd \/d "%~dp0"/i);
});
