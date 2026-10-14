/**
 * Teacher Service — OmniRoute AI Client Adapter
 *
 * Implements resilient, cancellable communication with OmniRoute / OpenAI-compatible endpoints.
 * Implements Domain Owner decisions:
 * - No artificial model quotas, allowlists, or arbitrary token limits
 * - Detailed error handling & diagnostics telemetry
 * - AbortController cancellation support
 * - Mock generation strictly isolated to test/development when explicitly requested
 * - Never silently present mock data as successful real AI generation
 */
import { AIServiceError } from '../core/errors.js';

export class OmniRouteClient {
  /**
   * @param {Object} [config]
   * @param {string} [config.baseUrl]
   * @param {string} [config.apiKey]
   * @param {string} [config.defaultModel]
   * @param {number} [config.timeoutMs]
   * @param {boolean} [config.mockOffline]
   */
  constructor({
    baseUrl = process.env.TEACHER_SERVICE_OMNIROUTE_BASE_URL || 'http://198.51.100.62:32128/v1',
    apiKey = process.env.TEACHER_SERVICE_OMNIROUTE_API_KEY || '',
    defaultModel = process.env.TEACHER_SERVICE_DEFAULT_MODEL || 'agy/gemini-3.8-flash-tiered',
    timeoutMs = 60000,
    mockOffline = process.env.TEACHER_SERVICE_MOCK_AI === 'true',
    fetchImpl = globalThis.fetch
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.timeoutMs = timeoutMs;
    this.mockOffline = Boolean(mockOffline);
    this.fetchImpl = fetchImpl;
  }

  /**
   * List available models from OmniRoute
   */
  async listModels({ signal } = {}) {
    if (this.mockOffline) {
      return [
        { id: 'agy/gemini-3.8-flash-tiered', name: 'Gemini 3.8 Flash (Mock)', provider: 'mock' },
        { id: 'cx/gpt-6-sol', name: 'GPT-6 Sol (Mock)', provider: 'mock' },
        { id: 'cx/gpt-6-luna', name: 'GPT-6 Luna (Mock)', provider: 'mock' }
      ];
    }

    if (!this.apiKey) {
      throw new AIServiceError('OmniRoute API key is not configured', 'MISSING_API_KEY');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const effectiveSignal = signal || controller.signal;

    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        signal: effectiveSignal
      });
      clearTimeout(timer);

      if (!resp.ok) {
        const errorText = await resp.text().catch(() => '');
        throw new AIServiceError(`Failed to fetch models from OmniRoute (${resp.status}): ${errorText}`, 'OMNIROUTE_API_ERROR', {
          status: resp.status
        });
      }

      const data = await resp.json();
      return Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data : []);
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new AIServiceError('Request to list models timed out or was aborted', 'ABORT_ERROR');
      }
      if (err instanceof AIServiceError) throw err;
      throw new AIServiceError(`OmniRoute models fetch error: ${err.message}`, 'OMNIROUTE_NETWORK_ERROR', {
        cause: err.message
      });
    }
  }

  /**
   * Complete chat prompt via OmniRoute / OpenAI compatible API
   *
   * @param {Object} options
   * @param {Array<{role: string, content: string}>} options.messages
   * @param {string} [options.model]
   * @param {number} [options.temperature]
   * @param {number} [options.maxTokens] - No artificial default cap
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{content: string, model: string, telemetry: Object, isMock: boolean}>}
   */
  async complete({
    messages,
    model = this.defaultModel,
    temperature = 0.7,
    maxTokens = undefined,
    signal = null
  }) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new AIServiceError('Valid messages array is required for AI completion', 'INVALID_MESSAGES');
    }

    // Explicit mock mode check - only allowed when mockOffline is explicitly true
    if (this.mockOffline) {
      return this._mockGenerate(messages, model);
    }

    if (!this.apiKey) {
      throw new AIServiceError('OmniRoute API key is required for real AI generation', 'MISSING_API_KEY');
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const effectiveSignal = signal || controller.signal;

    const bodyPayload = {
      model,
      messages,
      temperature
    };
    if (typeof maxTokens === 'number' && maxTokens > 0) {
      bodyPayload.max_tokens = maxTokens;
    }

    try {
      const resp = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        body: JSON.stringify(bodyPayload),
        signal: effectiveSignal
      });
      clearTimeout(timer);

      if (!resp.ok) {
        let errMessage = `HTTP ${resp.status} ${resp.statusText}`;
        try {
          const errJson = await resp.json();
          if (errJson?.error?.message) {
            errMessage = errJson.error.message;
          }
        } catch {
          const raw = await resp.text().catch(() => '');
          if (raw) errMessage = raw;
        }
        throw new AIServiceError(`OmniRoute generation failed (${resp.status}): ${errMessage}`, 'OMNIROUTE_API_ERROR', {
          status: resp.status,
          model
        });
      }

      const data = await resp.json();
      const durationMs = Date.now() - startTime;
      const rawContent = data.choices?.[0]?.message?.content;
      const content = typeof rawContent === 'string'
        ? rawContent
        : (Array.isArray(rawContent)
          ? rawContent.filter((part) => part?.type === 'text' && typeof part.text === 'string').map((part) => part.text).join('\n')
          : '');
      if (!content.trim()) {
        throw new AIServiceError('OmniRoute returned no textual completion content', 'OMNIROUTE_EMPTY_RESPONSE', { model });
      }

      const telemetry = {
        promptTokens: data.usage?.prompt_tokens ?? null,
        completionTokens: data.usage?.completion_tokens ?? null,
        totalTokens: data.usage?.total_tokens ?? null,
        durationMs,
        provider: 'omniroute',
        model: data.model || model,
        isMock: false
      };

      return {
        content,
        model: data.model || model,
        telemetry,
        isMock: false
      };
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        throw new AIServiceError('OmniRoute request aborted by client or timed out', 'ABORT_ERROR');
      }
      if (err instanceof AIServiceError) throw err;
      throw new AIServiceError(`OmniRoute generation failed: ${err.message}`, 'OMNIROUTE_NETWORK_ERROR', {
        cause: err.message,
        model
      });
    }
  }

  /**
   * Deterministic mock generator used strictly in offline test runs
   * @private
   */
  _mockGenerate(messages, model) {
    const lastMsg = messages[messages.length - 1]?.content || '';
    const sysMsg = messages.find(m => m.role === 'system')?.content || '';
    let generatedContent = '';

    if (sysMsg.includes('valutatore didattico') || lastMsg.includes('Prepara la verifica') || sysMsg.includes('Assessment Draft')) {
      generatedContent = `# Verifica Scritta Formale\n\nNome e Cognome: ______________________ Data: ________ Classe: _____\n\n## Sezione Quesiti\n\n1. [Quesito a scelta multipla - 20 punti]\nQuale affermazione descrive correttamente il vincolo in esame?\nA) Opzione non corretta\nB) Opzione corretta\nC) Opzione parziale\nD) Nessuna delle precedenti\n\n2. [Quesito aperto - 40 punti]\nDescrivi la metodologia operativa illustrata nel materiale valutabile.\n\n3. [Problema applicativo - 40 punti]\nRisolvi il caso pratico verificando la coerenza del risultato.\n\n---\n## Griglia di Valutazione (Rubrica)\n- Completezza e rigore: 40%\n- Correttezza tecnica: 40%\n- Chiarezza espositiva: 20%\n\n---\n[TEACHER_ONLY_SOLUTION]\n### Soluzioni Riservate al Docente\n1. Risposta corretta: B.\n2. Risposta attesa: Deve menzionare i passaggi chiave definiti nella dispensa v1.\n3. Criteri parziali quesito 3: 20 pt per impostazione, 20 pt per soluzione finale corretta.\n[/TEACHER_ONLY_SOLUTION]`;
    } else if (sysMsg.includes('valuta la risposta') || sysMsg.includes('valutatore rigoroso') || sysMsg.includes('correzione') || lastMsg.includes('valuta la risposta')) {
      const maxScoreMatch = sysMsg.match(/punteggio massimo è ([0-9]+(?:\.[0-9]+)?)/i);
      const maxScore = maxScoreMatch ? Number(maxScoreMatch[1]) : 10;
      const score = Math.min(8.5, maxScore);
      generatedContent = JSON.stringify({
        score,
        maxScore,
        confidence: 0.9,
        reasoning: 'La risposta dimostra solida comprensione dei concetti chiave con argomentazione chiara.',
        criteriaScores: [{ name: 'Correttezza concettuale', score, maxScore, evidence: 'Valutazione mock per test' }],
        feedback: "Valutazione simulata per test; richiede revisione docente."
      });
    } else if (sysMsg.includes('Lesson Plan') || lastMsg.includes('piano della lezione')) {
      generatedContent = `# Piano di Lezione Didattico\n\n## 1. Obiettivi di Apprendimento\n- Comprendere i concetti chiave trattati\n- Sviluppare capacità analitiche e applicative\n\n## 2. Prerequisiti Richiesti\n- Conoscenza delle lezioni precedenti\n\n## 3. Fasi della Lezione\n- **00-10m:** Introduzione, aggancio e ripasso\n- **10-35m:** Spiegazione interattiva con esempi applicativi\n- **35-50m:** Esercitazione guidata in aula\n- **50-60m:** Chiusura, verifica formativa e compiti`;
    } else if (sysMsg.includes('copione') || sysMsg.includes('Teacher Script') || lastMsg.includes('copione')) {
      generatedContent = `# Copione Docente Riga per Riga (Teacher Script)\n\n[00:00 - 05:00] Gancio Iniziale\nDocente: "Buongiorno ragazzi. Oggi affrontiamo un tema centrale del nostro percorso..."\n\n[05:00 - 25:00] Trattazione Principale e Lavagna\nNote alla lavagna:\n- Concetto 1: Definizione formale\n- Concetto 2: Applicazione pratica\n\nDomanda stimolo: "Quale criticità notate in questa struttura?"\nRisposta attesa studente: "Manca la coerenza tra i campi."\n\n[25:00 - 50:00] Esempio Guidato e Sintesi\nChiusura con verifica immediata della comprensione.`;
    } else if (sysMsg.includes('dispense di studio') || sysMsg.includes('Student Material') || lastMsg.includes('Genera la dispensa')) {
      generatedContent = `# Guida allo Studio e Dispensa per gli Studenti\n\n## Introduzione e Concetti Fondamentali\nLa presente dispensa riassume i concetti essenziali trattati nella lezione.\n\n## Definizioni Chiave\n1. Definizione primaria del principio didattico.\n2. Esempio contestuale di applicazione.\n\n## Esercizi di Autovalutazione\nRispondi alle domande al termine del capitolo per consolidare le competenze.`;
    } else if (sysMsg.includes('esercizi') || lastMsg.includes('esercizi')) {
      generatedContent = `# Scheda Esercizi Graduati\n\n### Esercizio 1 (Base)\nDefinisci il concetto fondamentale e fornisci un esempio elementare.\n\n### Esercizio 2 (Intermedio)\nAnalizza il caso di studio descritto e individua i punti di forza e debolezza.\n\n### Esercizio 3 (Avanzato)\nProgetta una soluzione completa che soddisfi tutti i vincoli esposti.\n\n### Soluzioni e Criteri\nSoluzioni complete fornite per il controllo individuale.`;
    } else {
      generatedContent = `Elaborazione didattica completata per la richiesta: ${lastMsg.slice(0, 100)}`;
    }

    return {
      content: generatedContent,
      model: model || 'mock/curriculum-engine',
      telemetry: {
        durationMs: 5,
        promptTokens: 120,
        completionTokens: 350,
        totalTokens: 470,
        provider: 'mock',
        model: model || 'mock/curriculum-engine',
        isMock: true
      },
      isMock: true
    };
  }
}
