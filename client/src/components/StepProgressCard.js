import React, { createElement as h } from 'react';

export function StepProgressCard({
  pack,
  stepStates,
  isGenerating,
  additionalPrompt,
  onChangePrompt,
  onStartFullGeneration,
  onRetryStep
}) {
  const steps = [
    { key: 'lessonPlan', label: '1. Piano di Lezione', role: 'teacher_material', desc: 'Obiettivi, struttura, tempi e prerequisiti' },
    { key: 'teacherScript', label: '2. Copione Docente', role: 'teacher_material', desc: 'Conduzione con timecode, ganci e domande' },
    { key: 'exercises', label: '3. Esercizi e Soluzioni', role: 'support_material', desc: 'Scheda graduata con soluzioni riservate' },
    { key: 'studentMaterial', label: '4. Dispensa Studenti', role: 'student_material', desc: 'Guida di studio canonica senza soluzioni' }
  ];

  return h('div', { className: 'step-progress-card' }, [
    h('div', { key: 'head', className: 'step-progress-title' }, [
      h('div', { key: 'tl' }, [
        h('span', { key: 'i', style: { marginRight: '0.4rem' } }, '🤖'),
        h('span', { key: 't' }, 'Generatore Lesson Pack AI (OmniRoute)'),
        isGenerating ? h('span', { key: 'spin', style: { marginLeft: '0.5rem', color: 'var(--primary)', fontSize: '0.85rem' } }, '⏳ In generazione sequenziale...') : null
      ]),
      h('button', {
        key: 'gen-btn',
        type: 'button',
        id: 'btn-generate-pack', className: 'btn btn-primary btn-sm',
        onClick: onStartFullGeneration,
        disabled: isGenerating
      }, pack?.isComplete ? '🔄 Rigenera Tutto il Pack' : '🚀 Genera Lesson Pack Completo')
    ]),

    // Additional prompt input
    h('div', { key: 'prompt-area', style: { marginBottom: '1rem' } }, [
      h('input', {
        type: 'text',
        className: 'form-control',
        placeholder: 'Istruzioni opzionali per l\'AI (es. focus pratico su socket TCP in C, studenti con difficoltà su subnetting...)',
        value: additionalPrompt,
        onChange: (e) => onChangePrompt(e.target.value),
        disabled: isGenerating,
        style: { fontSize: '0.85rem' }
      })
    ]),

    // 4 Steps grid
    h('div', { key: 'grid', className: 'step-items' }, steps.map((s) => {
      const state = stepStates[s.key] || 'idle';
      const existingArtifact = pack?.artifacts?.[s.key];

      let stateText = 'Non generato';
      let itemClass = 'step-item';

      if (state === 'running') {
        itemClass += ' running';
        stateText = '⏳ Elaborazione in corso...';
      } else if (state === 'completed' || existingArtifact) {
        itemClass += ' completed step-badge-ready';
        stateText = existingArtifact ? `✓ Presente (v${existingArtifact.current_version})` : '✓ Completato e salvato';
      } else if (state === 'failed') {
        itemClass += ' failed';
        stateText = '✖ Generazione fallita';
      }

      return h('div', { key: s.key, className: itemClass }, [
        h('div', { key: 'hdr', className: 'step-header-line' }, [
          h('span', { key: 'lbl' }, s.label),
          !isGenerating && (state === 'failed' || existingArtifact)
            ? h('button', {
                key: 'retry',
                type: 'button',
                className: 'btn btn-secondary btn-sm',
                style: { padding: '0.1rem 0.4rem', fontSize: '0.75rem' },
                onClick: () => onRetryStep(s.key),
                title: 'Rigenera selettivamente solo questo artefatto'
              }, 'Rigenera')
            : null
        ]),
        h('div', { key: 'desc', style: { fontSize: '0.75rem', color: 'var(--text-muted)' } }, s.desc),
        h('div', { key: 'st', style: { fontSize: '0.75rem', fontWeight: 600, marginTop: '0.2rem' } }, stateText)
      ]);
    }))
  ]);
}
