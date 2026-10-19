import React, { createElement as h } from 'react';

export function SourceManager({
  materials = [],
  selectedSourceIds = [],
  sourceSelectionMode = 'selected_only',
  onToggleSource,
  onSelectAllSources,
  onClearSources,
  onChangeSelectionMode,
  onOpenUploadModal
}) {
  const count = materials.length;
  const selectedCount = selectedSourceIds.length;

  return h('div', { className: 'sources-panel' }, [
    h('div', { key: 'head', className: 'sources-panel-header' }, [
      h('div', { key: 'title-info' }, [
        h('strong', { key: 't', style: { fontSize: '0.95rem' } }, '📚 Fonti e Materiali di Supporto'),
        h('span', { key: 'cnt', style: { marginLeft: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' } },
          
        )
      ]),
      h('div', { key: 'actions', style: { display: 'flex', gap: '0.5rem', alignItems: 'center' } }, [
        h('label', { key: 'lbl-mode', style: { fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' } }, [
          h('span', null, 'Modalità:'),
          h('select', {
            id: 'source-selection-mode-select',
            value: sourceSelectionMode,
            onChange: (e) => onChangeSelectionMode && onChangeSelectionMode(e.target.value),
            style: { padding: '0.25rem 0.5rem', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--border)' }
          }, [
            h('option', { key: 'opt-sel', value: 'selected_only' }, 'Solo fonti selezionate'),
            h('option', { key: 'opt-ctx', value: 'contextual' }, 'Selezionate + integrazione contestuale')
          ])
        ]),
        count > 0 ? h('button', { key: 'all', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onSelectAllSources }, 'Seleziona tutte') : null,
        count > 0 && selectedCount > 0 ? h('button', { key: 'none', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onClearSources }, 'Deseleziona') : null,
        h('button', { key: 'up', type: 'button', className: 'btn btn-primary btn-sm', onClick: onOpenUploadModal }, '➕ Carica Documento')
      ])
    ]),

    count === 0
      ? h('div', { key: 'empty', style: { padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' } },
          'Nessun documento o materiale caricato per questa lezione. Puoi caricare PDF, DOCX, Markdown o testi.'
        )
      : h('table', { key: 'tbl', className: 'sources-table' }, [
          h('thead', { key: 'thd' }, h('tr', null, [
            h('th', { key: 'th-sel', style: { width: '40px' } }, 'Usa'),
            h('th', { key: 'th-title' }, 'Titolo / File'),
            h('th', { key: 'th-role' }, 'Ruolo Didattico'),
            h('th', { key: 'th-ver' }, 'Versione'),
            h('th', { key: 'th-fmt' }, 'Formato')
          ])),
          h('tbody', { key: 'tbd' },
            materials.map(m => {
              const isSelected = selectedSourceIds.includes(m.id);
              return h('tr', { key: m.id, className: isSelected ? 'selected-row' : '' }, [
                h('td', { key: 'td-chk' },
                  h('input', {
                    type: 'checkbox',
                    checked: isSelected,
                    onChange: () => onToggleSource(m.id),
                    title: 'Includi ' + m.title + ' nella generazione AI'
                  })
                ),
                h('td', { key: 'td-t' }, h('strong', null, m.title)),
                h('td', { key: 'td-r' }, h('span', { className: 'badge badge-' + m.pedagogical_role }, m.pedagogical_role)),
                h('td', { key: 'td-ver' }, 'v' + m.current_version),
                h('td', { key: 'td-fmt' }, m.resource_type)
              ]);
            })
          )
        ])
  ]);
}
