import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  intro,
  outro,
  text,
  select,
  confirm,
  spinner as clackSpinner,
} from '@clack/prompts';
import { copyDir, ensureDir, exists, removeIfExists, upsertLine } from '../lib/fs.js';
import { unwrap } from '../lib/clack.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(__dirname, '../..');
const TEMPLATE_AGENT_DIR = path.join(PACKAGE_ROOT, 'templates', '.agent');
const PACKAGE_JSON_PATH = path.join(PACKAGE_ROOT, 'package.json');

function sanitizeProjectName(input) {
  return String(input || '')
    .trim()
    .replace(/[^a-zA-Z0-9_\-\.]/g, '-')
    .replace(/^-+|-+$/g, '') || '';
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'agent-project';
}

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

function defaultBrowserUrl(projectName, portsCsv) {
  const first = String(portsCsv || '').split(',').map((s) => s.trim()).filter(Boolean)[0];
  if (!first) return '';
  const hostPortSpec = first.split(':')[0];
  if (!hostPortSpec) return '';
  const hostPort = hostPortSpec.split('-')[0];
  if (!hostPort) return '';
  return `http://agent-${slugify(projectName)}-dind:${hostPort}`;
}

function renderEnv({ projectName, ports }) {
  const browserUrl = defaultBrowserUrl(projectName, ports);
  return [
    `AGENT_PROJECT_NAME=${projectName}`,
    'AGENT_IMAGE_NAME=agent-workspace:latest',
    'AGENT_DIND_IMAGE_NAME=agent-dind:latest',
    'AGENT_SYNC_SECRETS_MODE=overwrite',
    `AGENT_PROJECT_PORTS=${ports}`,
    "AGENT_APP_UP_CMD='docker compose up --build -d'",
    "AGENT_APP_DOWN_CMD='docker compose down'",
    "AGENT_APP_LOGS_CMD='docker compose logs -f'",
    "AGENT_APP_STATUS_CMD='docker compose ps'",
    `AGENT_BROWSER_TEST_URL=${browserUrl}`,
    '',
  ].join('\n');
}

async function updateManifest(agentDir, packageVersion) {
  const manifestPath = path.join(agentDir, 'manifest.json');
  const raw = await fs.readFile(manifestPath, 'utf8');
  const manifest = JSON.parse(raw);
  manifest.packageVersion = packageVersion;
  manifest.generatedAt = new Date().toISOString();
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function ensureRootIntegration(targetDir, mode) {
  if (mode === 'just' || mode === 'both') {
    await upsertLine(path.join(targetDir, 'Justfile'), 'import ".agent/Justfile"');
  }
  if (mode === 'make' || mode === 'both') {
    await upsertLine(path.join(targetDir, 'Makefile'), 'include .agent/Makefile');
  }
}

function validatePortSpec(item, side, value) {
  const parts = String(value).split('-');
  if (parts.length === 1) {
    const port = Number(parts[0]);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return `"${item}" has invalid ${side} port: ${value}`;
    }
    return null;
  }

  if (parts.length === 2) {
    const [startRaw, endRaw] = parts;
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (!Number.isInteger(start) || start < 1 || start > 65535) {
      return `"${item}" has invalid ${side} port range start: ${startRaw}`;
    }
    if (!Number.isInteger(end) || end < 1 || end > 65535) {
      return `"${item}" has invalid ${side} port range end: ${endRaw}`;
    }
    if (start > end) {
      return `"${item}" has invalid ${side} port range: ${value}`;
    }
    return null;
  }

  return `"${item}" has invalid ${side} port spec: ${value}`;
}

function validatePorts(portsCsv) {
  if (!portsCsv) return [];
  const errors = [];
  for (const item of portsCsv.split(',').map((s) => s.trim()).filter(Boolean)) {
    const parts = item.split(':');
    if (parts.length !== 2) { errors.push(`"${item}" is not host:container format`); continue; }
    const [host, container] = parts;
    const hostError = validatePortSpec(item, 'host', host);
    const containerError = validatePortSpec(item, 'container', container);
    if (hostError) errors.push(hostError);
    if (containerError) errors.push(containerError);
  }
  return errors;
}

function detectMode(args) {
  if (args.just && args.make) return 'both';
  if (args.just) return 'just';
  if (args.make) return 'make';
  return null;
}

async function askQuestionsInteractive({ defaults, agentExists }) {
  const projectName = sanitizeProjectName(
    unwrap(await text({
      message: 'Project name',
      placeholder: defaults.projectName,
      defaultValue: defaults.projectName,
      validate: (v) => {
        const s = sanitizeProjectName(v || defaults.projectName);
        if (!s) return 'Project name must not be empty.';
      },
    })) || defaults.projectName,
  );

  const ports = unwrap(await text({
    message: 'Published ports (comma-separated host:container, blank for none)',
    placeholder: defaults.ports || 'e.g. 15173:15173,18080:18080,3000-20000:3000-20000',
    defaultValue: defaults.ports,
    validate: (v) => {
      const errors = validatePorts((v || defaults.ports || '').trim());
      if (errors.length > 0) return errors.join('; ');
    },
  })) || defaults.ports;

  const mode = unwrap(await select({
    message: 'Root command integration',
    options: [
      { value: 'just', label: 'Just', hint: 'Adds Justfile with import ".agent/Justfile"' },
      { value: 'make', label: 'Make', hint: 'Adds Makefile with include .agent/Makefile' },
      { value: 'both', label: 'Both', hint: 'Adds both Justfile and Makefile' },
      { value: 'neither', label: 'Neither', hint: 'Skip root file integration' },
    ],
    initialValue: defaults.mode || 'just',
  }));

  const overwrite = agentExists
    ? unwrap(await confirm({ message: 'Overwrite existing .agent/?', initialValue: false }))
    : false;

  return { projectName, ports: (ports || '').trim(), mode, overwrite };
}

export async function bootstrap(args) {
  const startDir = process.cwd();
  const targetDir = await detectRepoRoot(startDir);
  const agentDir = path.join(targetDir, '.agent');
  const packageVersion = await readPackageVersion();
  const agentExists = await exists(agentDir);

  const folderName = sanitizeProjectName(path.basename(targetDir)) || path.basename(targetDir);
  const defaults = {
    projectName: sanitizeProjectName(args.projectName || folderName) || folderName,
    ports: String(args.ports || ''),
    mode: detectMode(args),
  };

  let answers;
  if (args.nonInteractive) {
    const portErrors = validatePorts(defaults.ports);
    if (portErrors.length > 0) throw new Error(`Invalid ports:\n  ${portErrors.join('\n  ')}`);
    if (!defaults.projectName) throw new Error('Project name must not be empty.');
    if (agentExists && !args.overwrite)
      throw new Error('Aborted: .agent/ already exists. Re-run with --overwrite.');
    answers = {
      projectName: defaults.projectName,
      ports: defaults.ports,
      mode: defaults.mode || 'just',
      overwrite: Boolean(args.overwrite),
    };
  } else {
    intro('agent-env bootstrap');
    answers = await askQuestionsInteractive({ defaults, agentExists });
    if (agentExists && !answers.overwrite) {
      outro('Aborted: .agent/ exists and overwrite was declined.');
      process.exit(0);
    }
  }

  const portErrors = validatePorts(answers.ports);
  if (portErrors.length > 0) throw new Error(`Invalid ports:\n  ${portErrors.join('\n  ')}`);
  if (!answers.projectName) throw new Error('Project name must not be empty.');

  const s = clackSpinner();
  if (!args.nonInteractive) s.start('Generating .agent/');

  await removeIfExists(agentDir);
  await ensureDir(targetDir);
  await copyDir(TEMPLATE_AGENT_DIR, agentDir);
  await fs.writeFile(path.join(agentDir, '.env'), renderEnv(answers), 'utf8');
  await updateManifest(agentDir, packageVersion);
  await ensureRootIntegration(targetDir, answers.mode);

  if (args.gitignore) {
    await upsertLine(path.join(targetDir, '.gitignore'), '.agent/');
  }

  if (!args.nonInteractive) {
    s.stop('Done.');
    outro([
      `Bootstrapped .agent/ in ${targetDir}`,
      `  project : ${answers.projectName}`,
      `  ports   : ${answers.ports || '<none>'}`,
      `  root    : ${answers.mode}`,
      ...(args.gitignore ? ['  gitignore: .agent/ added'] : []),
      '',
      'Next steps:',
      '  just agent-build',
      '  just agent-doctor',
      '  just agent-up',
    ].join('\n'));
  } else {
    console.log(`Bootstrapped .agent/ in ${targetDir}`);
    console.log(`- project name: ${answers.projectName}`);
    console.log(`- ports: ${answers.ports || '<none>'}`);
    console.log(`- root integration: ${answers.mode}`);
    if (args.gitignore) console.log('- added .agent/ to .gitignore');
    console.log('Next steps:\n  just agent-build\n  just agent-doctor\n  just agent-up');
  }
}
