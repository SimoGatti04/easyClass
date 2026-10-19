import React, { createElement as h } from 'react';

export function LessonHeader({
  lesson,
  pack,
  durationMinutes,
  onChangeDuration,
  onOpenConfirmModal
}) {
  if (!lesson) return null;

  const prepStatus = pack?.preparationStatus || 'incomplete';
  const isComplete = Boolean(pack?.isComplete);

  let badgeClass = 'prep-badge incomplete';
  let badgeText = '⚪ Preparazione Incompleta';

  if (prepStatus === 'confirmed') {
    badgeClass = 'prep-badge confirmed prep-status-confirmed';
    badgeText = '🟢 Preparazione Confermata';
  } else if (prepStatus === 'modified_since_confirmation') {
    badgeClass = 'prep-badge modified';
    badgeText = '🟠 Modificata dopo la conferma';
  }

  const presets = [45, 60, 90, 120];

  return h('div', { className: 'lesson-card' }, [
    h('div', { key: 'top', className: 'lesson-card-header' }, [
      h('div', { key: 'title-area', className: 'lesson-title-area' }, [
        h('h2', { key: 'title' }, [
          lesson.title,
          h('span', { key: 'badge', className: badgeClass }, badgeText)
        ]),
        h('div', { key: 'meta', className: 'lesson-meta' }, [
          h('span', { key: 'date' }, `📅 Data: ${lesson.date || 'Non pianificata'}`),
          h('span', { key: 'dur' }, `⏱️ Durata: ${durationMinutes || lesson.duration_minutes || 60} minuti`),
          pack?.confirmation?.confirmedAt
            ? h('span', { key: 'conf' }, `🔒 Congelata il: ${new Date(pack.confirmation.confirmedAt).toLocaleString('it-IT')}`)
            : null
        ])
      ]),
      h('div', { key: 'actions' }, [
        h(
          'button',
          {
            key: 'confirm-btn',
            type: 'button',
            id: 'btn-confirm-prep', className: 'btn btn-success btn-sm',
            onClick: onOpenConfirmModal,
            disabled: !isComplete,
            title: isComplete ? 'Congela le versioni attuali e conferma la preparazione' : 'Genera tutti e 4 gli artefatti per confermare'
          },
          prepStatus === 'confirmed' ? '✓ Riconferma Versioni' : '🔒 Congela e Conferma'
        )
      ])
    ]),

    // Duration configuration row
    h('div', { key: 'dur-config', style: { marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' } }, [
      h('span', { key: 'dur-lbl', style: { fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' } }, 'Durata didattica:'),
      ...presets.map(m =>
        h(
          'button',
          {
            key: `p-${m}`,
            type: 'button',
            className: `btn btn-sm ${Number(durationMinutes) === m ? 'btn-primary' : 'btn-secondary'}`,
            style: { padding: '0.2rem 0.5rem', fontSize: '0.8rem' },
            onClick: () => onChangeDuration(m)
          },
          `${m} min`
        )
      ),
      h('div', { key: 'custom', style: { display: 'flex', alignItems: 'center', gap: '0.3rem', marginLeft: '0.5rem' } }, [
        h('input', {
          key: 'dur-inp',
          type: 'number',
          className: 'form-control',
          style: { width: '70px', padding: '0.2rem 0.4rem', fontSize: '0.85rem' },
          value: durationMinutes || 60,
          min: 15,
          max: 300,
          onChange: (e) => onChangeDuration(Number(e.target.value))
        }),
        h('span', { key: 'min-txt', style: { fontSize: '0.8rem', color: 'var(--text-muted)' } }, 'minuti personalizzati')
      ])
    ])
  ]);
}
