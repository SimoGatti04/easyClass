/**
 * Teacher Service — MCP Server Implementation
 *
 * Implements full Model Context Protocol (v1.29) coverage:
 * - Organization: Classes, Subjects, Lessons, Collections
 * - Materials: CRUD, Search (FTS5), Versioning, Import, Duplicate, Archive, Restore, Delete, Export
 * - Pedagogical Roles & Assessable Authorization
 * - AI Generation & Iterative Revision Workflows
 * - Resources discovery & read
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { TeacherService } from '../services/teacher-service.js';
import { PedagogicalRoles, ResourceTypes, ContentFormats } from '../core/contracts.js';
import { AuthorizationError, ValidationError, TeacherServiceError } from '../core/errors.js';

const defaultTeacherAuthorizer = async () =>
  process.env.NODE_ENV !== 'production' && process.env.TEACHER_SERVICE_LOCAL_TEACHER_MODE === 'true'
    ? { teacherAuthorized: true, actorId: 'local-teacher' }
    : false;

function teacherGrant(value) {
  return value === true || value?.teacherAuthorized === true;
}

const sourceReferenceSchema = {
  oneOf: [
    { type: 'string', description: 'Previously registered source ID; for internal sources this pins their registered exact version.' },
    {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Material or source ID' },
        sourceId: { type: 'string', description: 'Registered source ID' },
        resourceId: { type: 'string', description: 'Internal material ID' },
        versionNumber: { type: 'integer', minimum: 1, description: 'Required exact internal material version' },
        version: { type: 'integer', minimum: 1 },
        url: { type: 'string', description: 'External HTTPS URL to retrieve' },
        title: { type: 'string' }
      },
      additionalProperties: false
    }
  ]
};

const sourceSelectionProperties = {
  sourceQuery: { type: 'string', description: 'Focused query used to select relevant internal and external sources' },
  requiredSources: { type: 'array', items: sourceReferenceSchema, description: 'Required sources. Missing or unavailable entries fail generation.' },
  excludedSources: { type: 'array', items: sourceReferenceSchema, description: 'Sources to exclude; a material+version object excludes only that exact version.' },
  includePreviousLessons: { type: 'boolean' },
  previousLessonLimit: { type: 'integer', minimum: 0 },
  searchInternal: { type: 'boolean' },
  searchWeb: { type: 'boolean', description: 'Perform live web search and retrieve selected pages; not merely register URLs.' },
  internalSourceLimit: { type: 'integer', minimum: 0 },
  webSourceLimit: { type: 'integer', minimum: 0 }
};

export function createMcpServer(service = new TeacherService(), { authorizeTeacher = defaultTeacherAuthorizer } = {}) {
  const server = new Server(
    {
      name: 'teacher-service',
      version: '0.1.0'
    },
    {
      capabilities: {
        tools: {},
        resources: {}
      }
    }
  );

  const tools = [
    /* ------------------------------------------------------------------------ */
    /* ORGANIZATION TOOLS                                                       */
    /* ------------------------------------------------------------------------ */
    {
      name: 'create_class',
      description: 'Creates a new academic class.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Class name (e.g. "4A Informatica")' },
          academicYear: { type: 'string', description: 'Academic year (e.g. "2026/2027")' },
          section: { type: 'string', description: 'Optional section' },
          description: { type: 'string', description: 'Optional description' }
        },
        required: ['name', 'academicYear'],
        additionalProperties: false
      }
    },
    {
      name: 'list_classes',
      description: 'Lists all registered academic classes.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }
    },
    {
      name: 'get_class',
      description: 'Retrieves details of a specific class.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Class ID' } },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'update_class',
      description: 'Updates details of an existing class.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Class ID' },
          name: { type: 'string' },
          academicYear: { type: 'string' },
          section: { type: 'string' },
          description: { type: 'string' }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'delete_class',
      description: 'Deletes a class and cascade-associated entities.',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Class ID' } },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'create_subject',
      description: 'Creates a subject within a class.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'Parent class ID' },
          name: { type: 'string', description: 'Subject name (e.g. "Basi di Dati")' },
          code: { type: 'string', description: 'Optional code (e.g. "BD4")' },
          description: { type: 'string' }
        },
        required: ['classId', 'name'],
        additionalProperties: false
      }
    },
    {
      name: 'list_subjects',
      description: 'Lists subjects, optionally filtered by classId.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { classId: { type: 'string', description: 'Filter by class ID' } },
        additionalProperties: false
      }
    },
    {
      name: 'create_lesson',
      description: 'Creates a planned lesson within a class and subject.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string', description: 'Class ID' },
          subjectId: { type: 'string', description: 'Subject ID' },
          title: { type: 'string', description: 'Lesson title' },
          description: { type: 'string' },
          date: { type: 'string', description: 'Planned date (YYYY-MM-DD)' },
          orderIndex: { type: 'integer', description: 'Sequence order index' },
          status: { type: 'string', enum: ['planned', 'completed', 'cancelled'] }
        },
        required: ['classId', 'subjectId', 'title'],
        additionalProperties: false
      }
    },
    {
      name: 'list_lessons',
      description: 'Lists lessons filtered by class, subject, or status.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          status: { type: 'string' }
        },
        additionalProperties: false
      }
    },
    {
      name: 'get_lesson',
      description: 'Retrieves details of a specific lesson.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'create_collection',
      description: 'Creates a material collection or curriculum folder.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          classId: { type: 'string' },
          subjectId: { type: 'string' }
        },
        required: ['name'],
        additionalProperties: false
      }
    },
    {
      name: 'list_collections',
      description: 'Lists collections, optionally filtered by class or subject.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { classId: { type: 'string' }, subjectId: { type: 'string' } },
        additionalProperties: false
      }
    },
    {
      name: 'add_to_collection',
      description: 'Adds a material to a collection.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          collectionId: { type: 'string' },
          resourceId: { type: 'string' }
        },
        required: ['collectionId', 'resourceId'],
        additionalProperties: false
      }
    },

    /* ------------------------------------------------------------------------ */
    /* MATERIALS TOOLS                                                          */
    /* ------------------------------------------------------------------------ */
    {
      name: 'create_material',
      description: 'Creates a persistent pedagogical material with version 1.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Material title' },
          contentText: { type: 'string', description: 'Full text content (Markdown)' },
          description: { type: 'string' },
          pedagogicalRole: {
            type: 'string',
            enum: ['teacher_material', 'student_material', 'support_material', 'assessable_material'],
            description: 'Pedagogical role according to approved domain dossiers'
          },
          resourceType: {
            type: 'string',
            enum: ['lesson_plan', 'teacher_script', 'student_note', 'slides', 'exercise_sheet', 'assessment', 'reference_source', 'custom']
          },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          lessonId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          collectionId: { type: 'string' }
        },
        required: ['title', 'contentText'],
        additionalProperties: false
      }
    },
    {
      name: 'import_material',
      description: 'Imports material from text or ChatGPT conversation attachment.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          contentText: { type: 'string' },
          originUri: { type: 'string', description: 'Origin source URI or file attachment reference' },
          pedagogicalRole: {
            type: 'string',
            enum: ['teacher_material', 'student_material', 'support_material', 'assessable_material']
          },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          lessonId: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          description: { type: 'string' }
        },
        required: ['title', 'contentText'],
        additionalProperties: false
      }
    },
    {
      name: 'get_material',
      description: 'Retrieves complete material details and content (latest or specific version).',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Material ID' },
          versionNumber: { type: 'integer', description: 'Optional specific version number' }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'list_materials',
      description: 'Lists materials with filters by class, subject, lesson, pedagogical role, or status.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          lessonId: { type: 'string' },
          pedagogicalRole: { type: 'string' },
          status: { type: 'string', enum: ['active', 'archived', 'trashed', 'all'] },
          collectionId: { type: 'string' },
          tag: { type: 'string' },
          limit: { type: 'integer' }
        },
        additionalProperties: false
      }
    },
    {
      name: 'search_materials',
      description: 'Performs full-text search (FTS5) across titles, descriptions, tags, and content.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search keywords or phrases' },
          classId: { type: 'string' },
          pedagogicalRole: { type: 'string' },
          limit: { type: 'integer' }
        },
        required: ['query'],
        additionalProperties: false
      }
    },
    {
      name: 'update_material',
      description: 'Edits material title, description, or content (creates a new immutable version increment).',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'Material ID' },
          title: { type: 'string' },
          description: { type: 'string' },
          contentText: { type: 'string' },
          pedagogicalRole: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
          changeSummary: { type: 'string' }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'get_material_versions',
      description: 'Returns version history and provenance for a material.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'move_material',
      description: 'Moves or relinks material to another class, subject, lesson, or collection.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          lessonId: { type: 'string' },
          collectionId: { type: 'string' }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'duplicate_material',
      description: 'Duplicates an existing material into a new independent material.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          newTitle: { type: 'string' },
          targetLessonId: { type: 'string' },
          targetClassId: { type: 'string' }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'archive_material',
      description: 'Archives a material without deleting it.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'restore_material',
      description: 'Restores an archived or trashed material back to active state.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'delete_material',
      description: 'Soft-deletes (trashes) or permanently deletes a material.',
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          permanent: { type: 'boolean', description: 'True for permanent purge, false for trash' }
        },
        required: ['id'],
        additionalProperties: false
      }
    },
    {
      name: 'publish_material',
      description: 'Publishes one exact Student Material or Support Material version for student availability.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          resourceId: { type: 'string' },
          versionNumber: { type: 'integer' },
          availableUntil: { type: 'string' },
          notes: { type: 'string' }
        },
        required: ['resourceId', 'versionNumber'],
        additionalProperties: false
      }
    },
    {
      name: 'unpublish_material',
      description: 'Withdraws student availability for one exact published material version.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          resourceId: { type: 'string' },
          versionNumber: { type: 'integer' },
          notes: { type: 'string' }
        },
        required: ['resourceId', 'versionNumber'],
        additionalProperties: false
      }
    },
    {
      name: 'authorize_assessable',
      description: 'Explicitly authorizes an exact Support Material version as assessable without changing its pedagogical role. Student Material eligibility comes from publication; Teacher Material cannot be authorized.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          resourceId: { type: 'string' },
          lessonId: { type: 'string' },
          versionNumber: { type: 'integer' },
          notes: { type: 'string' }
        },
        required: ['resourceId', 'versionNumber'],
        additionalProperties: false
      }
    },
    {
      name: 'export_material',
      description: 'Exports material into markdown, text, or json format.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          format: { type: 'string', enum: ['markdown', 'text', 'json'] },
          versionNumber: { type: 'integer' }
        },
        required: ['id'],
        additionalProperties: false
      }
    },

    /* ------------------------------------------------------------------------ */
    /* AI GENERATION TOOLS                                                      */
    /* ------------------------------------------------------------------------ */
    {
      name: 'generate_lesson_plan',
      description: 'Generates a structured, pedagogical Lesson Plan via OmniRoute AI and saves it as persistent material.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Lesson topic' },
          lessonId: { type: 'string', description: 'Optional associated lesson' },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          courseId: { type: 'string', description: 'Optional course scope used when resolving contextual AI rules' },
          durationMinutes: { type: 'integer', description: 'Duration in minutes (default 60)' },
          objectives: { type: 'array', items: { type: 'string' } },
          prerequisites: { type: 'array', items: { type: 'string' } },
          additionalInstructions: { type: 'string' },
          model: { type: 'string', description: 'Configurable model selection' },
          ...sourceSelectionProperties
        },
        additionalProperties: false
      }
    },
    {
      name: 'generate_teacher_script',
      description: 'Generates a full, line-by-line Teacher Script with timecodes, hooks, explanations, board notes, and question prompts.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          lessonId: { type: 'string' },
          lessonPlanId: { type: 'string', description: 'Base Lesson Plan material ID' },
          lessonPlanVersionNumber: { type: 'integer', minimum: 1 },
          sourceMaterialIds: { type: 'array', items: sourceReferenceSchema },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          courseId: { type: 'string', description: 'Optional course scope used when resolving contextual AI rules' },
          durationMinutes: { type: 'integer' },
          additionalInstructions: { type: 'string' },
          model: { type: 'string' },
          ...sourceSelectionProperties
        },
        additionalProperties: false
      }
    },
    {
      name: 'generate_student_material',
      description: 'Generates canonical Student Material (handout / study guide) based on the lesson and explained script.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          lessonId: { type: 'string' },
          teacherScriptId: { type: 'string', description: 'Base Teacher Script material ID' },
          teacherScriptVersionNumber: { type: 'integer', minimum: 1 },
          sourceMaterialIds: { type: 'array', items: sourceReferenceSchema },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          courseId: { type: 'string', description: 'Optional course scope used when resolving contextual AI rules' },
          targetLevel: { type: 'string' },
          additionalInstructions: { type: 'string' },
          model: { type: 'string' },
          ...sourceSelectionProperties
        },
        additionalProperties: false
      }
    },
    {
      name: 'generate_exercises',
      description: 'Generates graduated exercises with reserved teacher-only solution keys.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          studentMaterialId: { type: 'string', description: 'Optional exact student material resource ID' },
          studentMaterialVersionNumber: { type: 'integer', minimum: 1 },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          courseId: { type: 'string', description: 'Optional course scope used when resolving contextual AI rules' },
          lessonId: { type: 'string' },
          count: { type: 'integer', description: 'Number of exercises (default 5)' },
          difficultyLevels: { type: 'array', items: { type: 'string' } },
          withSolutions: { type: 'boolean', description: 'Include reserved teacher-only solutions' },
          model: { type: 'string' },
          ...sourceSelectionProperties
        },
        additionalProperties: false
      }
    },
    {
      name: 'generate_assessment_draft',
      description: 'Generates a teacher-only assessment draft from exact, currently published Assessable Source Set versions; drafts are not publication or readiness approval.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          topic: { type: 'string' },
          assessableMaterialIds: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, versionNumber: { type: 'integer' } }, required: ['id', 'versionNumber'], additionalProperties: false }, description: 'Exact published Student Material versions or published and explicitly authorized Support Material versions' },
          durationMinutes: { type: 'integer' },
          maxScore: { type: 'integer' },
          questionTypes: { type: 'array', items: { type: 'string' } },
          lessonId: { type: 'string' },
          classId: { type: 'string' },
          subjectId: { type: 'string' },
          courseId: { type: 'string', description: 'Optional course scope used when resolving contextual AI rules' },
          additionalInstructions: { type: 'string' },
          model: { type: 'string' }
        },
        additionalProperties: false
      }
    },
    {
      name: 'revise_material',
      description: 'Iteratively revises or expands an existing material following teacher instructions, creating an updated version.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          materialId: { type: 'string' },
          instruction: { type: 'string', description: 'Correction or expansion instruction' },
          focusSection: { type: 'string' },
          requiredSources: { type: 'array', items: sourceReferenceSchema },
          excludedSources: { type: 'array', items: sourceReferenceSchema },
          searchWeb: { type: 'boolean' },
          sourceQuery: { type: 'string' },
          model: { type: 'string' }
        },
        required: ['materialId', 'instruction'],
        additionalProperties: false
      }
    },
    {
      name: 'regenerate_section',
      description: 'Selectively regenerates a specific section inside a material.',
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: 'object',
        properties: {
          materialId: { type: 'string' },
          sectionTitle: { type: 'string' },
          instructions: { type: 'string' },
          model: { type: 'string' }
        },
        required: ['materialId', 'sectionTitle', 'instructions'],
        additionalProperties: false
      }
    },
    {
      name: 'list_ai_models',
      description: 'Discovers available models from OmniRoute without artificial quotas.',
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: 'object', properties: {}, additionalProperties: false }
    }
,
    /* ------------------------------------------------------------------------ */
    /* COLLECTIONS EXTENSIONS                                                  */
    /* ------------------------------------------------------------------------ */
    {
      name: "list_collection_resources",
      description: "Lists all materials and resources belonging to a curriculum collection.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          collectionId: { type: "string", description: "Collection ID" }
        },
        required: ["collectionId"],
        additionalProperties: false
      }
    },
    {
      name: "remove_from_collection",
      description: "Removes a material or resource from a curriculum collection.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          collectionId: { type: "string", description: "Collection ID" },
          resourceId: { type: "string", description: "Resource ID" }
        },
        required: ["collectionId", "resourceId"],
        additionalProperties: false
      }
    },

    /* ------------------------------------------------------------------------ */
    /* AI OPERATIONAL RULES (Dossier 09)                                        */
    /* ------------------------------------------------------------------------ */
    {
      name: "set_ai_rule",
      description: "Creates or updates a versioned AI operational instruction rule (Dossier 09 Configuration Model).",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Existing rule ID for a versioned update" },
          scope: {
            type: "string",
            enum: ["global", "course", "subject", "class", "class_subject", "lesson", "assessment", "capability"],
            description: "Hierarchy scope according to Dossier 09"
          },
          targetId: { type: "string", description: "Target entity ID (e.g. subjectId, classId, lessonId, assessmentId, or capability name)" },
          secondaryTargetId: { type: "string", description: "Secondary target ID (e.g. subjectId when scope is class_subject)" },
          title: { type: "string", description: "Descriptive title for the rule" },
          instructionText: { type: "string", description: "Authoritative instruction prompt content" },
          changeNote: { type: "string", description: "Audit note for this rule version" }
        },
        required: ["scope", "title", "instructionText"],
        additionalProperties: false
      }
    },
    {
      name: "get_ai_rule",
      description: "Retrieves an AI instruction rule by ID.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Rule ID" }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "get_ai_rule_version_history",
      description: "Returns the recoverable immutable version history of a teacher-internal AI rule.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false }
    },
    {
      name: "get_ai_rule_version",
      description: "Reads one exact historical version of a teacher-internal AI rule.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: "object", properties: { id: { type: "string" }, version: { type: "integer", minimum: 1 } }, required: ["id", "version"], additionalProperties: false }
    },
    {
      name: "archive_ai_rule",
      description: "Archives a persistent AI rule while preserving its version history.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: "object", properties: { id: { type: "string" }, changeNote: { type: "string" } }, required: ["id"], additionalProperties: false }
    },
    {
      name: "restore_ai_rule",
      description: "Restores an archived or recoverably deleted AI rule.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: "object", properties: { id: { type: "string" }, changeNote: { type: "string" } }, required: ["id"], additionalProperties: false }
    },
    {
      name: "restore_ai_rule_version",
      description: "Creates a new current version by restoring the content of an exact historical AI rule version.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: "object", properties: { id: { type: "string" }, version: { type: "integer", minimum: 1 }, changeNote: { type: "string" } }, required: ["id", "version"], additionalProperties: false }
    },
    {
      name: "list_ai_rules",
      description: "Lists AI instruction rules with optional scope, targetId, and status filters.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          scope: { type: "string", description: "Filter by rule scope" },
          targetId: { type: "string", description: "Filter by target ID" },
          secondaryTargetId: { type: "string", description: "Filter class+course/subject rules by their secondary target" },
          status: { type: "string", description: "Filter by status (default: active)" }
        },
        additionalProperties: false
      }
    },
    {
      name: "delete_ai_rule",
      description: "Deletes or archives an AI instruction rule.",
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Rule ID" },
          permanent: { type: "boolean", description: "Permanently erases all rule history only when explicitly requested; default is recoverable deletion" },
          changeNote: { type: "string" }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "resolve_effective_ai_rules",
      description: "Resolves composite AI instructions and provenance trace for a pedagogical context (Dossier 09 inheritance model).",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          classId: { type: "string", description: "Class ID" },
          subjectId: { type: "string", description: "Subject ID" },
          courseId: { type: "string", description: "Course ID when distinct from subjectId" },
          lessonId: { type: "string", description: "Lesson ID" },
          assessmentId: { type: "string", description: "Assessment ID" },
          capability: { type: "string", description: "Target capability (e.g. lesson_plan, student_material, grading)" },
          oneOffInstruction: { type: "string", description: "Transient one-off instruction" }
        },
        additionalProperties: false
      }
    },

    /* ------------------------------------------------------------------------ */
    /* SOURCES TOOLS (Dossier 04)                                               */
    /* ------------------------------------------------------------------------ */
    {
      name: "register_source",
      description: "Registers an internal material or external web reference as a candidate source (FOUND state, Dossier 04).",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          sourceType: { type: "string", enum: ["internal_material", "external_web"], description: "Source type" },
          title: { type: "string", description: "Source title" },
          resourceId: { type: "string", description: "Internal material resource ID if internal" },
          versionNumber: { type: "number", description: "Exact material version number" },
          url: { type: "string", description: "External URL if external" },
          contentSnippet: { type: "string", description: "Initial content excerpt" },
          authorityLevel: { type: "string", enum: ["official", "academic", "reference", "unverified"], description: "Authority rating" },
          relevanceScore: { type: "number", description: "Relevance score between 0.0 and 1.0" },
          notes: { type: "string", description: "Curatorial notes" }
        },
        required: ["sourceType", "title"],
        additionalProperties: false
      }
    },
    {
      name: "get_source",
      description: "Retrieves source record by ID.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Source ID" }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "list_sources",
      description: "Lists sources filtered by lifecycle state, source type, or linked resource ID.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          state: { type: "string", enum: ["found", "consulted", "used", "saved"], description: "Lifecycle state (Dossier 04)" },
          sourceType: { type: "string", enum: ["internal_material", "external_web"] },
          resourceId: { type: "string" }
        },
        additionalProperties: false
      }
    },
    {
      name: "consult_source",
      description: "Actually retrieves and inspects the selected internal version or external HTTPS page; URL registration alone is not consultation.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Source ID" },
          relevanceScore: { type: "number" }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "save_external_source",
      description: "Saves a consulted external source persistently into the material repository as reference_source (SAVED state, Dossier 04).",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Source ID" },
          classId: { type: "string" },
          subjectId: { type: "string" },
          lessonId: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "search_sources",
      description: "Searches internal materials repository for candidate grounding sources with version and assessable indicators.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search keywords or phrases" },
          classId: { type: "string" },
          subjectId: { type: "string" },
          limit: { type: "number" }
        },
        required: ["query"],
        additionalProperties: false
      }
    },
    {
      name: "search_web_sources",
      description: "Searches the configured external web provider and registers results as FOUND only; selected pages must be retrieved through inspect_source or source selection before being CONSULTED.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1 }, authorityFilter: { type: "string", enum: ["official", "academic", "reference", "unverified"] } }, required: ["query"], additionalProperties: false }
    },
    {
      name: "select_generation_sources",
      description: "Resolves exact required/excluded internal and external sources for a context; performs actual page retrieval for web sources and returns untrusted source content with version and provenance.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      inputSchema: { type: "object", properties: { query: { type: "string" }, classId: { type: "string" }, subjectId: { type: "string" }, lessonId: { type: "string" }, currentLessonOrder: { type: "integer" }, requiredSources: { type: "array", items: sourceReferenceSchema }, excludedSources: { type: "array", items: sourceReferenceSchema }, includePreviousLessons: { type: "boolean" }, previousLessonLimit: { type: "integer", minimum: 0 }, searchInternal: { type: "boolean" }, searchWeb: { type: "boolean" }, internalSourceLimit: { type: "integer", minimum: 0 }, webSourceLimit: { type: "integer", minimum: 0 } }, required: ["query"], additionalProperties: false }
    },
    {
      name: "get_source_history",
      description: "Returns the FOUND/CONSULTED/USED/SAVED event history of a source.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false }
    },
    {
      name: "inspect_source",
      description: "Actually retrieves and returns the exact content snapshot for an internal material version or a public HTTPS page.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      inputSchema: { type: "object", properties: { id: { type: "string" }, relevanceScore: { type: "number", minimum: 0, maximum: 1 } }, required: ["id"], additionalProperties: false }
    },
    {
      name: "get_previous_lessons",
      description: "Retrieves prior lessons context for curriculum continuity and progression (Dossier 04).",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          classId: { type: "string", description: "Class ID" },
          subjectId: { type: "string", description: "Subject ID" },
          currentLessonOrder: { type: "number", description: "Current lesson order index" },
          limit: { type: "number", description: "Max prior lessons to return" }
        },
        required: ["classId", "subjectId"],
        additionalProperties: false
      }
    },

    /* ------------------------------------------------------------------------ */
    /* REAL FILE IMPORT & EXPORT                                                */
    /* ------------------------------------------------------------------------ */
    {
      name: "import_attachment_file",
      description: "Imports a real document attached in ChatGPT (PDF, DOCX, Markdown, Text) into Teacher Service. Securely downloads the file reference over HTTPS with SSRF protection, extracts readable text, saves the original binary with SHA-256 verification, and creates a persistent versioned educational material.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
      _meta: { "openai/fileParams": ["file"] },
      inputSchema: {
        type: "object",
        $defs: {
          OpenAIFile: {
            type: "object",
            properties: {
              download_url: { type: "string" },
              file_id: { type: "string" },
              mime_type: { type: "string" },
              file_name: { type: "string" }
            },
            required: ["download_url", "file_id"],
            additionalProperties: false
          }
        },
        properties: {
          file: { $ref: "#/$defs/OpenAIFile", description: "ChatGPT uploaded file reference payload" },
          title: { type: "string", description: "Custom material title (optional, derived from filename if omitted)" },
          pedagogicalRole: {
            type: "string",
            enum: ["teacher_material", "student_material", "support_material", "assessable_material"],
            description: "Pedagogical role (default: support_material)"
          },
          classId: { type: "string", description: "Optional associated class ID" },
          subjectId: { type: "string", description: "Optional associated subject ID" },
          lessonId: { type: "string", description: "Optional associated lesson ID" },
          tags: { type: "array", items: { type: "string" }, description: "Optional categorization tags" }
        },
        required: ["file"],
        additionalProperties: false
      }
    },
    {
      name: "import_file",
      description: "Imports a real document (PDF, DOCX, MD, TXT, HTML) from disk or base64 into the material repository with SHA-256 binary preservation.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "Absolute filesystem path to document" },
          fileBufferBase64: { type: "string", description: "Base64 encoded file content if uploading directly" },
          filename: { type: "string", description: "Original filename" },
          title: { type: "string", description: "Custom material title" },
          pedagogicalRole: {
            type: "string",
            enum: ["teacher_material", "student_material", "support_material", "assessable_material"],
            description: "Pedagogical role (default: support_material)"
          },
          classId: { type: "string" },
          subjectId: { type: "string" },
          lessonId: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        },
        additionalProperties: false
      }
    },
    {
      name: "export_material_file",
      description: "Exports a material in downloadable formats (markdown, text, json, html, docx) with frontmatter and styling.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Material resource ID" },
          format: { type: "string", enum: ["markdown", "text", "json", "html", "docx"], description: "Export format" },
          includeTeacherSolutions: { type: "boolean", description: "Whether to include protected teacher solutions" }
        },
        required: ["id"],
        additionalProperties: false
      }
    },

    /* ------------------------------------------------------------------------ */
    /* ASSESSMENT & GRADING (Dossier 05, Dossier 06)                            */
    /* ------------------------------------------------------------------------ */
    {
      name: "create_assessment",
      description: "Creates a formal assessment blueprint with items, scoring, and rubrics (Dossier 05).",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          title: { type: "string", description: "Assessment title" },
          description: { type: "string" },
          classId: { type: "string" },
          subjectId: { type: "string" },
          lessonId: { type: "string" },
          durationMinutes: { type: "number", description: "Duration in minutes" },
          maxScore: { type: "number", description: "Maximum total score (default: 100)" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["multiple_choice", "open_short", "open_extended", "code", "problem_case"] },
                questionText: { type: "string" },
                maxScore: { type: "number" },
                rubricJson: { type: "object" },
                teacherSolution: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                isSelfCorrecting: { type: "boolean" },
                assessableSourceId: { type: "string" },
                assessableSourceVersion: { type: "number" }
              },
              required: ["type", "questionText", "assessableSourceId", "assessableSourceVersion"]
            }
          }
        },
        required: ["title"],
        additionalProperties: false
      }
    },
    {
      name: "get_assessment",
      description: "Retrieves an assessment blueprint with questions, rubrics, and protected teacher solutions.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Assessment ID" },
          role: { type: "string", enum: ["teacher", "student"], description: "Caller role (default: teacher)" },
          includeTeacherSolutions: { type: "boolean", description: "Whether to include protected solutions (requires teacher role)" }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "list_assessments",
      description: "Lists assessments filtered by class, subject, lesson, or status.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          classId: { type: "string" },
          subjectId: { type: "string" },
          lessonId: { type: "string" },
          status: { type: "string", enum: ["draft", "ready", "active", "closed", "graded", "archived"] }
        },
        additionalProperties: false
      }
    },
    {
      name: "add_assessment_item",
      description: "Adds an item/question to an assessment blueprint with rubrics, solutions, and assessable material grounding.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          assessmentId: { type: "string", description: "Assessment ID" },
          type: { type: "string", enum: ["multiple_choice", "open_short", "open_extended", "code", "problem_case"] },
          questionText: { type: "string" },
          maxScore: { type: "number" },
          rubricJson: { type: "object" },
          teacherSolution: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          isSelfCorrecting: { type: "boolean" },
          assessableSourceId: { type: "string" },
          assessableSourceVersion: { type: "number" }
        },
        required: ["assessmentId", "type", "questionText", "assessableSourceId", "assessableSourceVersion"],
        additionalProperties: false
      }
    },
    {
      name: "import_submission",
      description: "Imports a student submission attempt with item responses (Dossier 06).",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          assessmentId: { type: "string", description: "Assessment ID" },
          studentId: { type: "string", description: "Student identifier" },
          studentName: { type: "string", description: "Student full name" },
          responses: {
            type: "array",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string" },
                responseText: { type: "string" }
              },
              required: ["itemId", "responseText"]
            }
          }
        },
        required: ["assessmentId", "studentId", "responses"],
        additionalProperties: false
      }
    },
    {
      name: "get_submission",
      description: "Retrieves a student submission attempt with evaluations and feedback history.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          submissionId: { type: "string", description: "Submission ID" }
        },
        required: ["submissionId"],
        additionalProperties: false
      }
    },
    {
      name: "list_submissions",
      description: "Lists all submissions for a given assessment.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          assessmentId: { type: "string", description: "Assessment ID" }
        },
        required: ["assessmentId"],
        additionalProperties: false
      }
    },
    {
      name: "grade_submission",
      description: "Executes deterministic and AI-assisted grading for a student submission (Dossier 06). Creates an evaluation round.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          submissionId: { type: "string", description: "Submission ID" },
          evaluator: { type: "string", description: "Evaluator name or tag" },
          model: { type: "string", description: "AI model to use for open question grading" }
        },
        required: ["submissionId"],
        additionalProperties: false
      }
    },
    {
      name: "review_grading",
      description: "Allows teacher to review, override item scores, and assign final grade with non-destructive round preservation (teacher authority).",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          submissionId: { type: "string", description: "Submission ID" },
          reviewer: { type: "string", description: "Teacher identifier" },
          finalGrade: { type: "string", description: "Final human grade assigned (e.g. 8+, 28/30, A)" },
          itemOverrides: {
            type: "array",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string" },
                score: { type: "number" },
                feedback: { type: "string" }
              },
              required: ["itemId", "score"]
            }
          }
        },
        required: ["submissionId"],
        additionalProperties: false
      }
    },
    {
      name: "export_assessment_results",
      description: "Exports assessment submissions and grades in CSV, JSON, or Markdown summary report format.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          assessmentId: { type: "string", description: "Assessment ID" },
          format: { type: "string", enum: ["csv", "json", "markdown"], description: "Export format (default: csv)" }
        },
        required: ["assessmentId"],
        additionalProperties: false
      }
    },
    {
      name: "update_assessment",
      description: "Updates an existing assessment blueprint metadata, duration, or score.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Assessment ID" },
          title: { type: "string" },
          description: { type: "string" },
          durationMinutes: { type: "number" },
          maxScore: { type: "number" },
          activityType: { type: "string", enum: ["test", "exercise"] },
          status: { type: "string", enum: ["draft", "ready", "active", "closed"] }
        },
        required: ["id"],
        additionalProperties: false
      }
    },
    {
      name: "set_assessment_status",
      description: "Transitions an assessment through its lifecycle: draft -> ready -> active -> closed.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "Assessment ID" },
          status: { type: "string", enum: ["draft", "ready", "active", "closed"], description: "New lifecycle status" }
        },
        required: ["id", "status"],
        additionalProperties: false
      }
    },
    {
      name: "update_assessment_item",
      description: "Updates an item/question in an assessment blueprint preserving teacher solutions.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          assessmentId: { type: "string", description: "Assessment ID" },
          itemId: { type: "string", description: "Assessment item ID" },
          questionText: { type: "string" },
          maxScore: { type: "number" },
          type: { type: "string", enum: ["multiple_choice", "open_question", "open_short", "open_extended", "code", "attachment", "problem_case"] },
          teacherSolution: { type: "string" },
          starterCode: { type: "string" },
          language: { type: "string" },
          options: { type: "array" },
          rubric: { type: "object" },
          isSelfCorrecting: { type: "boolean" },
          assessableSourceId: { type: "string" },
          assessableSourceVersion: { type: "number" }
        },
        required: ["assessmentId", "itemId"],
        additionalProperties: false
      }
    },
    {
      name: "delete_assessment_item",
      description: "Deletes an item/question from an assessment blueprint.",
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          assessmentId: { type: "string", description: "Assessment ID" },
          itemId: { type: "string", description: "Assessment item ID" }
        },
        required: ["assessmentId", "itemId"],
        additionalProperties: false
      }
    },
    {
      name: "reopen_submission",
      description: "Reopens a finalized student submission allowing the student to resume work with full teacher audit trail.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          submissionId: { type: "string", description: "Submission ID to reopen" },
          reason: { type: "string", description: "Pedagogical or technical reason for reopening" }
        },
        required: ["submissionId"],
        additionalProperties: false
      }
    },
    {
      name: "list_activity_credentials",
      description: "Lists temporary student access codes for an activity (teacher only). Strips all session tokens for privacy.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          assessmentId: { type: "string", description: "Assessment ID" }
        },
        required: ["assessmentId"],
        additionalProperties: false
      }
    },
    {
      name: "reissue_student_credential",
      description: "Reissues a fresh temporary access code for an authorized student session that was lost, interrupted, or compromised (teacher only).",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      inputSchema: {
        type: "object",
        properties: {
          credentialId: { type: "string", description: "Credential ID to reissue" },
          reason: { type: "string", description: "Reason for reissuing the credential" }
        },
        required: ["credentialId"],
        additionalProperties: false
      }
    }
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;

    try {
      const grant = await authorizeTeacher({ toolName: name, request });
      if (!teacherGrant(grant)) throw new AuthorizationError('A verified teacher principal is required for Teacher Service MCP data and operations');
      const actor = { teacherAuthorized: true, actorId: grant?.actorId || grant?.principal };
      let result = null;

      switch (name) {
        /* ORGANIZATION */
        case 'create_class':
          result = service.createClass(args);
          break;
        case 'list_classes':
          result = service.listClasses();
          break;
        case 'get_class':
          result = service.getClass(args.id);
          break;
        case 'update_class':
          result = service.updateClass(args.id, args);
          break;
        case 'delete_class':
          result = service.deleteClass(args.id);
          break;
        case 'create_subject':
          result = service.createSubject(args);
          break;
        case 'list_subjects':
          result = service.listSubjects(args.classId);
          break;
        case 'create_lesson':
          result = service.createLesson(args);
          break;
        case 'list_lessons':
          result = service.listLessons(args);
          break;
        case 'get_lesson':
          result = service.getLesson(args.id);
          break;
        case 'create_collection':
          result = service.createCollection(args);
          break;
        case 'list_collections':
          result = service.listCollections(args);
          break;
        case 'add_to_collection':
          result = service.addResourceToCollection(args.collectionId, args.resourceId);
          break;

        /* MATERIALS */
        case 'create_material':
          result = service.createMaterial(args);
          break;
        case 'import_material':
          result = service.importMaterial(args);
          break;
        case 'get_material':
          result = service.getMaterial(args.id, args.versionNumber);
          break;
        case 'list_materials':
          result = service.listMaterials(args);
          break;
        case 'search_materials':
          result = service.searchMaterials(args.query, args);
          break;
        case 'update_material':
          result = service.updateMaterial(args.id, args);
          break;
        case 'get_material_versions':
          result = service.getMaterialVersionHistory(args.id);
          break;
        case 'move_material':
          result = service.moveMaterial(args.id, args);
          break;
        case 'duplicate_material':
          result = service.duplicateMaterial(args.id, args);
          break;
        case 'archive_material':
          result = service.archiveMaterial(args.id);
          break;
        case 'restore_material':
          result = service.restoreMaterial(args.id);
          break;
        case 'delete_material':
          result = service.deleteMaterial(args.id, args);
          break;
        case 'publish_material':
          result = service.publishMaterial(args.resourceId, args);
          break;
        case 'unpublish_material':
          result = service.unpublishMaterial(args.resourceId, args);
          break;
        case 'authorize_assessable':
          result = service.authorizeAssessable(args.resourceId, args);
          break;
        case 'export_material':
          result = service.exportMaterial(args.id, args);
          break;

        /* AI GENERATION */
        case 'generate_lesson_plan':
          result = await service.generateLessonPlan(args);
          break;
        case 'generate_teacher_script':
          result = await service.generateTeacherScript(args);
          break;
        case 'generate_student_material':
          result = await service.generateStudentMaterial(args);
          break;
        case 'generate_exercises':
          result = await service.generateExercises(args);
          break;
        case 'generate_assessment_draft':
          result = await service.generateAssessmentDraft(args);
          break;
        case 'revise_material':
          result = await service.reviseMaterial(args);
          break;
        case 'regenerate_section':
          result = await service.regenerateSection(args);
          break;
        case 'list_ai_models':
          result = await service.listAiModels();
          break;

                /* COLLECTIONS EXTENSIONS */
        case "list_collection_resources":
          result = service.listCollectionResources(args.collectionId);
          break;
        case "remove_from_collection":
          result = service.removeResourceFromCollection(args.collectionId, args.resourceId);
          break;

        /* AI RULES (Dossier 09) */
        case "set_ai_rule":
          result = service.setAiRule(args, actor);
          break;
        case "get_ai_rule":
          result = service.getAiRule(args.id);
          break;
        case "list_ai_rules":
          result = service.listAiRules(args);
          break;
        case "delete_ai_rule":
          result = service.deleteAiRule(args.id, { permanent: args.permanent, changeNote: args.changeNote }, actor);
          break;
        case "resolve_effective_ai_rules":
          result = service.resolveEffectiveAiRules(args);
          break;
        case "get_ai_rule_version_history":
          result = service.getAiRuleVersionHistory(args.id);
          break;
        case "get_ai_rule_version":
          result = service.getAiRuleVersion(args.id, args.version);
          break;
        case "archive_ai_rule":
          result = service.archiveAiRule(args.id, actor, args.changeNote);
          break;
        case "restore_ai_rule":
          result = service.restoreAiRule(args.id, actor, args.changeNote);
          break;
        case "restore_ai_rule_version":
          result = service.restoreAiRuleVersion(args.id, args.version, actor, args.changeNote);
          break;

        /* SOURCES (Dossier 04) */
        case "register_source":
          result = service.registerSource(args);
          break;
        case "get_source":
          result = service.getSource(args.id);
          break;
        case "list_sources":
          result = service.listSources(args);
          break;
        case "consult_source":
          result = await service.consultSource(args.id, args);
          break;
        case "save_external_source":
          result = service.saveExternalSource(args.id, args);
          break;
        case "search_sources":
          result = service.searchSources(args.query, args);
          break;
        case "search_web_sources":
          result = await service.searchWebSources(args.query, args);
          break;
        case "select_generation_sources":
          result = await service.selectGenerationSources(args);
          break;
        case "get_source_history":
          result = service.getSourceHistory(args.id);
          break;
        case "inspect_source": {
          const source = service.getSource(args.id);
          const consulted = await service.consultSource(args.id, { relevanceScore: args.relevanceScore });
          result = service.getSourceContent(args.id, source.source_type === 'external_web' ? consulted.content_version : source.version_number);
          break;
        }
        case "get_previous_lessons":
          result = service.getPreviousLessons(args.classId, args.subjectId, args);
          break;

        /* FILE IMPORT / EXPORT */
        case "import_attachment_file":
          result = await service.importAttachmentFile(args);
          break;
        case "import_file":
          if (args.filePath) {
            throw new ValidationError("Remote MCP invocation cannot access server filesystem paths. Use import_attachment_file with a ChatGPT file reference or upload using fileBufferBase64.");
          }
          result = await service.importFile(args);
          break;
        case "export_material_file": {
          const exp = service.exportMaterialFile(args.id, args.format, {
            includeTeacherSolutions: args.includeTeacherSolutions !== false
          });
          result = {
            filename: exp.filename,
            mimeType: exp.mimeType,
            isBinary: exp.isBinary,
            content: exp.isBinary
              ? Buffer.from(exp.data).toString("base64")
              : (typeof exp.data === "string" ? exp.data : exp.data.toString("utf8"))
          };
          break;
        }

        /* ASSESSMENT & GRADING */
        case "create_assessment":
          result = service.createAssessment(args);
          break;
        case "get_assessment":
          result = service.getAssessment(args.id, args);
          break;
        case "list_assessments":
          result = service.listAssessments(args);
          break;
        case "add_assessment_item":
          result = service.addAssessmentItem(args.assessmentId, args);
          break;
        case "import_submission":
          result = service.importSubmission(args);
          break;
        case "get_submission":
          result = service.getSubmission(args.submissionId);
          break;
        case "list_submissions":
          result = service.listSubmissions(args.assessmentId);
          break;
        case "grade_submission":
          result = await service.gradeSubmission(args);
          break;
        case "review_grading":
          result = service.reviewGrading(args);
          break;
        case "export_assessment_results":
          result = service.exportAssessmentResults(args.assessmentId, args.format);
          break;
        case "update_assessment":
          result = service.updateAssessment(args.id, args);
          break;
        case "set_assessment_status":
          result = service.setAssessmentStatus(args.id, args.status);
          break;
        case "update_assessment_item":
          result = service.updateAssessmentItem(args.assessmentId, args.itemId, args);
          break;
        case "delete_assessment_item":
          result = service.deleteAssessmentItem(args.assessmentId, args.itemId);
          break;
        case "reopen_submission":
          result = service.reopenSubmission(args.submissionId, {
            reason: args.reason,
            teacherPrincipal: actor.actorId || "teacher"
          });
          break;
        case "list_activity_credentials":
          result = service.listActivityCredentials(args.assessmentId);
          break;
        case "reissue_student_credential":
          result = service.reissueActivityCredential(args.credentialId, {
            reason: args.reason
          });
          break;

        default:
          throw new TeacherServiceError(`Unknown tool '${name}'`, 'UNKNOWN_TOOL');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (err) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              err instanceof TeacherServiceError
                ? err.toJSON()
                : { error: 'Error', message: err.message },
              null,
              2
            )
          }
        ]
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const grant = await authorizeTeacher({ toolName: 'resources/list' });
    if (!teacherGrant(grant)) throw new AuthorizationError('A verified teacher principal is required to inspect Teacher Service resources');
    const materials = service.listMaterials({ limit: 100 });
    return {
      resources: materials.map(m => ({
        uri: `teacher://materials/${m.id}`,
        name: m.title,
        description: `[${m.pedagogical_role}] ${m.description || m.title}`,
        mimeType: 'text/markdown'
      }))
    };
  });

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const grant = await authorizeTeacher({ toolName: 'resources/read', request });
    if (!teacherGrant(grant)) throw new AuthorizationError('A verified teacher principal is required to inspect Teacher Service resources');
    const { uri } = request.params;
    const match = uri.match(/^teacher:\/\/materials\/(.+)$/);
    if (!match) {
      throw new TeacherServiceError(`Unsupported resource URI: ${uri}`, 'INVALID_URI');
    }
    const material = service.getMaterial(match[1]);
    return {
      contents: [
        {
          uri,
          mimeType: 'text/markdown',
          text: material.content
        }
      ]
    };
  });

  return server;
}
