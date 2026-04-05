import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { copyDir, exists, removeIfExists, upsertLine } from '../lib/fs.js';
import { confirm, intro, outro, spinner as clackSpinner } from '@clack/prompts';
import { unwrap } from '../lib/clack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_AGENT_DIR = path.join(PACKAGE_ROOT, 'templates', '.agent');
const PACKAGE_JSON_PATH = path.join(PACKAGE_ROOT, 'package.json');

async function detectRepoRoot(startDir) {
  let current = startDir;
  while (true) {
    if (await exists(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return startDir;
    current = parent;
  }
}

async function readPackageVersion() {
  const raw = await fs.readFile(PACKAGE_JSON_PATH, 'utf8');
  return JSON.parse(raw).version;
}

async function confirmUpgrade(nonInteractive, overwrite) {
  if (nonInteractive) return Boolean(overwrite);
  return unwrap(await confirm({ message: 'Upgrade managed .agent/ files?', initialValue: false }));
}

async function ensureRootImports(targetDir) {
  const justfilePath = path.join(targetDir, 'Justfile');
  const makefilePath = path.join(targetDir, 'Makefile');
  if (await exists(justfilePath)) {
    await upsertLine(justfilePath, 'import ".agent/Justfile"');
  }
  if (await exists(makefilePath)) {
    await upsertLine(makefilePath, 'include .agent/Makefile');
  }
}

export async function upgrade(args) {
  const targetDir = await detectRepoRoot(process.cwd());
  const agentDir = path.join(targetDir, '.agent');
  const envPath = path.join(agentDir, '.env');
  const manifestPath = path.join(agentDir, 'manifest.json');

  if (!(await exists(agentDir))) {
    throw new Error('No .agent/ directory found. Run bootstrap first.');
  }
  if (!(await exists(manifestPath))) {
    throw new Error('No .agent/manifest.json found. Cannot determine managed template version.');
  }

  if (!args.nonInteractive) intro('agent-env upgrade');

  const ok = await confirmUpgrade(args.nonInteractive, args.overwrite);
  if (!ok) {
    if (!args.nonInteractive) outro('Upgrade cancelled.');
    else throw new Error('Aborted upgrade. Re-run with --overwrite or confirm interactively.');
    process.exit(0);
  }

  const s = clackSpinner();
  if (!args.nonInteractive) s.start('Upgrading managed .agent/ files');

  const envRaw = (await exists(envPath)) ? await fs.readFile(envPath, 'utf8') : '';

  await removeIfExists(agentDir);
  await copyDir(TEMPLATE_AGENT_DIR, agentDir);
  if (envRaw) {
    await fs.writeFile(envPath, envRaw, 'utf8');
  }

  const packageVersion = await readPackageVersion();
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.packageVersion = packageVersion;
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  await ensureRootImports(targetDir);

  if (!args.nonInteractive) {
    s.stop('Done.');
    outro(`Upgraded managed .agent/ files in ${targetDir}\n  preserved .agent/.env`);
  } else {
    console.log(`Upgraded managed .agent/ files in ${targetDir}`);
    console.log('- preserved .agent/.env');
  }
}
