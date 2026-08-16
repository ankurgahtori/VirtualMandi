import { spawn } from 'node:child_process';

const server = spawn('pnpm', ['--filter', '@virtual-mandi/api', 'exec', 'tsx', 'src/server.ts'], {
  stdio: 'inherit',
  env: process.env,
});
const baseUrl = (process.env.API_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
try {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) break;
    } catch {
      // API is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (attempt === 29) throw new Error('API did not become healthy');
  }
  await import('./integration-smoke.mjs');
} finally {
  server.kill('SIGTERM');
}
