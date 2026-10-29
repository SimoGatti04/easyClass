import React, { createElement as h } from 'react';

const ROLE_LABELS = {
  teacher_material: 'Materiale docente',
  student_material: 'Materiale studenti',
  support_material: 'Materiale di supporto',
  assessable_material: 'Materiale valutabile'
};

export function SourceManager({
  materials = [],
  selectedSourceIds = [],
  sourceSelectionMode = 'selected_only',
  loading = false,
  error = '',
  onRetry,
  onToggleSource,
  onSelectAllSources,
  onClearSources,
  onChangeSelectionMode,
  onOpenUploadModal
}) {
  const selectedCount = selectedSourceIds.length;

  return h('section', {
    id: 'preparation-sources',
    className: 'sources-panel preparation-section',
    'aria-labelledby': 'preparation-sources-title'
  }, [
    h('div', { key: 'heading', className: 'flow-section-heading' }, [
      h('p', { key: 'step', className: 'section-kicker' }, '02 · FONTI'),
      h('h3', { key: 'title', id: 'preparation-sources-title' }, 'Scegli le fonti per la lezione'),
      h('p', { key: 'description' }, 'Seleziona solo i materiali da usare come fonte. Le versioni indicate sono quelle attualmente disponibili nel contesto.')
    ]),
    h('div', { key: 'actions', className: 'sources-toolbar' }, [
      h('label', { key: 'mode', className: 'source-mode' }, [
        h('span', { key: 'text' }, 'Modalità fonti'),
        h('select', {
          key: 'select', id: 'source-selection-mode-select', value: sourceSelectionMode,
          onChange: event => onChangeSelectionMode?.(event.target.value),
          'aria-label': 'Modalità di selezione delle fonti'
        }, [
          h('option', { key: 'selected', value: 'selected_only' }, 'Solo fonti selezionate'),
          h('option', { key: 'contextual', value: 'contextual' }, 'Selezionate e integrazione contestuale')
        ])
      ]),
      h('div', { key: 'actions', className: 'source-actions' }, [
        materials.length > 0
          ? h('span', { key: 'selected', className: 'source-selection-count', 'aria-live': 'polite' }, `${selectedCount} selezionate`)
          : null,
        materials.length > 0
          ? h('button', { key: 'all', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onSelectAllSources }, 'Seleziona tutte')
          : null,
        selectedCount > 0
          ? h('button', { key: 'clear', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onClearSources }, 'Deseleziona')
          : null,
        h('button', { key: 'upload', type: 'button', className: 'btn btn-primary btn-sm', onClick: onOpenUploadModal }, 'Carica documento')
      ])
    ]),
    loading
      ? h('p', { key: 'loading', className: 'inline-status', role: 'status' }, 'Caricamento delle fonti…')
      : error
        ? h('div', { key: 'error', className: 'inline-error', role: 'alert' }, [
            h('p', { key: 'message' }, `Le fonti non sono disponibili. ${error}`),
            onRetry ? h('button', { key: 'retry', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onRetry }, 'Riprova caricamento') : null
          ])
        : materials.length === 0
          ? h('div', { key: 'empty', className: 'source-empty-state' }, [
              h('p', { key: 'title' }, 'Non ci sono fonti disponibili per questa lezione.'),
              h('p', { key: 'body' }, 'Puoi continuare senza fonti oppure caricare un documento. La selezione resta esplicita.'),
              h('button', { key: 'upload', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onOpenUploadModal }, 'Carica una fonte')
            ])
          : h('ul', { key: 'list', className: 'source-list', 'aria-label': 'Fonti disponibili' }, materials.map(material => {
              const selected = selectedSourceIds.includes(material.id);
              const role = ROLE_LABELS[material.pedagogical_role] || material.pedagogical_role || 'Ruolo non indicato';
              return h('li', { key: material.id, className: `source-item${selected ? ' source-item-selected' : ''}` }, [
                h('label', { key: 'select', className: 'source-choice' }, [
                  h('input', {
                    key: 'checkbox', type: 'checkbox', checked: selected,
                    onChange: () => onToggleSource(material.id),
                    'aria-label': `Usa ${material.title}, versione ${material.current_version}, come fonte`
                  }),
                  h('span', { key: 'title', className: 'source-title' }, material.title)
                ]),
                h('div', { key: 'meta', className: 'source-meta' }, [
                  h('span', { key: 'role', className: 'source-meta-item' }, role),
                  h('span', { key: 'version', className: 'source-meta-item source-version' }, `v${material.current_version}`),
                  h('span', { key: 'type', className: 'source-meta-item' }, material.resource_type || 'Formato non indicato')
                ])
              ]);
            }))
  ]);
}
