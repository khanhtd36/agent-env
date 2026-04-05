import fs from 'node:fs/promises';
import path from 'node:path';

export async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function copyDir(src, dest) {
  await fs.cp(src, dest, { recursive: true, force: true });
}

export async function removeIfExists(target) {
  if (await exists(target)) {
    await fs.rm(target, { recursive: true, force: true });
  }
}

export async function upsertLine(filePath, line) {
  const hasFile = await exists(filePath);
  const current = hasFile ? await fs.readFile(filePath, 'utf8') : '';
  const lines = current.split(/\r?\n/).filter(Boolean);
  if (!lines.includes(line)) lines.push(line);
  const next = `${lines.join('\n')}\n`;
  await fs.writeFile(filePath, next, 'utf8');
}

export function packageRootFrom(importMetaUrl) {
  return path.resolve(new URL('../..', importMetaUrl).pathname);
}
