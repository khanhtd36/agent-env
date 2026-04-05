import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { upsertLine, exists } from '../src/lib/fs.js';

test('upsertLine: creates file with line if missing', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-test-'));
  try {
    const file = path.join(dir, 'test.txt');
    await upsertLine(file, 'hello');
    assert.equal(await readFile(file, 'utf8'), 'hello\n');
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upsertLine: appends line if not present', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-test-'));
  try {
    const file = path.join(dir, 'test.txt');
    await writeFile(file, 'existing\n');
    await upsertLine(file, 'new');
    const content = await readFile(file, 'utf8');
    assert.ok(content.includes('existing'));
    assert.ok(content.includes('new'));
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('upsertLine: does not duplicate existing line', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-test-'));
  try {
    const file = path.join(dir, 'test.txt');
    await writeFile(file, 'import ".agent/Justfile"\n');
    await upsertLine(file, 'import ".agent/Justfile"');
    await upsertLine(file, 'import ".agent/Justfile"');
    const content = await readFile(file, 'utf8');
    const matches = content.split('\n').filter((l) => l === 'import ".agent/Justfile"');
    assert.equal(matches.length, 1);
  } finally {
    await rm(dir, { recursive: true });
  }
});

test('exists: returns true for existing path', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'agent-test-'));
  try {
    assert.equal(await exists(dir), true);
    assert.equal(await exists(path.join(dir, 'nope')), false);
  } finally {
    await rm(dir, { recursive: true });
  }
});
