import { bootstrap } from './commands/bootstrap.js';
import { upgrade } from './commands/upgrade.js';

function printHelp() {
  console.log(`agent-env

Usage:
  agent-env bootstrap [options]
  agent-env upgrade [options]

Bootstrap options:
  --project-name <name>   Persist explicit AGENT_PROJECT_NAME
  --ports <csv>           Comma-separated host:container mappings, supports ranges
  --just                  Ensure root Justfile imports .agent/Justfile
  --make                  Ensure root Makefile includes .agent/Makefile
  --gitignore             Add .agent/ to .gitignore

Upgrade options:
  (no additional flags; upgrade preserves .env and updates all managed files)

Shared options:
  --non-interactive       Do not prompt; use flags and defaults
  --overwrite             Overwrite or replace without prompting
  -h, --help              Show help
`);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--project-name') args.projectName = argv[++i];
    else if (arg === '--ports') args.ports = argv[++i];
    else if (arg === '--just') args.just = true;
    else if (arg === '--make') args.make = true;
    else if (arg === '--gitignore') args.gitignore = true;
    else if (arg === '--non-interactive') args.nonInteractive = true;
    else if (arg === '--overwrite') args.overwrite = true;
    else if (arg === '-h' || arg === '--help') args.help = true;
    else args._.push(arg);
  }
  return args;
}

export async function runCli(argv) {
  const args = parseArgs(argv);
  if (args.help || args._.length === 0) {
    printHelp();
    return;
  }

  const [command] = args._;
  if (command === 'bootstrap') {
    await bootstrap(args);
    return;
  }
  if (command === 'upgrade') {
    await upgrade(args);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}
