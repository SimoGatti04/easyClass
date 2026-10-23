import React, { createElement as h, useEffect, useState } from 'react';

async function readJson(url) {
  const response = await fetch(url);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || `Richiesta non riuscita (${response.status})`);
  return body;
}

function QueueSection({ title, description, items, emptyText, actionLabel, onAction }) {
  return h('section', { className: 'card teacher-queue-section' }, [
    h('div', { className: 'teacher-queue-heading', key: 'heading' }, [
      h('div', null, [
        h('h3', { className: 'card-title' }, title),
        h('p', { className: 'text-muted text-sm' }, description)
      ]),
      h('span', { className: 'teacher-queue-count' }, String(items.length))
    ]),
    items.length === 0
      ? h('p', { className: 'text-muted teacher-queue-empty', key: 'empty' }, emptyText)
      : h('ul', { className: 'teacher-queue-list', key: 'list' }, items.slice(0, 5).map(item =>
        h('li', { className: 'teacher-queue-item', key: item.id }, [
          h('div', { className: 'teacher-queue-item-copy' }, [
            h('strong', null, item.title),
            h('span', { className: 'text-muted text-sm' }, item.detail)
          ]),
          h('button', {
            className: 'btn btn-sm btn-secondary',
            onClick: () => onAction(item)
          }, actionLabel)
        ])
      ))
  ]);
}

export function TeacherOverviewView({ onNavigate }) {
  const [snapshot, setSnapshot] = useState({ assessments: [], statistics: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const { assessments = [] } = await readJson('/api/assessments');
        const statsPairs = await Promise.all(assessments.map(async assessment => {
          const result = await readJson(`/api/assessments/${encodeURIComponent(assessment.id)}/statistics`);
          return [assessment.id, result.statistics];
        }));
        if (current) setSnapshot({ assessments, statistics: Object.fromEntries(statsPairs) });
      } catch (err) {
        if (current) setError(`Impossibile caricare la panoramica: ${err.message}`);
      } finally {
        if (current) setLoading(false);
      }
    }
    load();
    return () => { current = false; };
  }, []);

  const { assessments, statistics } = snapshot;
  const toPrepare = assessments.filter(a => ['draft', 'ready'].includes(a.status)).map(a => ({
    ...a,
    detail: a.status === 'draft' ? 'Bozza da completare' : 'Pronta per l’avvio'
  }));
  const inProgress = assessments.filter(a => a.status === 'active').map(a => ({
    ...a,
    detail: `${statistics[a.id]?.inProgressCount ?? 0} in corso · ${statistics[a.id]?.submittedCount ?? 0} consegne`
  }));
  const toCorrect = assessments.filter(a => (statistics[a.id]?.awaitingCorrectionCount || 0) > 0).map(a => ({
    ...a,
    detail: `${statistics[a.id].awaitingCorrectionCount} da correggere`
  }));
  const completed = assessments.filter(a => (statistics[a.id]?.gradingCompletedCount || 0) > 0).map(a => ({
    ...a,
    detail: `${statistics[a.id].gradingCompletedCount} valutazioni confermate`
  }));

  return h('div', { className: 'teacher-overview' }, [
    h('header', { className: 'teacher-page-intro', key: 'intro' }, [
      h('div', null, [
        h('p', { className: 'eyebrow' }, 'Area docente'),
        h('h2', null, 'Panoramica verifiche'),
        h('p', { className: 'text-muted' }, 'Una vista operativa delle attività, delle consegne e delle valutazioni confermate.')
      ]),
      h('button', {
        className: 'btn btn-primary',
        onClick: () => onNavigate('activities')
      }, '+ Crea attività')
    ]),
    error && h('div', { className: 'alert alert-error', role: 'alert', key: 'error' }, error),
    loading
      ? h('div', { className: 'card teacher-overview-loading', key: 'loading' }, 'Caricamento dati reali…')
      : error
        ? h('div', { className: 'card teacher-overview-loading', key: 'unavailable' }, 'Le code operative non sono disponibili finché le statistiche non possono essere lette.')
        : h(React.Fragment, { key: 'content' }, [
        h('div', { className: 'metrics-cards-grid teacher-overview-metrics' }, [
          ['Da preparare', toPrepare.length, 'Bozze e attività pronte'],
          ['In corso', inProgress.length, 'Verifiche attive'],
          ['Da correggere', toCorrect.reduce((sum, a) => sum + (statistics[a.id]?.awaitingCorrectionCount || 0), 0), 'Consegne senza voto definitivo'],
          ['Valutazioni concluse', completed.reduce((sum, a) => sum + (statistics[a.id]?.gradingCompletedCount || 0), 0), 'Decisioni docente confermate']
        ].map(([label, value, helper]) => h('article', { className: 'metric-card teacher-overview-metric', key: label }, [
          h('span', { className: 'metric-label' }, label),
          h('strong', { className: 'metric-value' }, String(value)),
          h('span', { className: 'text-muted text-sm' }, helper)
        ]))),
        h('div', { className: 'teacher-queues-grid' }, [
          h(QueueSection, {
            key: 'prepare', title: 'Da preparare', description: 'Bozze e attività pronte per la classe.',
            items: toPrepare, emptyText: 'Nessuna attività da preparare.', actionLabel: 'Apri attività',
            onAction: () => onNavigate('activities')
          }),
          h(QueueSection, {
            key: 'active', title: 'In corso', description: 'Attività live e stato dei tentativi.',
            items: inProgress, emptyText: 'Nessuna verifica attiva.', actionLabel: 'Monitora',
            onAction: item => onNavigate('live', item.id)
          }),
          h(QueueSection, {
            key: 'correction', title: 'Consegne da correggere', description: 'Le proposte non sono voti definitivi.',
            items: toCorrect, emptyText: 'Nessuna consegna in attesa di correzione.', actionLabel: 'Correggi',
            onAction: item => onNavigate('submissions', item.id)
          }),
          h(QueueSection, {
            key: 'completed', title: 'Valutazioni concluse', description: 'Voti confermati dal docente.',
            items: completed, emptyText: 'Nessuna valutazione conclusa.', actionLabel: 'Rivedi',
            onAction: item => onNavigate('reviewed', item.id)
          })
        ])
      ])
  ]);
}
