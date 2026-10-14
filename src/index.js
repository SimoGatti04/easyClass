/**
 * Teacher Service — Main Entry Point
 */
export { TeacherService } from './services/teacher-service.js';
export { OrganizationService } from './services/organization-service.js';
export { MaterialService } from './services/material-service.js';
export { GenerationService } from './services/generation-service.js';
export { DatabaseManager, createProductionDatabase } from './db/database.js';
export { FileStore } from './storage/filestore.js';
export { OmniRouteClient } from './ai/omniroute-client.js';
export { createMcpServer } from './mcp/server.js';
export { createHttpApp } from './server/http.js';
export {
  PedagogicalRoles,
  ResourceTypes,
  ContentFormats,
  GenerationTypes,
  ProvenanceKinds
} from './core/contracts.js';
export {
  TeacherServiceError,
  NotFoundError,
  ValidationError,
  ConflictError,
  AuthorizationError,
  AIServiceError
} from './core/errors.js';
