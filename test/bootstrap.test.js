import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../bin/agent-env.js');

function run(args, cwd) {
  return execSync(`node "${CLI}" ${args}`, { cwd, encoding: 'utf8' });
}

async function tempRepo() {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-bootstrap-test-'));
  execSync('git init -q', { cwd: dir });
  return dir;
}

test('bootstrap: creates all expected files', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --project-name myapp --ports 3000:3000', dir);
    for (const f of [
      '.agent/.env', '.agent/CONTEXT.md', '.agent/manifest.json',
      '.agent/Dockerfile', '.agent/launch.sh', '.agent/doctor.sh',
      '.agent/Justfile', '.agent/Makefile',
      '.agent/scripts/app-up.sh', '.agent/shell/bashrc.append',
      'Justfile',
    ]) {
      assert.ok(
        await import('node:fs').then(m => m.existsSync(path.join(dir, f))),
        `missing: ${f}`,
      );
    }
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: .env contains correct project name and ports', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --project-name cool-app --ports 8080:8080,5432:5432', dir);
    const env = await readFile(path.join(dir, '.agent', '.env'), 'utf8');
    assert.ok(env.includes('AGENT_PROJECT_NAME=cool-app'));
    assert.ok(env.includes('AGENT_PROJECT_PORTS=8080:8080,5432:5432'));
    assert.ok(env.includes('AGENT_BROWSER_TEST_URL=http://agent-cool-app-dind:8080'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: defaults project name to folder name', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just', dir);
    const env = await readFile(path.join(dir, '.agent', '.env'), 'utf8');
    const expected = `AGENT_PROJECT_NAME=${path.basename(dir)}`;
    assert.ok(env.includes(expected), `expected "${expected}" in .env`);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: root Justfile gets import line', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --project-name t1', dir);
    const content = await readFile(path.join(dir, 'Justfile'), 'utf8');
    assert.ok(content.includes('import ".agent/Justfile"'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: root Makefile gets include line with --make', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --make --project-name t1', dir);
    const content = await readFile(path.join(dir, 'Makefile'), 'utf8');
    assert.ok(content.includes('include .agent/Makefile'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: --just --make produces both root files', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --make --project-name t1', dir);
    const j = await readFile(path.join(dir, 'Justfile'), 'utf8');
    const m = await readFile(path.join(dir, 'Makefile'), 'utf8');
    assert.ok(j.includes('import ".agent/Justfile"'));
    assert.ok(m.includes('include .agent/Makefile'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: --gitignore adds .agent/ to .gitignore', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --gitignore --project-name t1', dir);
    const content = await readFile(path.join(dir, '.gitignore'), 'utf8');
    assert.ok(content.includes('.agent/'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: fails with invalid ports', async () => {
  const dir = await tempRepo();
  try {
    assert.throws(
      () => run('bootstrap --non-interactive --just --project-name t1 --ports bad:port', dir),
      /invalid|Invalid/,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: fails when .agent/ exists without --overwrite', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --project-name t1', dir);
    assert.throws(
      () => run('bootstrap --non-interactive --just --project-name t1', dir),
      /already exists|overwrite/i,
    );
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: --overwrite succeeds when .agent/ exists', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --project-name t1', dir);
    run('bootstrap --non-interactive --just --overwrite --project-name t2', dir);
    const env = await readFile(path.join(dir, '.agent', '.env'), 'utf8');
    assert.ok(env.includes('AGENT_PROJECT_NAME=t2'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('bootstrap: manifest has correct package and templateVersion', async () => {
  const dir = await tempRepo();
  try {
    run('bootstrap --non-interactive --just --project-name t1', dir);
    const manifest = JSON.parse(await readFile(path.join(dir, '.agent', 'manifest.json'), 'utf8'));
    assert.equal(manifest.package, '@khanhtd36/agent-env');
    assert.equal(manifest.templateVersion, 1);
    assert.ok(typeof manifest.packageVersion === 'string');
    assert.ok(typeof manifest.generatedAt === 'string');
  } finally {
    await rm(dir, { recursive: true });
  }
});
