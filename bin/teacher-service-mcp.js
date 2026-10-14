#!/usr/bin/env node
/**
 * Teacher Service — Stdio MCP Server Runner
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TeacherService } from '../src/services/teacher-service.js';
import { createMcpServer } from '../src/mcp/server.js';

async function main() {
  const service = new TeacherService();
  const server = createMcpServer(service);
  const transport = new StdioServerTransport();

  process.on('SIGINT', () => {
    service.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    service.close();
    process.exit(0);
  });

  await server.connect(transport);
  console.error('Teacher Service MCP (stdio) server initialized and running');
}

main().catch(err => {
  console.error('Fatal MCP stdio error:', err);
  process.exit(1);
});
