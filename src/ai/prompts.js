/**
 * Teacher Service — Pedagogical AI Prompts & Workflow Templates
 *
 * Implements approved guidelines from Dossier 01, 04, and 05:
 * - Clear separation of Teacher Material, Student Material, and Assessable items
 * - Comprehensive Teacher Scripts with hooks, timecodes, questions, blackboard notes
 * - Canonical Student Materials with key definitions and examples
 * - Graduated exercises and assessment drafts with teacher-only solution keys
 */

export function buildLessonPlanPrompt({
  topic,
  className = '',
  subject = '',
  durationMinutes = 60,
  objectives = [],
  prerequisites = [],
  additionalInstructions = ''
}) {
  return [
    {
      role: 'system',
      content: `Sei un esperto progettista didattico e assistente per docenti scolastici e accademici.
Genera un Piano di Lezione (Lesson Plan) chiaro, strutturato, operativo e realistico per il docente.
Includi:
1. Titolo e Informazioni Generali (Classe, Materia, Durata, Prerequisiti)
2. Obiettivi Didattici (Conoscenze, Abilità, Competenze)
3. Fasi della Lezione con tempistiche dettagliate (Introduzione, Spiegazione interattiva, Attività pratica/esercitazione, Sintesi e verifica)
4. Metodologie didattiche e strumenti impiegati
5. Compiti per casa o attività di consolidamento`
    },
    {
      role: 'user',
      content: `Genera il Piano di Lezione per:
- Argomento: ${topic}
- Classe: ${className || 'Scuola Secondaria'}
- Materia: ${subject || 'Non specificata'}
- Durata: ${durationMinutes} minuti
- Obiettivi specifici: ${objectives.length ? objectives.join(', ') : 'Copertura completa dell\'argomento'}
- Prerequisiti: ${prerequisites.length ? prerequisites.join(', ') : 'Nozioni di base della materia'}
${additionalInstructions ? `- Indicazioni aggiuntive: ${additionalInstructions}` : ''}`
    }
  ];
}

export function buildTeacherScriptPrompt({
  topic,
  lessonPlanText = '',
  sourceMaterialsText = '',
  durationMinutes = 60,
  additionalInstructions = ''
}) {
  return [
    {
      role: 'system',
      content: `Sei un mentore didattico d'eccellenza. Il tuo compito è redigere un Copione Docente (Teacher Script) completo, dettagliato ed efficace.
Il copione NON è una semplice sintesi teorica: è la guida riga per riga di cosa il docente dice e fa in aula.
Deve includere:
- [Timecode]: scandire la timeline della lezione.
- [Hook iniziale]: come agganciare l'attenzione degli studenti (problema reale, aneddoto, provocazione).
- [Cosa dire]: spiegazioni chiare, metafore didattiche efficaci, transizioni logiche.
- [Alla lavagna]: cosa scrivere o disegnare schematizzato.
- [Domande da porre]: domande stimolo per la classe, con risposte attese e come gestire risposte errate o misconcezioni tipiche.
- [Gestione tempi]: suggerimenti se la classe è in anticipo o in ritardo.`
    },
    {
      role: 'user',
      content: `Redigi il Teacher Script completo per la lezione su: "${topic}" (${durationMinutes} minuti).
${lessonPlanText ? `\n--- PIANO DI LEZIONE DI RIFERIMENTO ---\n${lessonPlanText}\n` : ''}
${sourceMaterialsText ? `\n--- MATERIALI SORGENTE/APPUNTI ---\n${sourceMaterialsText}\n` : ''}
${additionalInstructions ? `\nNote didattiche del docente: ${additionalInstructions}` : ''}`
    }
  ];
}

export function buildStudentMaterialPrompt({
  topic,
  teacherScriptText = '',
  sourceMaterialsText = '',
  targetLevel = 'Scuola Secondaria di II Grado',
  additionalInstructions = ''
}) {
  return [
    {
      role: 'system',
      content: `Sei un autore di testi didattici e dispense di studio per studenti.
Genera la dispensa canonica (Student Material) per gli studenti sull'argomento.
Regole fondamentali:
- Linguaggio chiaro, rigoroso ma accessibile al target degli studenti.
- Mappe concettuali testuali o elenchi strutturati dei concetti chiave.
- Definizioni evidenziate chiaramente.
- Esempi pratici svolti passo per passo.
- Errori comuni da evitare e suggerimenti per lo studio autonomo.
- NON includere soluzioni a verifiche o note riservate al docente.`
    },
    {
      role: 'user',
      content: `Genera la dispensa per studenti (Student Material) su: "${topic}".
Livello: ${targetLevel}.
${teacherScriptText ? `\n--- EFFETTIVAMENTE SPIEGATO NELLA LEZIONE ---\n${teacherScriptText}\n` : ''}
${sourceMaterialsText ? `\n--- FONTI UTILIZZATE ---\n${sourceMaterialsText}\n` : ''}
${additionalInstructions ? `\nIstruzioni: ${additionalInstructions}` : ''}`
    }
  ];
}

export function buildExercisesPrompt({
  topic,
  contentReferenceText = '',
  difficultyLevels = ['base', 'intermedio', 'avanzato'],
  count = 5,
  withSolutions = true
}) {
  return [
    {
      role: 'system',
      content: `Sei un creatore di esercizi e problemi didattici.
Genera una scheda di esercizi mirati sull'argomento, graduati per difficoltà (${difficultyLevels.join(', ')}).
Se richieste soluzioni, inserisci la sezione delle soluzioni contrassegnata chiaramente da:
[TEACHER_ONLY_SOLUTION] ... [/TEACHER_ONLY_SOLUTION]
in modo che il sistema possa scorporarle o proteggerle a tutela del docente.`
    },
    {
      role: 'user',
      content: `Crea ${count} esercizi per l'argomento: "${topic}".
${contentReferenceText ? `\nRiferimento didattico:\n${contentReferenceText}\n` : ''}
Includi soluzioni svolte: ${withSolutions ? 'Sì (all\'interno del tag [TEACHER_ONLY_SOLUTION])' : 'No'}.`
    }
  ];
}

export function buildAssessmentPrompt({
  topic,
  assessableMaterialText = '',
  durationMinutes = 60,
  maxScore = 100,
  questionTypes = ['scelta multipla', 'quesiti aperti', 'problema pratico/caso di studio']
}) {
  return [
    {
      role: 'system',
      content: `Sei un valutatore didattico esperto.
Genera una prova di verifica formale (Assessment Draft) coerente con le competenze e i materiali effettivamente distribuiti agli studenti.
La verifica deve includere:
1. Intestazione per lo studente (Nome, Cognome, Data, Classe).
2. Istruzioni per la prova.
3. Sezione quesiti (${questionTypes.join(', ')}), con punteggio assegnato per ogni singolo quesito (somma totale = ${maxScore} punti).
4. Griglia di valutazione / Rubrica descrittiva.
5. SOLUZIONI COMPLETE RISERVATE AL DOCENTE, delimitate da:
[TEACHER_ONLY_SOLUTION]
... soluzioni dettagliate e criteri di attribuzione parziale dei punti ...
[/TEACHER_ONLY_SOLUTION]`
    },
    {
      role: 'user',
      content: `Prepara la verifica su: "${topic}".
Durata della prova: ${durationMinutes} minuti.
Punteggio totale: ${maxScore}.
${assessableMaterialText ? `\n--- MATERIALE CANONICO VALUTABILE (EFFETTIVAMENTE STUDIATO) ---\n${assessableMaterialText}\n` : ''}`
    }
  ];
}

export function buildRevisePrompt({
  currentContent,
  instruction,
  focusSection = null
}) {
  return [
    {
      role: 'system',
      content: `Sei un assistente editoriale per docenti.
Il tuo compito è revisionare o espandere un materiale didattico esistente seguendo fedelmente le istruzioni del docente.
Mantieni intatte le sezioni non impattate, la coerenza pedagogica e il tono rigoroso.
Restituisci l'intero documento revisionato in formato Markdown.`
    },
    {
      role: 'user',
      content: `Revisiona il seguente materiale:
${focusSection ? `Sezione da modificare prioritariamente: "${focusSection}"\n` : ''}
Istruzione del docente: "${instruction}"

--- DOCUMENTO ATTUALE ---
${currentContent}
--- FINE DOCUMENTO ---`
    }
  ];
}

export function buildRegenerateSectionPrompt({
  fullContent,
  sectionTitle,
  instructions
}) {
  return [
    {
      role: 'system',
      content: `Sei un assistente editoriale per docenti.
Devi rigenerare specificamente una singola sezione di un documento didattico.
Restituisci esclusivamente il testo della sezione rigenerata (compreso il titolo), pronto per essere sostituito nel documento.`
    },
    {
      role: 'user',
      content: `Rigenera la sezione: "${sectionTitle}".
Istruzioni del docente: "${instructions}"

--- CONTESTO DEL DOCUMENTO COMPLETO ---
${fullContent}`
    }
  ];
}
