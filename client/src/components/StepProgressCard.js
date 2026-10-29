import React, { createElement as h } from 'react';

const PACK_STEPS = [
  { key: 'lessonPlan', label: 'Piano di lezione', desc: 'Obiettivi, struttura, tempi e prerequisiti' },
  { key: 'teacherScript', label: 'Copione docente', desc: 'Conduzione, tempi e domande guida' },
  { key: 'exercises', label: 'Esercizi graduati', desc: 'Attività e soluzioni riservate' },
  { key: 'studentMaterial', label: 'Dispensa studenti', desc: 'Materiale di studio senza soluzioni riservate' }
];

export function StepProgressCard({
  pack,
  stepStates,
  isGenerating,
  hasUnsavedChanges = false,
  additionalPrompt,
  onChangePrompt,
  onStartFullGeneration,
  onRetryStep
}) {
  const confirmation = pack?.confirmation?.artifactVersions || {};

  return h('section', {
    id: 'preparation-materials',
    className: 'step-progress-card preparation-section',
    'aria-labelledby': 'preparation-materials-title'
  }, [
    h('div', { key: 'heading', className: 'flow-section-heading' }, [
      h('p', { key: 'step', className: 'section-kicker' }, '03 · MATERIALE'),
      h('h3', { key: 'title', id: 'preparation-materials-title' }, 'Genera il materiale della lezione'),
      h('p', { key: 'description' }, 'Il pacchetto contiene quattro artefatti distinti. Ogni rigenerazione crea una nuova versione; non eredita la conferma precedente.')
    ]),
    h('div', { key: 'generator-actions', className: 'generator-toolbar' }, [
      h('p', { key: 'engine' }, 'Generazione assistita · i risultati restano bozze finché non vengono revisionati e confermati.'),
      h('button', {
        key: 'generate', type: 'button', id: 'btn-generate-pack', className: 'btn btn-primary',
        onClick: onStartFullGeneration,
        disabled: isGenerating || hasUnsavedChanges,
        title: hasUnsavedChanges ? 'Salva o scarta la bozza aperta prima di generare nuove versioni' : undefined
      }, isGenerating ? 'Generazione in corso…' : pack?.isComplete ? 'Rigenera il pacchetto' : 'Genera il pacchetto completo')
    ]),
    hasUnsavedChanges
      ? h('p', { key: 'draft-warning', className: 'inline-status', role: 'status' }, 'Salva o scarta la modifica aperta prima di generare nuove versioni.')
      : null,
    h('div', { key: 'prompt', className: 'form-group generation-instructions' }, [
      h('label', { key: 'label', className: 'form-label', htmlFor: 'generation-instructions' }, 'Istruzioni aggiuntive per la generazione · facoltative'),
      h('input', {
        key: 'input', type: 'text', id: 'generation-instructions', className: 'form-control',
        placeholder: 'Indica un focus o un’esigenza didattica specifica',
        value: additionalPrompt,
        onChange: event => onChangePrompt(event.target.value),
        disabled: isGenerating || hasUnsavedChanges
      })
    ]),
    h('ol', { key: 'steps', className: 'step-items', 'aria-label': 'Stato degli artefatti del pacchetto' }, PACK_STEPS.map((step, index) => {
      const state = stepStates[step.key] || 'idle';
      const artifact = pack?.artifacts?.[step.key];
      const confirmed = Boolean(artifact && confirmation[step.key]?.id === artifact.id && confirmation[step.key]?.version === artifact.current_version);
      let itemClass = 'step-item';
      let stateText = 'Da generare';

      if (state === 'running') {
        itemClass += ' running';
        stateText = 'Generazione in corso';
      } else if (state === 'failed') {
        itemClass += ' failed';
        stateText = artifact ? `Generazione non riuscita · resta disponibile v${artifact.current_version}` : 'Generazione non riuscita';
      } else if (artifact) {
        itemClass += confirmed ? ' completed version-confirmed' : ' completed version-draft';
        stateText = confirmed
          ? `v${artifact.current_version} · inclusa nell’ultima conferma`
          : `v${artifact.current_version} · bozza corrente, non inclusa nella conferma`;
      } else if (state === 'completed') {
        itemClass += ' completed';
        stateText = 'Generato';
      }

      return h('li', { key: step.key, className: itemClass }, [
        h('div', { key: 'header', className: 'step-header-line' }, [
          h('div', { key: 'title', className: 'step-item-title' }, [
            h('span', { key: 'number', className: 'step-item-number', 'aria-hidden': 'true' }, String(index + 1).padStart(2, '0')),
            h('span', { key: 'label' }, step.label)
          ]),
          !isGenerating && !hasUnsavedChanges && (state === 'failed' || artifact)
            ? h('button', {
                key: 'retry', type: 'button', className: 'btn btn-secondary btn-sm',
                onClick: () => onRetryStep(step.key),
                title: `Crea una nuova versione di ${step.label.toLowerCase()}`
              }, 'Rigenera')
            : null
        ]),
        h('p', { key: 'description', className: 'step-item-description' }, step.desc),
        h('p', { key: 'state', className: 'step-item-state', role: state === 'running' || state === 'failed' ? 'status' : undefined }, stateText)
      ]);
    }))
  ]);
}
