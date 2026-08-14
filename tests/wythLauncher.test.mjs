import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const launcherPath = path.join(root, 'scripts', 'start-wyth.ps1');
const commandPath = path.join(root, 'Start-Wyth.cmd');
const legacyLauncherPath = path.join(root, 'start.ps1');

test('desktop launcher starts one fixed-port server and waits for health before opening Wyth', () => {
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  assert.match(launcher, /\[int\]\$Port\s*=\s*53128/);
  assert.match(launcher, /api\/health/);
  assert.match(launcher, /server\.mjs/);
  assert.match(launcher, /--port/);
  assert.match(launcher, /WindowStyle Hidden/);
  assert.match(launcher, /wyth-launcher\.err\.log/);
  assert.match(launcher, /Start-Process\s+-FilePath\s+\$siteUrl/);
  assert.match(launcher, /if\s*\(Test-WythHealth/);
  assert.doesNotMatch(launcher, /cmd\.exe/);
});

test('double-click command resolves the launcher relative to the project', () => {
  const command = fs.readFileSync(commandPath, 'utf8');
  assert.match(command, /%~dp0scripts\\start-wyth\.ps1/i);
  assert.match(command, /powershell\.exe/i);
});

test('launcher starts the server directly so Windows does not terminate an intermediate wrapper', () => {
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  assert.match(launcher, /\$quotedServerPath\s*=\s*'"'/);
  assert.match(launcher, /ArgumentList\s+@\(\$quotedServerPath,\s*'--port'/);
  assert.doesNotMatch(launcher, /run-wyth-server\.mjs/);
});

test('all local start paths delegate to the one resilient fixed-port launcher', () => {
  const legacyLauncher = fs.readFileSync(legacyLauncherPath, 'utf8');
  assert.match(legacyLauncher, /scripts[\\/]start-wyth\.ps1/i);
  assert.doesNotMatch(legacyLauncher, /npm\s+run\s+dev/i);
  assert.doesNotMatch(legacyLauncher, /127\.0\.0\.1:5173/i);
});

test('launcher captures server output for later diagnostics', () => {
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  assert.match(launcher, /RedirectStandardOutput/);
  assert.match(launcher, /RedirectStandardError/);
  assert.match(launcher, /previous\.log/);
});

test('launcher detects a stale owned port before starting and never blindly kills another program', () => {
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  assert.match(launcher, /Get-WythPortOwner/);
  assert.match(launcher, /CommandLine/);
  assert.match(launcher, /Wyth port is occupied by another process/);
  assert.match(launcher, /Join-Path \$projectRoot 'server\.mjs'/);
});

test('launcher restarts a healthy server when runtime source files are newer than the process', () => {
  const launcher = fs.readFileSync(launcherPath, 'utf8');
  assert.match(launcher, /Get-WythHealth/);
  assert.match(launcher, /processId/);
  assert.match(launcher, /netstat\.exe/);
  assert.match(launcher, /Get-WythSourceLastWrite/);
  assert.match(launcher, /StartTime/);
  assert.match(launcher, /Stop-Process/);
  assert.match(launcher, /server\.mjs/);
  assert.match(launcher, /src/);
});
