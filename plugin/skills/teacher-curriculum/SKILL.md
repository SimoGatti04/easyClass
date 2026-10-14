---
name: teacher-curriculum
description: Manage classes, curriculum planning, educational materials, and assessment drafts using Teacher Service MCP.
---

# Teacher Service Skill

Use this skill when the teacher asks to plan lessons, manage educational materials, import documents, generate pedagogical content (lesson plans, teacher scripts, student materials, exercises), create assessment drafts, or grade student submissions.

## Core Workflows

1. **Academic Organization:**
   - Call `list_classes` and `list_subjects` to view existing teaching assignments.
   - Call `create_class`, `create_subject`, or `create_lesson` to structure new curriculum units.
   - Use `get_previous_lessons` to retrieve pedagogical context and continuity from previous lessons.

2. **Attachment Import Workflow:**
   - When the user attaches a document (PDF, Word DOCX, Markdown, Text) in ChatGPT, invoke `import_attachment_file`.
   - The client delivers an authenticated file reference (`download_url`, `file_id`, `file_name`, `mime_type`).
   - The service securely fetches the attachment via HTTPS with SSRF checks, extracts text, preserves the original binary with SHA-256 in the file store, and creates a persistent versioned educational material.
   - Never supply arbitrary server filesystem paths to remote MCP tools.

3. **Pedagogical Content Generation:**
   - `generate_lesson_plan`: Generates a structured lesson plan with objectives, timeline, activities, and required prerequisites.
   - `generate_teacher_script`: Generates a detailed script for the teacher including timecodes, pedagogical hooks, board notes (`[BOARD_NOTE]`), and student questions/answers.
   - `generate_student_material`: Generates canonical notes and handouts for students. Teacher-only solutions are strictly filtered in the application layer.
   - `generate_exercises`: Generates formative practice exercises with varying difficulty levels.
   - `revise_material`: Iteratively revises existing material based on teacher feedback.
   - `regenerate_section`: Selectively rewrites specific sections while preserving the rest of the material.

4. **Assessment & Grading:**
   - `generate_assessment_draft`: Prepares a formal assessment draft with teacher-only solutions (`[TEACHER_ONLY_SOLUTION]`), anchored to a published student material version.
   - `authorize_assessable`: Promotes a verified draft to formal assessable material.
   - `create_assessment`: Configures an assessment session with scoring rubrics and total points.
   - `import_submission`: Ingests student responses.
   - `grade_submission`: Evaluates student submissions against rubric criteria and teacher solutions.

5. **Exporting Materials:**
   - Call `export_material_file` with format `markdown`, `docx`, `pdf`, `html`, or `json`.
