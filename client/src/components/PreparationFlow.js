import React, { createElement as h, useEffect, useRef } from 'react';

const PREPARATION_STEPS = [
  { number: '01', label: 'Contesto', target: 'preparation-context' },
  { number: '02', label: 'Fonti', target: 'preparation-sources' },
  { number: '03', label: 'Materiale', target: 'preparation-materials' },
  { number: '04', label: 'Revisione', target: 'preparation-review' },
  { number: '05', label: 'Disponibilità', target: 'preparation-availability' }
];

export function PreparationFlowNav({ currentContext }) {
  const navRef = useRef(null);

  useEffect(() => {
    const nav = navRef.current;
    const shell = nav?.closest('.teacher-app');
    const header = document.querySelector('.teacher-portal-layout .app-header');
    if (!nav || !shell || !header) return undefined;

    const updateMeasurements = () => {
      shell.style.setProperty('--preparation-sticky-top', `${Math.ceil(header.getBoundingClientRect().height)}px`);
      shell.style.setProperty('--preparation-flow-height', `${Math.ceil(nav.getBoundingClientRect().height)}px`);
    };
    updateMeasurements();
    window.addEventListener('resize', updateMeasurements);
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(updateMeasurements) : null;
    observer?.observe(header);
    observer?.observe(nav);

    return () => {
      window.removeEventListener('resize', updateMeasurements);
      observer?.disconnect();
      shell.style.removeProperty('--preparation-sticky-top');
      shell.style.removeProperty('--preparation-flow-height');
    };
  }, []);

  return h('nav', { ref: navRef, className: 'preparation-flow-nav', 'aria-label': 'Percorso di preparazione della lezione' }, [
    h('p', { key: 'context', className: 'preparation-sticky-context' }, [
      h('span', { key: 'label', className: 'preparation-sticky-context-label' }, 'Contesto corrente'),
      h('strong', { key: 'value', className: 'preparation-sticky-context-value' }, currentContext)
    ]),
    h('ol', { key: 'steps', className: 'preparation-flow-list' }, PREPARATION_STEPS.map(step =>
      h('li', { key: step.target, className: 'preparation-flow-step' }, [
        h('a', { key: 'link', href: `#${step.target}` }, [
          h('span', { key: 'number', className: 'preparation-flow-number', 'aria-hidden': 'true' }, step.number),
          h('span', { key: 'label', className: 'preparation-flow-label' }, step.label)
        ])
      ])
    ))
  ]);
}

export function AvailabilityPanel({ pack }) {
  const material = pack?.artifacts?.studentMaterial;
  const confirmedVersion = pack?.confirmation?.artifactVersions?.studentMaterial;
  const versionIncludedInConfirmation = Boolean(
    material && confirmedVersion?.id === material.id && confirmedVersion?.version === material.current_version
  );
  const materialPreparationState = !material
    ? 'Non ancora generata'
    : versionIncludedInConfirmation
      ? 'Questa versione è inclusa nell’ultima conferma del pacchetto'
      : pack?.confirmation
        ? 'Bozza corrente: non inclusa nell’ultima conferma'
        : 'Bozza corrente: il pacchetto non è ancora confermato';

  return h('section', {
    id: 'preparation-availability',
    className: 'availability-panel preparation-section',
    'aria-labelledby': 'preparation-availability-title'
  }, [
    h('div', { key: 'heading', className: 'flow-section-heading' }, [
      h('p', { key: 'step', className: 'section-kicker' }, '05 · DISPONIBILITÀ'),
      h('h3', { key: 'title', id: 'preparation-availability-title' }, 'Disponibilità agli studenti'),
      h('p', { key: 'intro' }, 'La disponibilità agli studenti è un passaggio distinto dalla preparazione della lezione.')
    ]),
    h('div', { key: 'state', className: 'availability-state', role: 'note' }, [
      h('p', { key: 'label', className: 'availability-state-label' }, 'Pubblicazione agli studenti'),
      h('p', { key: 'value', className: 'availability-state-value' }, 'Stato non consultabile in UX2-B'),
      h('p', { key: 'description' }, 'Questa schermata non dispone dell’API docente per verificare, pubblicare o ritirare una versione esatta. Non è stata eseguita né simulata alcuna pubblicazione.')
    ]),
    h('dl', { key: 'details', className: 'availability-details' }, [
      h('div', { key: 'material' }, [
        h('dt', null, 'Materiale studenti'),
        h('dd', null, material?.title || 'Da generare')
      ]),
      h('div', { key: 'version' }, [
        h('dt', null, 'Versione corrente'),
        h('dd', null, material ? `v${material.current_version}` : 'Nessuna versione')
      ]),
      h('div', { key: 'prep' }, [
        h('dt', null, 'Nel pacchetto della lezione'),
        h('dd', null, materialPreparationState)
      ])
    ]),
    h('p', { key: 'separation', className: 'availability-separation' }, 'Confermare il pacchetto congela le versioni didattiche selezionate; non rende i materiali visibili agli studenti. Una nuova versione resta una bozza finché non viene confermata esplicitamente e non eredita pubblicazioni precedenti.')
  ]);
}
