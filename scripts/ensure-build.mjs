// `npm start` serves the built app from dist/. On a fresh clone there is no
// dist/ yet, and the server used to answer every page with a 404 JSON body.
// Build it first when it is missing or older than the source.
import { existsSync, statSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const built = join(root, 'dist', 'index.html');

function newest(dir) {
  let t = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    t = Math.max(t, e.isDirectory() ? newest(p) : statSync(p).mtimeMs);
  }
  return t;
}

const stale = !existsSync(built) || newest(join(root, 'src')) > statSync(built).mtimeMs;
if (stale) {
  console.log(existsSync(built) ? 'The app changed since the last build, rebuilding…' : 'Building the app (first run only)…');
  const r = spawnSync(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--logLevel', 'warn'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
