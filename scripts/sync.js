#!/usr/bin/env node
/**
 * Sync templates/.agent/ → demo-fullstack/.agent/
 *
 * Source of truth: templates/.agent/
 * Run after editing any file under templates/.agent/
 *
 * Preserves:
 *   - demo-fullstack/.agent/.env  (per-repo local config)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'templates', '.agent');
const TARGETS = [
  { dest: path.join(ROOT, 'demo-fullstack', '.agent'), preserveEnv: true },
];

async function exists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function syncTarget({ dest, preserveEnv }) {
  let savedEnv = null;
  const envPath = path.join(dest, '.env');

  if (preserveEnv && await exists(envPath)) {
    savedEnv = await fs.readFile(envPath, 'utf8');
  }

  await fs.rm(dest, { recursive: true, force: true });
  await fs.cp(SRC, dest, { recursive: true });

  if (savedEnv !== null) {
    await fs.writeFile(envPath, savedEnv, 'utf8');
    console.log(`  preserved ${path.relative(ROOT, envPath)}`);
  }

  console.log(`  synced → ${path.relative(ROOT, dest)}/`);
}

console.log(`syncing from templates/.agent/ ...`);
for (const target of TARGETS) {
  await syncTarget(target);
}
console.log('done.');
