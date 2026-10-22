import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

// `neon deploy` / `neon env pull` write the branch's variables to the repo
// root. Walk up from the working directory and load the first env file found,
// without overriding variables that are already set (e.g. in production).
function loadNeonEnv(): void {
  let dir = process.cwd();
  for (;;) {
    for (const name of ['.env', '.env.local']) {
      const file = join(dir, name);
      if (existsSync(file)) {
        process.loadEnvFile(file);
        return;
      }
    }
    const parent = dirname(dir);
    if (parent === dir) return;
    dir = parent;
  }
}

loadNeonEnv();

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Run \`neon env pull\`.`);
  return value;
}
