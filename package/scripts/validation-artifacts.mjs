/**
 * Shared generated-artifact regeneration adapter for validation callers.
 *
 * The validation core remains process-independent. CLI adapters inject this
 * callback when they want the historical missing-labels/bibliography
 * self-heal behavior. It launches only the named producer, never a second
 * validate or QA process.
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));

export function regenerateValidationArtifact({ scriptName, book, root, env }) {
  const childArgs = [join(scriptDir, scriptName)];
  if (book) childArgs.push('--book', book);
  return spawnSync(process.execPath, childArgs, {
    cwd: root,
    env,
    encoding: 'utf8',
  });
}
