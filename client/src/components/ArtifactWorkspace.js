import React, { createElement as h, useEffect, useRef, useState } from 'react';
import { MarkdownViewer } from './MarkdownViewer.js';

const ARTIFACTS = [
  { key: 'lessonPlan', title: 'Piano di lezione', desc: 'Struttura temporale e didattica', audience: 'Docente' },
  { key: 'teacherScript', title: 'Copione docente', desc: 'Conduzione, tempi e domande guida', audience: 'Docente' },
  { key: 'exercises', title: 'Esercizi graduati', desc: 'Attività con soluzioni riservate', audience: 'Docente e supporto' },
  { key: 'studentMaterial', title: 'Dispensa studenti', desc: 'Guida di studio senza soluzioni', audience: 'Studenti' }
];

const ROLE_LABELS = {
  teacher_material: 'Materiale docente',
  student_material: 'Materiale studenti',
  support_material: 'Materiale di supporto',
  assessable_material: 'Materiale valutabile'
};

export function ArtifactWorkspace({
  pack,
  activeTab,
  onSelectTab,
  onSaveEdit,
  onOpenRevisionModal,
  onOpenExportModal,
  onDraftStateChange,
  onSavingStateChange,
  discardDraftToken = 0,
  onRequestTransition,
  onOpenConfirmModal
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const originalDraft = useRef(null);
  const activeTabRef = useRef(activeTab);

  const currentArtifact = pack?.artifacts?.[activeTab];
  const currentDefinition = ARTIFACTS.find(item => item.key === activeTab);
  const confirmedArtifact = pack?.confirmation?.artifactVersions?.[activeTab];
  const isCurrentVersionConfirmed = Boolean(
    currentArtifact && confirmedArtifact?.id === currentArtifact.id && confirmedArtifact?.version === currentArtifact.current_version
  );
  const isDirty = Boolean(isEditing && originalDraft.current && (
    editTitle !== originalDraft.current.title || editContent !== originalDraft.current.content
  ));

  function reportDraftState(dirty) {
    onDraftStateChange?.(Boolean(dirty));
  }

  function resetDraft() {
    originalDraft.current = null;
    setIsEditing(false);
    setEditTitle('');
    setEditContent('');
    setSaveError('');
    reportDraftState(false);
  }

  useEffect(() => {
    if (discardDraftToken > 0) resetDraft();
  }, [discardDraftToken]);

  useEffect(() => {
    if (activeTabRef.current !== activeTab) {
      activeTabRef.current = activeTab;
      resetDraft();
    }
  }, [activeTab]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const preventUnload = event => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [isDirty]);

  function startEdit() {
    if (!currentArtifact) return;
    const baseline = {
      id: currentArtifact.id,
      version: currentArtifact.current_version,
      title: currentArtifact.title || '',
      content: currentArtifact.content || ''
    };
    originalDraft.current = baseline;
    setEditTitle(baseline.title);
    setEditContent(baseline.content);
    setSaveError('');
    setIsEditing(true);
    reportDraftState(false);
  }

  function requestTransition(label, action) {
    if (onRequestTransition) {
      onRequestTransition(label, action);
      return;
    }
    if (!isDirty || window.confirm('Scartare le modifiche non salvate?')) action();
  }

  function cancelEdit() {
    if (isDirty) {
      requestTransition('annullare la modifica', resetDraft);
      return;
    }
    resetDraft();
  }

  function updateTitle(value) {
    setEditTitle(value);
    reportDraftState(Boolean(originalDraft.current && (value !== originalDraft.current.title || editContent !== originalDraft.current.content)));
  }

  function updateContent(value) {
    setEditContent(value);
    reportDraftState(Boolean(originalDraft.current && (editTitle !== originalDraft.current.title || value !== originalDraft.current.content)));
  }

  async function handleSave() {
    if (!currentArtifact || !originalDraft.current || !isDirty) return;
    setIsSaving(true);
    onSavingStateChange?.(true);
    setSaveError('');
    try {
      await onSaveEdit(currentArtifact.id, editTitle, editContent);
      resetDraft();
    } catch (error) {
      setSaveError(error?.message || 'Non è stato possibile salvare la nuova versione. Riprova.');
    } finally {
      setIsSaving(false);
      onSavingStateChange?.(false);
    }
  }

  function selectArtifact(key) {
    const action = () => onSelectTab(key);
    if (isDirty) {
      requestTransition(`aprire ${ARTIFACTS.find(item => item.key === key)?.title || 'un altro materiale'}`, action);
      return;
    }
    action();
  }

  const titleId = `artifact-title-${activeTab}`;
  const panelId = `artifact-panel-${activeTab}`;
  const versionState = !currentArtifact
    ? 'Non ancora generata'
    : isCurrentVersionConfirmed
      ? 'Inclusa nell’ultima conferma del pacchetto'
      : pack?.confirmation
        ? 'Nuova bozza · non inclusa nell’ultima conferma'
        : 'Bozza corrente · pacchetto non ancora confermato';

  return h('section', {
    id: 'preparation-review',
    className: 'artifact-review preparation-section',
    'aria-labelledby': 'preparation-review-title'
  }, [
    h('div', { key: 'heading', className: 'flow-section-heading' }, [
      h('p', { key: 'step', className: 'section-kicker' }, '04 · REVISIONE'),
      h('h3', { key: 'title', id: 'preparation-review-title' }, 'Rivedi ogni versione'),
      h('p', { key: 'description' }, 'Controlla il contenuto, modifica se necessario e verifica quale versione è inclusa nell’ultima conferma.')
    ]),
    h('div', { key: 'workspace', className: 'workspace-grid' }, [
      h('nav', { key: 'nav', className: 'artifacts-nav artifact-tabs', 'aria-label': 'Materiali del pacchetto della lezione' }, ARTIFACTS.map(item => {
        const artifact = pack?.artifacts?.[item.key];
        const isActive = activeTab === item.key;
        const snapshot = pack?.confirmation?.artifactVersions?.[item.key];
        const included = Boolean(artifact && snapshot?.id === artifact.id && snapshot?.version === artifact.current_version);
        return h('button', {
          type: 'button', key: item.key,
          className: `artifact-nav-item${isActive ? ' active' : ''}`,
          'aria-current': isActive ? 'page' : undefined,
          'aria-controls': `artifact-panel-${item.key}`,
          onClick: () => selectArtifact(item.key)
        }, [
          h('span', { key: 'top', className: 'artifact-nav-heading' }, [
            h('span', { key: 'title', className: 'nav-item-title' }, item.title),
            artifact ? h('span', { key: 'version', className: 'nav-item-version' }, `v${artifact.current_version}`) : null
          ]),
          h('span', { key: 'description', className: 'nav-item-desc' }, item.desc),
          h('span', { key: 'state', className: `artifact-nav-state${included ? ' confirmed' : ''}` }, artifact
            ? included ? 'Inclusa nella conferma' : pack?.confirmation ? 'Bozza non confermata' : 'Bozza corrente'
            : 'Da generare')
        ]);
      })),
      h('div', {
        key: 'pane', id: panelId, className: `workspace-pane${isEditing ? ' workspace-pane-editing' : ''}`, role: 'region', 'aria-labelledby': titleId
      }, !currentArtifact
        ? h('div', { key: 'empty', className: 'empty-state artifact-empty-state' }, [
            h('h4', { key: 'title', id: titleId }, `${currentDefinition?.title || 'Materiale'} non ancora generato`),
            h('p', { key: 'description' }, 'Genera il pacchetto o rigenera questo artefatto per creare una nuova versione da rivedere.'),
            h('a', { key: 'link', className: 'btn btn-secondary btn-sm', href: '#preparation-materials' }, 'Vai alla generazione')
          ])
        : h('div', { key: 'content', className: 'artifact-content-wrap' }, [
            h('div', { key: 'header', className: 'pane-header' }, [
              h('div', { key: 'title-area', className: 'pane-title-area' }, [
                isEditing
                  ? h('div', { key: 'title-edit', className: 'artifact-title-edit' }, [
                      h('label', { key: 'label', className: 'form-label', htmlFor: 'artifact-title' }, 'Titolo del materiale'),
                      h('input', {
                        key: 'input', id: 'artifact-title', type: 'text', className: 'form-control',
                        value: editTitle, onChange: event => updateTitle(event.target.value), disabled: isSaving
                      })
                    ])
                  : h('h4', { key: 'title', id: titleId }, currentArtifact.title),
                h('div', { key: 'meta', className: 'artifact-meta' }, [
                  h('span', { key: 'role', className: 'badge' }, ROLE_LABELS[currentArtifact.pedagogical_role] || currentArtifact.pedagogical_role),
                  h('span', { key: 'version', className: 'artifact-current-version' }, `Versione corrente v${currentArtifact.current_version}`),
                  h('span', { key: 'state', className: `artifact-version-state${isCurrentVersionConfirmed ? ' confirmed' : ''}` }, versionState),
                  currentArtifact.provenance?.model
                    ? h('span', { key: 'model', className: 'artifact-model' }, `Modello: ${currentArtifact.provenance.model}`)
                    : null
                ])
              ]),
              h('div', { key: 'actions', className: 'pane-actions' }, isEditing
                ? [
                    h('button', { key: 'save', type: 'button', className: 'btn btn-primary btn-sm', onClick: handleSave, disabled: isSaving || !isDirty }, isSaving ? 'Salvataggio…' : `Salva come v${currentArtifact.current_version + 1}`),
                    h('button', { key: 'cancel', type: 'button', className: 'btn btn-secondary btn-sm', onClick: cancelEdit, disabled: isSaving }, 'Annulla bozza')
                  ]
                : [
                    h('button', { key: 'edit', type: 'button', className: 'btn btn-secondary btn-sm', onClick: startEdit }, 'Modifica manuale'),
                    h('button', {
                      key: 'revision', type: 'button', className: 'btn btn-secondary btn-sm',
                      onClick: () => requestTransition('avviare una revisione AI', () => onOpenRevisionModal(currentArtifact)),
                      disabled: isEditing
                    }, 'Revisione AI'),
                    h('button', {
                      key: 'export', id: 'btn-export-artifact', type: 'button', className: 'btn btn-secondary btn-sm',
                      onClick: () => requestTransition('esportare il materiale salvato', () => onOpenExportModal(currentArtifact)),
                      disabled: isEditing
                    }, 'Esporta')
                  ])
            ]),
            isEditing
              ? h('div', { key: 'editor-info', className: 'editor-version-note' }, `Salvare crea v${currentArtifact.current_version + 1}. La versione precedente e la sua eventuale conferma restano invariate.`)
              : null,
            saveError ? h('div', { key: 'save-error', className: 'inline-error', role: 'alert' }, saveError) : null,
            h('div', { key: 'body', className: 'pane-body' }, isEditing
              ? h('textarea', {
                  key: 'content', id: 'artifact-content', className: 'form-control artifact-editor',
                  'aria-label': `Contenuto di ${currentArtifact.title}`,
                  value: editContent, onChange: event => updateContent(event.target.value), disabled: isSaving
                })
              : h('div', { key: 'viewer', className: 'workspace-content' }, h(MarkdownViewer, { key: 'markdown', content: currentArtifact.content }))
            )
          ])
      )
    ]),
    h('div', { key: 'confirmation', className: 'preparation-confirmation' }, [
      h('div', { key: 'copy', className: 'preparation-confirmation-copy' }, [
        h('p', { key: 'label', className: 'preparation-confirmation-label' }, 'Preparazione della lezione'),
        h('p', { key: 'note', id: 'preparation-confirmation-note' }, pack?.isComplete
          ? 'Dopo aver revisionato le versioni, conferma il pacchetto. La conferma congela le versioni elencate; non pubblica i materiali agli studenti.'
          : 'Genera tutti e quattro i materiali prima di poter confermare il pacchetto.')
      ]),
      h('button', {
        key: 'confirm',
        type: 'button',
        id: 'btn-confirm-prep',
        className: 'btn btn-success',
        onClick: onOpenConfirmModal,
        disabled: !pack?.isComplete,
        'aria-describedby': 'preparation-confirmation-note',
        title: pack?.isComplete
          ? 'Conferma le versioni correnti dopo averle revisionate'
          : 'Genera tutti e quattro i materiali prima di confermare'
      }, pack?.preparationStatus === 'confirmed' ? 'Riconferma versioni' : 'Conferma pacchetto')
    ])
  ]);
}
