#!/usr/bin/env node
/**
 * Teacher Service — Streamable HTTP & Web Server Runner
 */
import { createHttpApp, DEFAULT_HOST, DEFAULT_PORT } from '../src/server/http.js';
import { TeacherService } from '../src/services/teacher-service.js';

async function main() {
  const host = process.env.HOST || DEFAULT_HOST;
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);

  const service = new TeacherService();
  const app = await createHttpApp({ service });

  app.server.listen(port, host, () => {
    console.log(`Teacher Service HTTP Server listening on http://${host}:${port}`);
    console.log(`  - MCP Streamable HTTP endpoint: http://${host}:${port}/mcp`);
    console.log(`  - Health endpoint: http://${host}:${port}/health`);
    console.log(`  - Teacher Web UI: http://${host}:${port}/`);
  });

  const shutdown = async () => {
    console.log('\nGracefully shutting down Teacher Service HTTP Server...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(err => {
  console.error('Fatal HTTP server startup error:', err);
  process.exit(1);
});
