import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/agent-env.js');

function run(args, cwd) {
  return execSync(`node "${CLI}" ${args}`, { cwd, encoding: 'utf8' });
}

async function bootstrapped() {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-upgrade-test-'));
  execSync('git init -q', { cwd: dir });
  run('bootstrap --non-interactive --just --project-name my-app --ports 3000:3000', dir);
  return dir;
}

test('upgrade: preserves .env content', async () => {
  const dir = await bootstrapped();
  try {
    const envPath = path.join(dir, '.agent', '.env');
    const original = await readFile(envPath, 'utf8');
    await writeFile(envPath, original + 'CUSTOM_VAR=kept\n');
    run('upgrade --non-interactive --overwrite', dir);
    const after = await readFile(envPath, 'utf8');
    assert.ok(after.includes('CUSTOM_VAR=kept'), 'custom .env var should be preserved');
    assert.ok(after.includes('AGENT_PROJECT_NAME=my-app'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upgrade: updates manifest packageVersion and generatedAt', async () => {
  const dir = await bootstrapped();
  try {
    const before = JSON.parse(await readFile(path.join(dir, '.agent', 'manifest.json'), 'utf8'));
    await new Promise((r) => setTimeout(r, 10));
    run('upgrade --non-interactive --overwrite', dir);
    const after = JSON.parse(await readFile(path.join(dir, '.agent', 'manifest.json'), 'utf8'));
    assert.ok(after.generatedAt >= before.generatedAt);
    assert.equal(after.package, '@khanhtd36/agent-env');
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upgrade: replaces managed files from template', async () => {
  const dir = await bootstrapped();
  try {
    const contextPath = path.join(dir, '.agent', 'CONTEXT.md');
    await writeFile(contextPath, 'tampered');
    run('upgrade --non-interactive --overwrite', dir);
    const after = await readFile(contextPath, 'utf8');
    assert.ok(after.includes('workspace container'), 'CONTEXT.md should be restored from template');
    assert.notEqual(after, 'tampered');
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upgrade: fails without existing .agent/', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-upgrade-test-'));
  try {
    execSync('git init -q', { cwd: dir });
    assert.throws(
      () => run('upgrade --non-interactive --overwrite', dir),
      /bootstrap first|No .agent/i,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upgrade: fails without manifest.json', async () => {
  const dir = await bootstrapped();
  try {
    await rm(path.join(dir, '.agent', 'manifest.json'));
    assert.throws(
      () => run('upgrade --non-interactive --overwrite', dir),
      /manifest/i,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upgrade: preserves existing root Justfile import', async () => {
  const dir = await bootstrapped();
  try {
    const jf = path.join(dir, 'Justfile');
    await writeFile(jf, 'my-custom-target:\n\techo hi\nimport ".agent/Justfile"\n');
    run('upgrade --non-interactive --overwrite', dir);
    const after = await readFile(jf, 'utf8');
    assert.ok(after.includes('my-custom-target'));
    assert.ok(after.includes('import ".agent/Justfile"'));
    const count = after.split('import ".agent/Justfile"').length - 1;
    assert.equal(count, 1, 'import line should not be duplicated');
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upgrade: does not create root Makefile if it did not exist', async () => {
  const dir = await bootstrapped();
  try {
    const makePath = path.join(dir, 'Makefile');
    try { await rm(makePath); } catch { /* didn't exist */ }
    run('upgrade --non-interactive --overwrite', dir);
    const fs = await import('node:fs');
    assert.equal(fs.existsSync(makePath), false, 'Makefile should not be created by upgrade');
  } finally {
    await rm(dir, { recursive: true });
  }
});
