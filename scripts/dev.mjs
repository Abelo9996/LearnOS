// One command for development: the API (restarting on change) and the Vite dev
// server with hot reload, side by side. Ctrl+C stops both.
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const procs = [
  ['api', process.execPath, ['--watch-path=server.js', '--watch-path=routes', '--watch-path=ai', '--watch-path=db', '--watch-path=middleware', 'server.js']],
  ['web', process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js')]],
].map(([name, cmd, args]) => {
  const p = spawn(cmd, args, { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
  const tag = (s) => s.toString().split('\n').filter(Boolean).map(l => `[${name}] ${l}`).join('\n') + '\n';
  p.stdout.on('data', d => process.stdout.write(tag(d)));
  p.stderr.on('data', d => process.stderr.write(tag(d)));
  p.on('exit', (code) => { console.log(`[${name}] exited (${code})`); shutdown(); });
  return p;
});
let down = false;
function shutdown() {
  if (down) return; down = true;
  for (const p of procs) p.kill('SIGTERM');
  setTimeout(() => process.exit(0), 300);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
console.log('LearnOS dev: open http://localhost:3000 (API on http://localhost:3001)');
