import React, { createElement as h, useEffect, useState } from 'react';

async function readJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Richiesta non riuscita (${response.status})`);
  return body;
}

async function readOptionalList(url, key, label) {
  try {
    const result = await readJson(url);
    if (!Array.isArray(result[key])) return { items: [], error: label };
    return { items: result[key], error: null };
  } catch {
    return { items: [], error: label };
  }
}

function quantity(value, singular, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

function formatContext(item, maps) {
  const parts = [];
  if (item.class_id) parts.push(`Classe: ${maps.classes.get(item.class_id)?.name || 'non disponibile'}`);
  if (item.subject_id) parts.push(`Materia: ${maps.subjects.get(item.subject_id)?.name || 'non disponibile'}`);
  if (item.lesson_id) parts.push(`Lezione: ${maps.lessons.get(item.lesson_id)?.title || 'non disponibile'}`);
  return parts.length ? parts.join(' · ') : 'Classe o materia non associata';
}

function QueueSection({ id, title, description, items, emptyText, countUnit, countUnitPlural = countUnit, actionLabel, onAction, onViewAll }) {
  return h('section', { id, className: 'teacher-queue-section', 'aria-labelledby': `${id}-title` }, [
    h('div', { className: 'teacher-queue-heading', key: 'heading' }, [
      h('div', null, [
        h('h3', { id: `${id}-title` }, title),
        h('p', { className: 'text-muted text-sm' }, description)
      ]),
      h('span', { className: 'teacher-queue-total' }, quantity(items.length, countUnit, countUnitPlural))
    ]),
    items.length === 0
      ? h('p', { className: 'teacher-queue-empty text-muted', key: 'empty' }, emptyText)
      : h('ul', { className: 'teacher-queue-list', key: 'list' }, items.slice(0, 5).map(item =>
        h('li', { className: 'teacher-queue-item', key: item.id }, [
          h('div', { className: 'teacher-queue-item-copy' }, [
            h('strong', null, item.title),
            h('span', { className: 'teacher-queue-context' }, item.context),
            h('span', { className: 'teacher-queue-detail' }, item.detail)
          ]),
          h('button', {
            type: 'button',
            className: 'btn btn-secondary',
            'aria-label': `${actionLabel}: ${item.title}`,
            onClick: () => onAction(item)
          }, actionLabel)
        ])
      )),
    items.length > 5 && h('button', {
      key: 'view-all',
      type: 'button',
      className: 'btn btn-ghost teacher-queue-view-all',
      onClick: onViewAll
    }, 'Apri la coda completa')
  ]);
}

function AttentionQueue({ items, pendingActivityCount, activeActivityCount, onNavigate }) {
  return h('div', { className: 'teacher-attention-queue' }, [
    items.length === 0
      ? h('p', { className: 'teacher-queue-empty text-muted', key: 'empty' }, 'Nessuna verifica attiva o consegna in attesa di correzione.')
      : h('ul', { className: 'teacher-queue-list teacher-attention-list', key: 'list' }, items.slice(0, 5).map(item => h('li', {
        className: 'teacher-queue-item teacher-attention-item',
        key: item.id
      }, [
        h('div', { className: 'teacher-queue-item-copy', key: 'copy' }, [
          h('strong', { key: 'title' }, item.title),
          h('span', { className: 'teacher-queue-context', key: 'context' }, item.context),
          h('div', { className: 'teacher-attention-statuses', key: 'statuses' }, [
            item.pendingCorrectionCount > 0 && h('span', { className: 'teacher-attention-status teacher-attention-status-correction', key: 'correction' },
              quantity(item.pendingCorrectionCount, 'consegna da correggere', 'consegne da correggere')),
            item.isActive && h('span', { className: 'teacher-attention-status teacher-attention-status-monitoring', key: 'monitoring' },
              `${quantity(item.inProgressCount, 'tentativo in corso', 'tentativi in corso')} · ${quantity(item.submittedCount, 'consegna inviata', 'consegne inviate')}`)
          ])
        ]),
        h('div', { className: 'teacher-attention-actions', key: 'actions' }, [
          item.pendingCorrectionCount > 0 && h('button', {
            type: 'button',
            className: 'btn btn-secondary',
            'aria-label': `Correggi consegne: ${item.title}`,
            key: 'correct',
            onClick: () => onNavigate('submissions', item.id)
          }, 'Correggi'),
          item.isActive && h('button', {
            type: 'button',
            className: 'btn btn-secondary',
            'aria-label': `Monitora: ${item.title}`,
            key: 'monitor',
            onClick: () => onNavigate('live', item.id)
          }, 'Monitora')
        ])
      ]))),
    items.length > 5 && h('div', { className: 'teacher-attention-overflow', key: 'overflow' }, [
      h('p', { className: 'text-muted text-sm' }, `Sono mostrate le prime 5 di ${items.length} attività.`),
      h('div', { className: 'teacher-attention-more' }, [
        pendingActivityCount > 0 && h('button', {
          type: 'button',
          className: 'btn btn-ghost',
          key: 'all-corrections',
          onClick: () => onNavigate('submissions')
        }, 'Apri tutte le correzioni'),
        activeActivityCount > 0 && h('button', {
          type: 'button',
          className: 'btn btn-ghost',
          key: 'all-monitoring',
          onClick: () => onNavigate('live')
        }, 'Apri tutte le attività attive')
      ])
    ])
  ]);
}

function Metric({ label, value, unit, unitPlural = unit, emphasis = false }) {
  return h('div', { className: `teacher-metric${emphasis ? ' teacher-metric-emphasis' : ''}` }, [
    h('dt', null, label),
    h('dd', null, [
      h('strong', { className: 'teacher-metric-value' }, String(value)),
      h('span', { className: 'teacher-metric-unit' }, value === 1 ? unit : unitPlural)
    ])
  ]);
}

function byId(items) {
  return new Map(items.map(item => [item.id, item]));
}

export function TeacherOverviewView({ onNavigate }) {
  const [snapshot, setSnapshot] = useState({
    assessments: [],
    statistics: {},
    classes: [],
    subjects: [],
    lessons: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [contextIssues, setContextIssues] = useState([]);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    let current = true;

    async function load() {
      setLoading(true);
      setError('');
      setContextIssues([]);
      try {
        const { assessments = [] } = await readJson('/api/assessments');
        const measurableAssessments = assessments.filter(assessment => ['active', 'closed'].includes(assessment.status));
        const [statsPairs, classesResult, subjectsResult, lessonsResult] = await Promise.all([
          Promise.all(measurableAssessments.map(async assessment => {
            const result = await readJson(`/api/assessments/${encodeURIComponent(assessment.id)}/statistics`);
            return [assessment.id, result.statistics];
          })),
          readOptionalList('/api/classes', 'classes', 'classi'),
          readOptionalList('/api/subjects', 'subjects', 'materie'),
          readOptionalList('/api/lessons', 'lessons', 'lezioni')
        ]);
        if (current) {
          setSnapshot({
            assessments,
            statistics: Object.fromEntries(statsPairs),
            classes: classesResult.items,
            subjects: subjectsResult.items,
            lessons: lessonsResult.items
          });
          setContextIssues([classesResult.error, subjectsResult.error, lessonsResult.error].filter(Boolean));
        }
      } catch (err) {
        if (current) setError(`Impossibile caricare la panoramica: ${err.message}`);
      } finally {
        if (current) setLoading(false);
      }
    }

    load();
    return () => { current = false; };
  }, [reloadVersion]);

  const { assessments, statistics, classes, subjects, lessons } = snapshot;
  const contextMaps = { classes: byId(classes), subjects: byId(subjects), lessons: byId(lessons) };
  const toPrepare = assessments.filter(assessment => ['draft', 'ready'].includes(assessment.status)).map(assessment => ({
    ...assessment,
    context: formatContext(assessment, contextMaps),
    detail: assessment.status === 'draft' ? 'Bozza da completare' : 'Pronta per l’avvio'
  }));
  const active = assessments.filter(assessment => assessment.status === 'active').map(assessment => {
    const stats = statistics[assessment.id];
    return {
      ...assessment,
      context: formatContext(assessment, contextMaps),
      detail: `${quantity(stats?.inProgressCount ?? 0, 'tentativo in corso', 'tentativi in corso')} · ${quantity(stats?.submittedCount ?? 0, 'consegna inviata', 'consegne inviate')}`
    };
  });
  const toCorrect = assessments.filter(assessment => (statistics[assessment.id]?.awaitingCorrectionCount ?? 0) > 0);
  const attentionItems = assessments.filter(assessment =>
    assessment.status === 'active' || (statistics[assessment.id]?.awaitingCorrectionCount ?? 0) > 0
  ).map(assessment => {
    const stats = statistics[assessment.id] || {};
    return {
      ...assessment,
      context: formatContext(assessment, contextMaps),
      pendingCorrectionCount: stats.awaitingCorrectionCount ?? 0,
      inProgressCount: stats.inProgressCount ?? 0,
      submittedCount: stats.submittedCount ?? 0,
      isActive: assessment.status === 'active'
    };
  });
  const completed = assessments.filter(assessment => (statistics[assessment.id]?.gradingCompletedCount ?? 0) > 0).map(assessment => ({
    ...assessment,
    context: formatContext(assessment, contextMaps),
    detail: quantity(statistics[assessment.id].gradingCompletedCount, 'valutazione confermata', 'valutazioni confermate')
  }));

  const pendingSubmissionCount = toCorrect.reduce((sum, assessment) => sum + statistics[assessment.id].awaitingCorrectionCount, 0);
  const completedEvaluationCount = completed.reduce((sum, assessment) => sum + statistics[assessment.id].gradingCompletedCount, 0);

  return h('div', { className: 'teacher-overview' }, [
    h('header', { className: 'teacher-page-intro', key: 'intro' }, [
      h('div', null, [
        h('h2', null, 'Panoramica docente'),
        h('p', { className: 'text-muted' }, 'Riepilogo di tutte le attività nell’area docente. Consegne da correggere e valutazioni confermate sono conteggiate separatamente.')
      ]),
      h('div', { className: 'teacher-overview-actions' }, [
        h('button', {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: () => setReloadVersion(version => version + 1),
          disabled: loading
        }, loading ? 'Aggiornamento…' : 'Aggiorna'),
        h('button', {
          type: 'button',
          className: 'btn btn-secondary',
          onClick: () => onNavigate('activities')
        }, 'Crea attività')
      ])
    ]),
    error && h('section', { className: 'teacher-overview-error', role: 'alert', key: 'error' }, [
      h('div', null, [
        h('h3', null, 'La panoramica non è disponibile'),
        h('p', null, error)
      ]),
      h('button', {
        type: 'button',
        className: 'btn btn-secondary',
        onClick: () => setReloadVersion(version => version + 1),
        disabled: loading
      }, 'Riprova')
    ]),
    loading
      ? h('p', { className: 'teacher-overview-status', role: 'status', 'aria-live': 'polite', key: 'loading' }, 'Caricamento di attività, consegne e valutazioni…')
      : error
        ? null
        : h(React.Fragment, { key: 'content' }, [
          contextIssues.length > 0 && h('section', { className: 'teacher-overview-context-warning', role: 'status', key: 'context-warning' }, [
            h('div', null, [
              h('strong', null, 'Contesto incompleto'),
              h('p', null, `Non è stato possibile caricare ${contextIssues.join(', ')}. Conteggi e code restano disponibili, ma alcuni dettagli di classe, materia o lezione potrebbero mancare.`)
            ]),
            h('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: () => setReloadVersion(version => version + 1),
              disabled: loading
            }, 'Riprova caricamento')
          ]),
          h('dl', { className: 'teacher-overview-metrics', 'aria-label': 'Riepilogo attività' }, [
            h(Metric, { key: 'prepare', label: 'Da preparare', value: toPrepare.length, unit: 'attività' }),
            h(Metric, { key: 'active', label: 'Attività attive', value: active.length, unit: 'attività' }),
            h(Metric, { key: 'correction', label: 'Da correggere', value: pendingSubmissionCount, unit: 'consegna', unitPlural: 'consegne', emphasis: pendingSubmissionCount > 0 }),
            h(Metric, { key: 'completed', label: 'Confermate dal docente', value: completedEvaluationCount, unit: 'valutazione', unitPlural: 'valutazioni' })
          ]),
          h('section', { className: 'teacher-overview-work', 'aria-labelledby': 'teacher-attention-title' }, [
            h('div', { className: 'teacher-section-heading teacher-attention-heading' }, [
              h('div', null, [
                h('h3', { id: 'teacher-attention-title' }, 'Richiedono attenzione'),
                h('p', { className: 'text-muted text-sm' }, 'Ogni attività compare una volta; apri la correzione o il monitoraggio in base allo stato.')
              ]),
              h('span', { className: 'teacher-queue-total' }, quantity(attentionItems.length, 'attività'))
            ]),
            h(AttentionQueue, {
              items: attentionItems,
              pendingActivityCount: toCorrect.length,
              activeActivityCount: active.length,
              onNavigate
            })
          ]),
          h('section', { className: 'teacher-overview-secondary', 'aria-labelledby': 'teacher-other-states-title' }, [
            h('div', { className: 'teacher-section-heading' }, [
              h('div', null, [
                h('h3', { id: 'teacher-other-states-title' }, 'Altri stati'),
                h('p', { className: 'text-muted text-sm' }, 'Bozze e attività pronte restano separate dalle valutazioni già confermate.')
              ])
            ]),
            h('div', { className: 'teacher-secondary-queues' }, [
              h(QueueSection, {
                key: 'prepare',
                id: 'teacher-to-prepare',
                title: 'Da preparare',
                description: 'Bozze e attività pronte per la classe.',
                items: toPrepare,
                countUnit: 'attività',
                emptyText: 'Nessuna attività da preparare.',
                actionLabel: 'Apri attività',
                onAction: () => onNavigate('activities'),
                onViewAll: () => onNavigate('activities')
              }),
              h(QueueSection, {
                key: 'completed',
                id: 'teacher-completed-evaluations',
                title: 'Valutazioni concluse',
                description: 'Ogni riga è un’attività con almeno una valutazione confermata.',
                items: completed,
                countUnit: 'attività',
                emptyText: 'Nessuna valutazione conclusa.',
                actionLabel: 'Rivedi',
                onAction: item => onNavigate('reviewed', item.id),
                onViewAll: () => onNavigate('reviewed')
              })
            ])
          ])
        ])
  ]);
}
