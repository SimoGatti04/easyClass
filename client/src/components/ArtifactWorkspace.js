import React, { createElement as h, useState } from 'react';
import { MarkdownViewer } from './MarkdownViewer.js';

export function ArtifactWorkspace({
  pack,
  activeTab,
  onSelectTab,
  onSaveEdit,
  onOpenRevisionModal,
  onOpenExportModal
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const tabs = [
    { key: 'lessonPlan', title: '📋 Piano di Lezione', roleBadge: 'Docente', desc: 'Struttura temporale e didattica' },
    { key: 'teacherScript', title: '🎙️ Copione Docente', roleBadge: 'Docente', desc: 'Conduzione con ganci e timecode' },
    { key: 'exercises', title: '📝 Esercizi Graduati', roleBadge: 'Docente / Supporto', desc: 'Con soluzioni riservate' },
    { key: 'studentMaterial', title: '📖 Dispensa Studenti', roleBadge: 'Studenti', desc: 'Guida canonica priva di soluzioni' }
  ];

  const currentArtifact = pack?.artifacts?.[activeTab];

  function startEdit() {
    if (!currentArtifact) return;
    setEditContent(currentArtifact.content || '');
    setEditTitle(currentArtifact.title || '');
    setIsEditing(true);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  async function handleSave() {
    if (!currentArtifact) return;
    setIsSaving(true);
    try {
      await onSaveEdit(currentArtifact.id, editTitle, editContent);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  return h('div', { className: 'workspace-grid' }, [
    // Left: Artifacts navigation list
    h('div', { key: 'nav', className: 'artifacts-nav artifact-tabs' }, tabs.map((t) => {
      const art = pack?.artifacts?.[t.key];
      const isActive = activeTab === t.key;
      return h(
        'button',
        {
          type: 'button',
          key: t.key,
          className: `artifact-nav-item ${isActive ? 'active' : ''}`, 'data-tab': t.key,
          onClick: () => {
            setIsEditing(false);
            onSelectTab(t.key);
          }
        },
        [
          h('div', { key: 'top', style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } }, [
            h('span', { key: 't', className: 'nav-item-title' }, t.title),
            art ? h('span', { key: 'v', className: 'nav-item-version' }, `v${art.current_version}`) : null
          ]),
          h('span', { key: 'd', className: 'nav-item-desc' }, t.desc),
          art
            ? h('span', { key: 'ok', style: { fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, marginTop: '0.25rem' } }, '✓ Salvato')
            : h('span', { key: 'no', style: { fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' } }, 'Non ancora generato')
        ]
      );
    })),

    // Right: Active Artifact Pane
    h('div', { key: 'pane', className: 'workspace-pane' }, [
      !currentArtifact
        ? h('div', { key: 'empty', className: 'empty-state' }, [
            h('div', { key: 'i', style: { fontSize: '2.5rem', marginBottom: '0.5rem' } }, '📄'),
            h('h3', { key: 't' }, 'Artefatto non ancora generato'),
            h('p', { key: 'd' }, 'Usa il generatore AI in alto per creare questo materiale, oppure rigeneralo singolarmente.')
          ])
        : h('div', { key: 'content-wrap' }, [
            // Pane Header
            h('div', { key: 'phdr', className: 'pane-header' }, [
              h('div', { key: 'title-area', className: 'pane-title-area' }, [
                isEditing
                  ? h('input', {
                      key: 'edit-title-inp',
                      type: 'text',
                      className: 'form-control',
                      value: editTitle,
                      onChange: (e) => setEditTitle(e.target.value),
                      style: { fontSize: '1.2rem', fontWeight: 700 }
                    })
                  : h('h3', { key: 'art-title' }, currentArtifact.title),
                h('div', { key: 'meta', style: { display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '0.35rem' } }, [
                  h('span', { key: 'role', className: 'badge' }, currentArtifact.pedagogical_role),
                  h('span', { key: 'v', style: { fontSize: '0.8rem', color: 'var(--text-muted)' } }, `Versione: v${currentArtifact.current_version}`),
                  currentArtifact.provenance?.model
                    ? h('span', { key: 'm', style: { fontSize: '0.8rem', color: 'var(--text-muted)' } }, `Modello AI: ${currentArtifact.provenance.model}`)
                    : null
                ])
              ]),

              // Pane action buttons
              h('div', { key: 'actions', className: 'pane-actions' }, [
                isEditing
                  ? [
                      h('button', { key: 'save', type: 'button', className: 'btn btn-primary btn-sm', onClick: handleSave, disabled: isSaving }, isSaving ? 'Salvataggio...' : '💾 Salva Nuova Versione'),
                      h('button', { key: 'cancel', type: 'button', className: 'btn btn-secondary btn-sm', onClick: cancelEdit, disabled: isSaving }, 'Annulla')
                    ]
                  : [
                      h('button', { key: 'edit', type: 'button', className: 'btn btn-secondary btn-sm', onClick: startEdit }, '✏️ Modifica Manuale'),
                      h('button', { key: 'rev', type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => onOpenRevisionModal(currentArtifact) }, '🤖 Revisione AI'),
                      h('button', { key: 'exp', id: 'btn-export-artifact', type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => onOpenExportModal(currentArtifact) }, '📥 Esporta')
                    ]
              ])
            ]),

            // Pane Body
            h('div', { key: 'pbody', className: 'pane-body' }, [
              isEditing
                ? h('div', { key: 'editor', style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } }, [
                    h('div', { key: 'info', style: { fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: '0.5rem', borderRadius: 'var(--radius-sm)' } },
                      'ℹ️ Ogni salvataggio crea una nuova versione immutabile (v' + (currentArtifact.current_version + 1) + ') preservando lo storico precedente e la traccia di provenienza.'
                    ),
                    h('textarea', {
                      key: 'txt',
                      className: 'form-control',
                      style: { minHeight: '450px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', lineHeight: '1.5' },
                      value: editContent,
                      onChange: (e) => setEditContent(e.target.value)
                    })
                  ])
                : h('div', { key: 'view-wrap', className: 'workspace-content' }, h(MarkdownViewer, { key: 'view', content: currentArtifact.content }))
            ])
          ])
    ])
  ]);
}
