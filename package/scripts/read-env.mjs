import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Read a small dotenv-style file without mutating process.env. */
export function readEnvFile(projectRoot = process.cwd()) {
  try {
    const out = {};
    const source = readFileSync(resolve(projectRoot, '.env'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[2] ?? '';
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[match[1]] = value;
    }
    return out;
  } catch {
    return {};
  }
}
