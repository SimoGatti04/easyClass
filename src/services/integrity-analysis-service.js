import crypto from 'node:crypto';
import { AuthorizationError, ConflictError, ValidationError } from '../core/errors.js';

const ANALYSIS_VERSION = 'c6-deterministic-1';
const MIN_TEXT_WORDS = 8;
const MIN_EXACT_RESPONSE_WORDS = 16;
const SHARED_PHRASE_WORDS = 5;
const MIN_CONTENT_WORDS = 3;
const MIN_CODE_TOKENS = 12;
const REVIEW_DECISIONS = new Set(['pending', 'reviewed_no_action', 'needs_follow_up']);
const STOP_WORDS = new Set([
  'a', 'ad', 'al', 'alla', 'alle', 'allo', 'ai', 'agli', 'anche', 'che', 'chi', 'ci', 'coi', 'con', 'da', 'dal', 'dalla', 'dalle', 'dello',
  'dei', 'del', 'della', 'delle', 'di', 'e', 'ed', 'è', 'era', 'essere', 'gli', 'ha', 'hanno', 'i', 'il', 'in', 'io', 'la', 'le', 'lo',
  'ma', 'nei', 'nel', 'nella', 'nelle', 'no', 'non', 'o', 'per', 'perché', 'più', 'quale', 'quando', 'si', 'sono', 'su', 'sul', 'sulla',
  'tra', 'un', 'una', 'uno', 'the', 'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'of', 'on', 'or',
  'that', 'the', 'this', 'to', 'was', 'were', 'with'
]);

const JS_KEYWORDS = new Set('async await break case catch class const continue debugger default delete do else export extends false finally for from function get if import in instanceof let new null of return set static super switch this throw true try typeof var void while with yield'.split(' '));
const PY_KEYWORDS = new Set('and as assert async await break class continue def del elif else except False finally for from global if import in is lambda nonlocal not or pass raise return True try while with yield None'.split(' '));
const CODE_LANGUAGES = new Map([
  ['js', 'javascript'], ['javascript', 'javascript'], ['jsx', 'javascript'],
  ['ts', 'typescript'], ['typescript', 'typescript'], ['tsx', 'typescript'],
  ['py', 'python'], ['python', 'python']
]);

function tokens(text) {
  return String(text || '').normalize('NFKC').toLocaleLowerCase('it').match(/[\p{L}\p{N}]+/gu) || [];
}

function contentWordCount(words) {
  return words.filter((word) => !STOP_WORDS.has(word) && !/^\d+$/.test(word)).length;
}

function containsWindow(haystack, window) {
  if (!window.length || window.length > haystack.length) return false;
  for (let start = 0; start <= haystack.length - window.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < window.length; offset += 1) {
      if (haystack[start + offset] !== window[offset]) { matches = false; break; }
    }
    if (matches) return true;
  }
  return false;
}

function sharedDistinctivePhrase(left, right, questionTokens, sourceTokens) {
  if (left.length < MIN_TEXT_WORDS || right.length < MIN_TEXT_WORDS) return null;
  const rightWindows = new Set();
  for (let i = 0; i <= right.length - SHARED_PHRASE_WORDS; i += 1) {
    rightWindows.add(right.slice(i, i + SHARED_PHRASE_WORDS).join(' '));
  }
  let best = null;
  for (let i = 0; i <= left.length - SHARED_PHRASE_WORDS; i += 1) {
    const phrase = left.slice(i, i + SHARED_PHRASE_WORDS);
    const key = phrase.join(' ');
    if (!rightWindows.has(key) || contentWordCount(phrase) < MIN_CONTENT_WORDS) continue;
    if (containsWindow(questionTokens, phrase) || containsWindow(sourceTokens, phrase)) continue;
    const distinctContentWords = new Set(phrase.filter((word) => !STOP_WORDS.has(word)));
    if (!best || distinctContentWords.size > best.distinctContentWords) {
      best = { key, words: phrase, distinctContentWords: distinctContentWords.size };
    }
  }
  return best;
}

function codeLanguage(language) {
  return CODE_LANGUAGES.get(String(language || '').trim().toLowerCase()) || null;
}

// This is intentionally a lexical normalizer, not an AST parser. It removes
// comments and literal/identifier spelling for a small, declared language set.
function tokenizeCode(source, language) {
  const normalizedLanguage = codeLanguage(language);
  if (!normalizedLanguage) return null;
  const keywords = normalizedLanguage === 'python' ? PY_KEYWORDS : JS_KEYWORDS;
  const text = String(source || '');
  const result = [];
  let i = 0;
  const isIdentifierStart = (char) => /[A-Za-z_$]/.test(char || '');
  const isIdentifierPart = (char) => /[A-Za-z0-9_$]/.test(char || '');
  const operators = ['===', '!==', '>>>', '**=', '...', '=>', '==', '!=', '<=', '>=', '++', '--', '+=', '-=', '*=', '/=', '&&', '||', '??', '?.', '**', '//', '<<', '>>', '%=', '&=', '|=', '^='];

  while (i < text.length) {
    const char = text[i];
    if (/\s/.test(char)) { i += 1; continue; }
    if (normalizedLanguage === 'python' && char === '#') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (normalizedLanguage !== 'python' && char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i += 1;
      continue;
    }
    if (normalizedLanguage !== 'python' && char === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i += 1;
      i = Math.min(text.length, i + 2);
      continue;
    }

    if (char === "'" || char === '"' || (char === '`' && normalizedLanguage !== 'python')) {
      const quote = char;
      const triple = normalizedLanguage === 'python' && text.slice(i, i + 3) === quote.repeat(3);
      i += triple ? 3 : 1;
      while (i < text.length) {
        if (text[i] === '\\') { i += 2; continue; }
        if (triple && text.slice(i, i + 3) === quote.repeat(3)) { i += 3; break; }
        if (!triple && text[i] === quote) { i += 1; break; }
        i += 1;
      }
      result.push('<STRING>');
      continue;
    }

    if (isIdentifierStart(char)) {
      const start = i++;
      while (i < text.length && isIdentifierPart(text[i])) i += 1;
      const word = text.slice(start, i);
      result.push(keywords.has(word) ? `kw:${word}` : '<IDENT>');
      continue;
    }
    if (/\d/.test(char)) {
      i += 1;
      while (i < text.length && /[\w.]/.test(text[i])) i += 1;
      result.push('<NUMBER>');
      continue;
    }
    const operator = operators.find((candidate) => text.startsWith(candidate, i));
    if (operator) { result.push(operator); i += operator.length; continue; }
    result.push(char);
    i += 1;
  }
  return result;
}

function codeBlocks(text) {
  return [...String(text || '').matchAll(/```[^\n]*\n([\s\S]*?)```/g)].map((match) => match[1]);
}

function removeStarterPrefix(answerTokens, starterTokens) {
  if (!starterTokens?.length || answerTokens.length < starterTokens.length) return answerTokens;
  const startsWithStarter = starterTokens.every((token, index) => answerTokens[index] === token);
  if (!startsWithStarter) return answerTokens;
  return answerTokens.slice(starterTokens.length);
}

function excerpt(text, length = 240) {
  const value = String(text || '').trim();
  return value.length <= length ? value : `${value.slice(0, length).trimEnd()}…`;
}

function stableEvidenceId(payload) {
  const digest = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 28);
  return `ie-${digest}`;
}

function studentIdentity(submission) {
  return {
    submissionId: submission.id,
    studentId: submission.student_id,
    studentName: submission.student_name || submission.student_id
  };
}

function normalizedAnswerHash(answer) {
  return crypto.createHash('sha256').update(String(answer || '').normalize('NFKC').trim()).digest('hex');
}

export class IntegrityAnalysisService {
  constructor({ dbManager, assessmentService, materialService }) {
    this.dbManager = dbManager;
    this.assessmentService = assessmentService;
    this.materialService = materialService;
  }

  analyzeAssessment(assessmentId) {
    const assessment = this.assessmentService.getAssessment(assessmentId, { role: 'teacher', includeTeacherSolutions: true });
    const submitted = this.assessmentService.listSubmissions(assessmentId)
      .filter((submission) => submission.attempt_status === 'submitted' && submission.status !== 'withdrawn_by_teacher');
    const fullSubmissions = submitted.map((submission) => this.assessmentService.getSubmission(submission.id));
    const sourceByItem = new Map();
    const limitations = new Set([
      'L’analisi testuale è deterministica e lessicale: non rileva parafrasi o somiglianze semantiche non testuali.',
      'I riscontri sono osservazioni da esaminare; non rappresentano probabilità, prova di copiatura o decisioni disciplinari.',
      'Risposte brevi identiche sono intenzionalmente escluse; definizioni standard e formulazioni richieste possono comunque richiedere il giudizio del docente.',
      'Nessun elaborato o identificativo studente viene inviato a servizi AI o di ricerca Web.'
    ]);

    for (const item of assessment.items) {
      if (item.type === 'code') {
        if (!codeLanguage(item.language)) {
          limitations.add(`Quesito ${item.order_index + 1}: il linguaggio “${item.language || 'non specificato'}” non dispone di confronto strutturale in questo checkpoint; nessun AST viene dichiarato.`);
        } else {
          limitations.add(`Quesito ${item.order_index + 1}: codice analizzato con normalizzazione lessicale per ${codeLanguage(item.language)}, non con parser AST.`);
        }
      }
      if (item.type === 'attachment') {
        limitations.add(`Quesito ${item.order_index + 1}: il contenuto binario degli allegati non viene estratto né confrontato.`);
      }
      if (!item.assessable_source_id || !Number.isInteger(Number(item.assessable_source_version))) continue;
      try {
        const isAssessable = this.materialService.isVersionAssessable(
          item.assessable_source_id,
          Number(item.assessable_source_version),
          { lessonId: assessment.lesson_id || null }
        );
        if (!isAssessable) {
          limitations.add(`Quesito ${item.order_index + 1}: la versione didattica associata non è attualmente pubblicata/assessabile; non viene usata nel confronto.`);
          continue;
        }
        const source = this.materialService.getMaterial(
          item.assessable_source_id,
          Number(item.assessable_source_version),
          { role: 'student', includeTeacherSolutions: false }
        );
        sourceByItem.set(item.id, {
          id: item.assessable_source_id,
          version: Number(item.assessable_source_version),
          title: source.title,
          content: source.version_details?.content_text ?? source.content_text ?? source.content ?? ''
        });
      } catch {
        limitations.add(`Quesito ${item.order_index + 1}: la versione didattica associata non è disponibile; non viene usata nel confronto.`);
      }
    }

    const responseBySubmission = new Map();
    for (const submission of fullSubmissions) {
      responseBySubmission.set(submission.id, new Map((submission.responses || []).map((response) => [response.item_id, response])));
    }

    const seatContexts = this._seatContexts(fullSubmissions);
    const evidenceGroups = new Map();
    const sourceContexts = [];
    const itemsById = new Map(assessment.items.map((item) => [item.id, item]));

    for (const item of assessment.items) {
      const source = sourceByItem.get(item.id);
      const sourceWords = tokens(source?.content || '');
      const questionWords = tokens(item.question_text || '');
      const responses = fullSubmissions.map((submission) => ({
        submission,
        response: responseBySubmission.get(submission.id)?.get(item.id) || null
      })).filter(({ response }) => response && (String(response.response_text || '').trim() || response.attachment_path));

      for (const { submission, response } of responses) {
        if (!source || !response.response_text || item.type === 'code') continue;
        const answerWords = tokens(response.response_text);
        if (answerWords.length < SHARED_PHRASE_WORDS) continue;
        const match = this._bestSourcePhrase(answerWords, sourceWords);
        if (!match || containsWindow(questionWords, match.words)) continue;
        sourceContexts.push({
          id: stableEvidenceId({ analysis: ANALYSIS_VERSION, assessmentId, kind: 'published_source_overlap', itemId: item.id, submissionId: submission.id, sourceId: source.id, version: source.version, answerHash: normalizedAnswerHash(response.response_text), match: match.key }),
          kind: 'published_source_overlap',
          itemId: item.id,
          question: item.question_text,
          student: studentIdentity(submission),
          source: { id: source.id, title: source.title, version: source.version },
          sharedExcerpt: match.key,
          interpretation: 'La risposta riprende una porzione del materiale didattico pubblicato e associato alla prova. Questo è un contesto di studio legittimo, non un indicatore di copiatura.'
        });
      }

      if (item.type === 'code') {
        const language = codeLanguage(item.language);
        if (!language) continue;
        const starter = item.starter_code || codeBlocks(item.question_text)[0] || '';
        const starterTokens = tokenizeCode(starter, language) || [];
        const expectedCode = [...codeBlocks(source?.content || ''), ...codeBlocks(item.question_text || ''), starter]
          .map((block) => tokenizeCode(block, language))
          .filter((value) => value?.length >= MIN_CODE_TOKENS);
        const codeResponses = responses.map(({ submission, response }) => ({
          submission,
          response,
          canonical: removeStarterPrefix(tokenizeCode(response.response_text, language) || [], starterTokens)
        })).filter((entry) => entry.canonical.length >= MIN_CODE_TOKENS);
        const groups = new Map();
        for (const entry of codeResponses) {
          if (expectedCode.some((expected) => JSON.stringify(expected) === JSON.stringify(entry.canonical))) {
            const matchedBlock = [...codeBlocks(source?.content || ''), ...codeBlocks(item.question_text || ''), starter]
              .find((block) => JSON.stringify(tokenizeCode(block, language)) === JSON.stringify(entry.canonical));
            if (source && matchedBlock && codeBlocks(source.content).includes(matchedBlock)) {
              sourceContexts.push({
                id: stableEvidenceId({ analysis: ANALYSIS_VERSION, assessmentId, kind: 'published_source_code_overlap', itemId: item.id, submissionId: entry.submission.id, sourceId: source.id, version: source.version, answerHash: normalizedAnswerHash(entry.response.response_text) }),
                kind: 'published_source_overlap', itemId: item.id, question: item.question_text,
                student: studentIdentity(entry.submission), source: { id: source.id, title: source.title, version: source.version },
                sharedExcerpt: excerpt(matchedBlock, 180),
                interpretation: 'La struttura coincide con codice contenuto nel materiale didattico pubblicato associato alla prova; il riuso didattico previsto è una spiegazione legittima.'
              });
            }
            continue;
          }
          const key = entry.canonical.join(' ');
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(entry);
        }
        for (const [shape, group] of groups) {
          if (group.length < 2) continue;
          const normalizedShape = shape.split(' ');
          const submissionIds = group.map((entry) => entry.submission.id).sort();
          const evidenceId = stableEvidenceId({
            analysis: ANALYSIS_VERSION, assessmentId, kind: 'shared_code_token_shape', itemId: item.id,
            submissionIds, answerHashes: group.map((entry) => normalizedAnswerHash(entry.response.response_text)).sort(), shapeHash: crypto.createHash('sha256').update(shape).digest('hex')
          });
          evidenceGroups.set(evidenceId, {
            id: evidenceId,
            kind: 'shared_code_token_shape',
            itemId: item.id,
            question: item.question_text,
            attempts: group.map((entry) => ({ ...studentIdentity(entry.submission), excerpt: excerpt(entry.response.response_text) })),
            method: `Tokenizzazione lessicale normalizzata (${language}); identificatori e letterali sostituiti da segnaposto, commenti esclusi. Non è un AST.`,
            observedPattern: excerpt(normalizedShape.slice(0, 18).join(' '), 180),
            interpretation: 'È stata osservata la stessa sequenza lessicale dopo la normalizzazione di nomi e letterali. Codice iniziale condiviso, struttura richiesta dalla consegna o materiale didattico possono spiegare il riscontro; il docente deve verificarlo.',
            seatContext: this._seatForSubmissions(seatContexts, submissionIds),
            sourceContext: source ? { id: source.id, title: source.title, version: source.version } : null
          });
        }
        continue;
      }

      if (!['open_question', 'open_short', 'open_extended', 'problem_case', 'practical_problem'].includes(item.type)) continue;
      const nonEmpty = responses.filter(({ response }) => tokens(response.response_text).length >= MIN_TEXT_WORDS);
      for (let i = 0; i < nonEmpty.length; i += 1) {
        for (let j = i + 1; j < nonEmpty.length; j += 1) {
          const left = nonEmpty[i];
          const right = nonEmpty[j];
          const leftWords = tokens(left.response.response_text);
          const rightWords = tokens(right.response.response_text);
          const sourceMatchA = source ? this._bestSourcePhrase(leftWords, sourceWords) : null;
          const sourceMatchB = source ? this._bestSourcePhrase(rightWords, sourceWords) : null;
          const exact = leftWords.join(' ') === rightWords.join(' ');
          let phrase = null;
          let kind = 'shared_distinctive_phrase';
          if (exact) {
            // Short identical answers are common in standard definitions and
            // constrained prompts, so report only extended responses. This is
            // a conservative exclusion rule, not a suspicion score.
            if (leftWords.length < MIN_EXACT_RESPONSE_WORDS) continue;
            const fullAnswerIsExpected = containsWindow(questionWords, leftWords) || containsWindow(sourceWords, leftWords);
            if (fullAnswerIsExpected) continue;
            phrase = { key: leftWords.slice(0, Math.min(leftWords.length, 12)).join(' ') };
            kind = 'identical_extended_response';
          } else {
            phrase = sharedDistinctivePhrase(leftWords, rightWords, questionWords, sourceWords);
          }
          if (!phrase) continue;
          const participantIds = [left.submission.id, right.submission.id].sort();
          const phraseKey = phrase.key;
          const answerHashes = [normalizedAnswerHash(left.response.response_text), normalizedAnswerHash(right.response.response_text)].sort();
          const id = stableEvidenceId({ analysis: ANALYSIS_VERSION, assessmentId, kind, itemId: item.id, participantIds, answerHashes, phraseHash: crypto.createHash('sha256').update(phraseKey).digest('hex') });
          evidenceGroups.set(id, {
            id, kind, itemId: item.id, question: item.question_text,
            attempts: [left, right].map(({ submission, response }) => ({ ...studentIdentity(submission), excerpt: exact ? excerpt(response.response_text) : phraseKey })),
            matchedExcerpt: phraseKey,
            method: exact ? 'Confronto esatto del testo normalizzato' : `Confronto di sequenze consecutive di ${SHARED_PHRASE_WORDS} parole con almeno ${MIN_CONTENT_WORDS} termini informativi; esclusi prompt e fonte didattica associata.`,
            interpretation: exact
              ? 'Le risposte estese coincidono dopo la normalizzazione testuale. La coincidenza è un fatto osservato; possono esistere spiegazioni legittime e non costituisce una conclusione.'
              : 'È condivisa una sequenza testuale non presente nella traccia o nella versione didattica associata. Il riscontro può avere spiegazioni alternative; non costituisce prova di copiatura.',
            seatContext: this._seatForSubmissions(seatContexts, participantIds),
            sourceContext: source && (sourceMatchA || sourceMatchB) ? { id: source.id, title: source.title, version: source.version, overlapObserved: true } : null
          });
        }
      }
    }

    const decisions = this._reviewHistoryByEvidence(assessmentId);
    const evidence = [...evidenceGroups.values()].map((entry) => {
      const history = decisions.get(entry.id) || [];
      const latest = history.at(-1) || null;
      return {
        ...entry,
        review: {
          decision: latest?.decision || 'pending',
          note: latest?.note || '',
          actor: latest?.actor || null,
          updatedAt: latest?.created_at || null,
          history
        }
      };
    }).sort((a, b) => {
      const aOrder = itemsById.get(a.itemId)?.order_index ?? 0;
      const bOrder = itemsById.get(b.itemId)?.order_index ?? 0;
      return aOrder - bOrder || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
    });

    return {
      analysisVersion: ANALYSIS_VERSION,
      generatedAt: new Date().toISOString(),
      assessment: { id: assessment.id, title: assessment.title, version: assessment.version, status: assessment.status },
      scope: { submittedAttempts: fullSubmissions.length, itemsAnalyzed: assessment.items.length },
      evidence,
      sourceContexts,
      seatContexts,
      limitations: [...limitations],
      decisionPolicy: 'Le riscontri non modificano punteggi o valutazioni e non determinano colpa o sanzioni. Ogni decisione resta del docente.'
    };
  }

  recordReview({ assessmentId, evidenceId, decision, note = '', actor, idempotencyKey }) {
    if (!actor || typeof actor !== 'string' || !actor.trim()) {
      throw new AuthorizationError('A verified teacher principal is required to record an integrity review');
    }
    if (!REVIEW_DECISIONS.has(decision)) throw new ValidationError(`decision must be one of: ${[...REVIEW_DECISIONS].join(', ')}`);
    if (typeof note !== 'string') throw new ValidationError('note must be a string');
    const normalizedNote = note.trim();
    if (normalizedNote.length > 2000) throw new ValidationError('note must not exceed 2000 characters');
    if (!idempotencyKey || typeof idempotencyKey !== 'string' || idempotencyKey.trim().length < 8 || idempotencyKey.length > 200) {
      throw new ValidationError('A stable idempotencyKey between 8 and 200 characters is required');
    }
    if (typeof assessmentId !== 'string' || !assessmentId || typeof evidenceId !== 'string' || !evidenceId) {
      throw new ValidationError('assessmentId and evidenceId are required');
    }

    const normalizedActor = actor.trim();
    const normalizedKey = idempotencyKey.trim();
    const existing = this.dbManager.prepare(`
      SELECT * FROM integrity_review_events WHERE assessment_id = ? AND evidence_id = ? AND idempotency_key = ?
    `).get(assessmentId, evidenceId, normalizedKey);
    if (existing) return this._returnIdempotentReview(existing, { decision, note: normalizedNote, actor: normalizedActor });

    const report = this.analyzeAssessment(assessmentId);
    const evidence = report.evidence.find((entry) => entry.id === evidenceId);
    if (!evidence) throw new ConflictError('The evidence is no longer present in the current assessment analysis');

    const now = new Date().toISOString();
    const event = {
      id: `ire-${crypto.randomUUID()}`,
      assessment_id: assessmentId,
      evidence_id: evidenceId,
      evidence_type: evidence.kind,
      item_id: evidence.itemId,
      submission_ids_json: JSON.stringify(evidence.attempts.map((attempt) => attempt.submissionId).sort()),
      analysis_version: report.analysisVersion,
      decision,
      note: normalizedNote,
      actor: normalizedActor,
      idempotency_key: normalizedKey,
      created_at: now
    };
    const persisted = this.dbManager.transaction(() => {
      this.dbManager.prepare(`
        INSERT INTO integrity_review_events
          (id, assessment_id, evidence_id, evidence_type, item_id, submission_ids_json, analysis_version, decision, note, actor, idempotency_key, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (assessment_id, evidence_id, idempotency_key) DO NOTHING
      `).run(event.id, event.assessment_id, event.evidence_id, event.evidence_type, event.item_id,
        event.submission_ids_json, event.analysis_version, event.decision, event.note, event.actor, event.idempotency_key, event.created_at);
      return this.dbManager.prepare(`
        SELECT * FROM integrity_review_events WHERE assessment_id = ? AND evidence_id = ? AND idempotency_key = ?
      `).get(assessmentId, evidenceId, normalizedKey);
    });
    return this._returnIdempotentReview(persisted, { decision, note: normalizedNote, actor: normalizedActor });
  }

  _returnIdempotentReview(event, requested) {
    if (!event) throw new ConflictError('The integrity review could not be persisted');
    if (event.decision !== requested.decision || event.note !== requested.note || event.actor !== requested.actor) {
      throw new ConflictError('The idempotency key was already used for a different integrity review');
    }
    return event;
  }

  getReviewHistory(assessmentId, evidenceId) {
    this.assessmentService.getAssessment(assessmentId, { role: 'teacher', includeTeacherSolutions: true });
    return this._reviewHistoryByEvidence(assessmentId).get(evidenceId) || [];
  }

  _reviewHistoryByEvidence(assessmentId) {
    const events = this.dbManager.prepare(`
      SELECT id, assessment_id, evidence_id, evidence_type, item_id, submission_ids_json,
             analysis_version, decision, note, actor, created_at
      FROM integrity_review_events WHERE assessment_id = ? ORDER BY created_at ASC, rowid ASC
    `).all(assessmentId);
    const grouped = new Map();
    for (const event of events) {
      if (!grouped.has(event.evidence_id)) grouped.set(event.evidence_id, []);
      grouped.get(event.evidence_id).push(event);
    }
    return grouped;
  }

  _bestSourcePhrase(answerWords, sourceWords) {
    let best = null;
    for (let i = 0; i <= answerWords.length - SHARED_PHRASE_WORDS; i += 1) {
      const phrase = answerWords.slice(i, i + SHARED_PHRASE_WORDS);
      if (contentWordCount(phrase) < MIN_CONTENT_WORDS || !containsWindow(sourceWords, phrase)) continue;
      const contentCount = new Set(phrase.filter((word) => !STOP_WORDS.has(word))).size;
      if (!best || contentCount > best.contentCount) best = { key: phrase.join(' '), words: phrase, contentCount };
    }
    return best;
  }

  _seatContexts(submissions) {
    const contexts = [];
    for (let i = 0; i < submissions.length; i += 1) {
      for (let j = i + 1; j < submissions.length; j += 1) {
        const left = submissions[i];
        const right = submissions[j];
        const sameRow = Boolean(left.seat_row && right.seat_row && left.seat_row === right.seat_row);
        const leftDesk = Number(left.seat_desk);
        const rightDesk = Number(right.seat_desk);
        const adjacentByPosition = sameRow && Number.isFinite(leftDesk) && Number.isFinite(rightDesk) && Math.abs(leftDesk - rightDesk) === 1;
        const adjacentByDeclaration = left.right_neighbor_id === right.student_id || left.left_neighbor_id === right.student_id ||
          right.right_neighbor_id === left.student_id || right.left_neighbor_id === left.student_id;
        if (!adjacentByPosition && !adjacentByDeclaration) continue;
        contexts.push({
          id: stableEvidenceId({ analysis: ANALYSIS_VERSION, assessmentId: left.assessment_id, kind: 'seat_proximity_context', participants: [left.id, right.id].sort() }),
          kind: 'seat_proximity_context',
          attempts: [studentIdentity(left), studentIdentity(right)],
          relation: adjacentByPosition ? 'adjacent_seats' : 'declared_neighbor',
          positions: [left, right].map((submission) => ({ row: submission.seat_row || null, desk: submission.seat_desk || null })),
          interpretation: 'La vicinanza è solo contesto logistico: non è un riscontro di copiatura e non produce decisioni automatiche.'
        });
      }
    }
    return contexts;
  }

  _seatForSubmissions(contexts, submissionIds) {
    const target = new Set(submissionIds);
    return contexts.filter((context) => context.attempts.every((attempt) => target.has(attempt.submissionId)));
  }
}

export { ANALYSIS_VERSION, REVIEW_DECISIONS };
