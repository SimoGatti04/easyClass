/**
 * Teacher Service — Domain & Application Error Definitions
 */

export class TeacherServiceError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: this.name,
      code: this.code,
      message: this.message,
      details: this.details
    };
  }
}

export class NotFoundError extends TeacherServiceError {
  constructor(resource, id) {
    super(`${resource} with ID '${id}' was not found`, 'NOT_FOUND', { resource, id });
  }
}

export class ValidationError extends TeacherServiceError {
  constructor(message, fields = {}) {
    super(message, 'VALIDATION_ERROR', { fields });
  }
}

export class ConflictError extends TeacherServiceError {
  constructor(message, details = {}) {
    super(message, 'CONFLICT', details);
  }
}

export class AuthorizationError extends TeacherServiceError {
  constructor(message = 'Access denied', details = {}) {
    super(message, 'UNAUTHORIZED', details);
  }
}

export class AIServiceError extends TeacherServiceError {
  constructor(message, codeOrDetails = 'AI_SERVICE_ERROR', details = {}) {
    // Provider adapters pass a stable error code as the second argument and
    // diagnostic details as the third. Preserve the generic two-argument
    // details form for callers that do not need a specialized code.
    const code = typeof codeOrDetails === 'string' ? codeOrDetails : 'AI_SERVICE_ERROR';
    const resolvedDetails = typeof codeOrDetails === 'string' ? details : codeOrDetails;
    super(message, code, resolvedDetails);
  }
}

export class SecurityError extends TeacherServiceError {
  constructor(message = "Security violation", details = {}) {
    super(message, "SECURITY_ERROR", details);
  }
}
