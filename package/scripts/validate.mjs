#!/usr/bin/env node
/**
 * Legacy `book-scaffold validate` CLI adapter.
 *
 * Validation itself lives in validate-core.mjs so QA and other package code
 * can call it in-process. This adapter alone owns process I/O, exit status,
 * and the historical child-process artifact self-heal behavior.
 */
import { runValidation, VALIDATE_USAGE } from './validate-core.mjs';
import { regenerateValidationArtifact } from './validation-artifacts.mjs';

const argv = process.argv.slice(2);
if (argv.includes('--help') || argv.includes('-h')) {
  process.stdout.write(VALIDATE_USAGE);
  process.exit(0);
}

const result = await runValidation({
  root: process.cwd(),
  argv,
  env: process.env,
  regenerateArtifact: regenerateValidationArtifact,
});

if (result.output.stdout) process.stdout.write(result.output.stdout);
if (result.output.stderr) process.stderr.write(result.output.stderr);
process.exit(result.exitCode);
