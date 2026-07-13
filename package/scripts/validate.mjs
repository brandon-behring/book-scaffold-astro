#!/usr/bin/env node
/**
 * Legacy `book-scaffold validate` CLI adapter.
 *
 * Validation itself lives in validate-core.mjs so QA and other package code
 * can call it in-process. This adapter alone owns process I/O, exit status,
 * and the historical child-process artifact self-heal behavior.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runValidation, VALIDATE_USAGE } from './validate-core.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(VALIDATE_USAGE);
  process.exit(0);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const regenerateArtifact = ({ scriptName, book, root, env }) => {
  const childArgs = [join(scriptDir, scriptName)];
  if (book) childArgs.push('--book', book);
  return spawnSync(process.execPath, childArgs, {
    cwd: root,
    env,
    encoding: 'utf8',
  });
};

const result = await runValidation({
  root: process.cwd(),
  argv,
  env: process.env,
  regenerateArtifact,
});

if (result.output.stdout) process.stdout.write(result.output.stdout);
if (result.output.stderr) process.stderr.write(result.output.stderr);
process.exit(result.exitCode);
