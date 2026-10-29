import React, { createElement as h, useCallback, useEffect, useRef, useState } from 'react';

const PREPARATION_STEPS = [
  { number: '01', label: 'Contesto', target: 'preparation-context' },
  { number: '02', label: 'Fonti', target: 'preparation-sources' },
  { number: '03', label: 'Materiale', target: 'preparation-materials' },
  { number: '04', label: 'Revisione', target: 'preparation-review' },
  { number: '05', label: 'Disponibilità', target: 'preparation-availability' }
];

const PUBLICATION_STATES = {
  never_published: {
    label: 'Mai pubblicata',
    detail: 'Questa versione non è ancora visibile agli studenti.'
  },
  available: {
    label: 'Disponibile agli studenti',
    detail: 'Gli studenti della classe possono consultare questa versione.'
  },
  expired: {
    label: 'Pubblicazione scaduta',
    detail: 'La scadenza è passata: questa versione non è più visibile agli studenti.'
  },
  withdrawn: {
    label: 'Ritirata',
    detail: 'Questa versione non è più disponibile agli studenti.'
  },
  unavailable: {
    label: 'Non disponibile agli studenti',
    detail: 'La pubblicazione non è consultabile per un vincolo attuale del materiale.'
  }
};

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function localDateTimeValue(date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
}

function errorMessage(payload, fallback) {
  return typeof payload?.message === 'string' && payload.message.trim()
    ? payload.message
    : fallback;
}

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
  const material = pack?.artifacts?.studentMaterial || null;
  const materialId = typeof material?.id === 'string' ? material.id : null;
  const versionNumber = Number(material?.current_version);
  const hasExactVersion = Number.isSafeInteger(versionNumber) && versionNumber > 0;
  const hasMaterialVersion = Boolean(materialId && hasExactVersion);
  const confirmedVersion = pack?.confirmation?.artifactVersions?.studentMaterial;
  const versionIncludedInConfirmation = Boolean(
    hasMaterialVersion && confirmedVersion?.id === materialId && confirmedVersion?.version === versionNumber
  );
  const materialPreparationState = !material
    ? 'Non ancora generata'
    : versionIncludedInConfirmation
      ? 'Questa versione è inclusa nell’ultima conferma del pacchetto'
      : pack?.confirmation
        ? 'Bozza corrente: non inclusa nell’ultima conferma'
        : 'Bozza corrente: il pacchetto non è ancora confermato';

  const [publication, setPublication] = useState(null);
  const [loadState, setLoadState] = useState('idle');
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [expiryInput, setExpiryInput] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const requestSequence = useRef(0);
  const confirmationButtonRef = useRef(null);
  const publicationUrl = hasMaterialVersion
    ? `/api/materials/${encodeURIComponent(materialId)}/versions/${versionNumber}/publication`
    : null;

  const refreshStatus = useCallback(async () => {
    if (!publicationUrl) {
      setPublication(null);
      setLoadState('idle');
      setLoadError('');
      return;
    }
    const requestId = ++requestSequence.current;
    setLoadState('loading');
    setLoadError('');
    try {
      const response = await fetch(publicationUrl, { credentials: 'same-origin' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(errorMessage(payload, `Risposta non riuscita (${response.status})`));
        error.status = response.status;
        throw error;
      }
      if (requestId !== requestSequence.current) return;
      if (!payload.publication || payload.publication.material?.versionNumber !== versionNumber) {
        throw new Error('La risposta non corrisponde alla versione selezionata.');
      }
      setPublication(payload.publication);
      setLoadState('ready');
    } catch (error) {
      if (requestId !== requestSequence.current) return;
      setPublication(null);
      setLoadState('error');
      setLoadError(error.message || 'Non è stato possibile leggere lo stato della pubblicazione.');
    }
  }, [publicationUrl, versionNumber]);

  useEffect(() => {
    setPublication(null);
    setActionError('');
    setNotice('');
    setExpiryInput('');
    setPendingAction(null);
    refreshStatus();
    return () => { requestSequence.current += 1; };
  }, [refreshStatus]);

  useEffect(() => {
    if (pendingAction) confirmationButtonRef.current?.focus();
  }, [pendingAction]);

  const requestPublish = () => {
    setActionError('');
    setNotice('');
    if (expiryInput) {
      const date = new Date(expiryInput);
      if (!Number.isFinite(date.getTime()) || date.getTime() <= Date.now()) {
        setActionError('Scegli una scadenza futura oppure lascia il campo vuoto per non impostarla.');
        return;
      }
    }
    setPendingAction('publish');
  };

  const requestWithdrawal = () => {
    setActionError('');
    setNotice('');
    setPendingAction('withdraw');
  };

  const executeAction = async () => {
    if (!publicationUrl || !pendingAction || actionPending) return;
    const action = pendingAction;
    setActionPending(true);
    setActionError('');
    setNotice('');
    try {
      const response = await fetch(publicationUrl, {
        method: action === 'publish' ? 'POST' : 'DELETE',
        credentials: 'same-origin',
        ...(action === 'publish' ? {
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ availableUntil: expiryInput ? new Date(expiryInput).toISOString() : null })
        } : {})
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(errorMessage(payload, `Risposta non riuscita (${response.status})`));
        error.status = response.status;
        throw error;
      }
      if (!payload.publication || payload.publication.material?.versionNumber !== versionNumber) {
        throw new Error('La risposta non corrisponde alla versione selezionata.');
      }
      setPublication(payload.publication);
      setPendingAction(null);
      setExpiryInput('');
      setNotice(action === 'publish'
        ? payload.outcome === 'already_available'
          ? `La versione v${versionNumber} era già disponibile agli studenti.`
          : `La versione v${versionNumber} è ora disponibile agli studenti.`
        : payload.outcome === 'already_withdrawn'
          ? `La versione v${versionNumber} era già stata ritirata.`
          : `La versione v${versionNumber} è stata ritirata.`);
    } catch (error) {
      setPendingAction(null);
      setActionError(error.status === 409
        ? 'Lo stato è cambiato prima che l’operazione fosse completata. Ho aggiornato la situazione: controllala prima di riprovare.'
        : `Non è stato possibile confermare l’operazione. Verifica lo stato aggiornato prima di riprovare. ${error.message || ''}`.trim());
      await refreshStatus();
    } finally {
      setActionPending(false);
    }
  };

  const publicationStatus = publication?.status;
  const statusCopy = PUBLICATION_STATES[publicationStatus] || null;
  const canPublish = Boolean(publication?.canPublish && versionIncludedInConfirmation);
  const canWithdraw = Boolean(publication?.canUnpublish);
  const exactTitle = publication?.material?.title || material?.title || 'Materiale studenti';
  const exactVersion = publication?.material?.versionNumber || versionNumber;
  const minimumExpiry = localDateTimeValue(new Date(Date.now() + 60_000));
  const statusClass = statusCopy ? `availability-state availability-state-${publicationStatus}` : 'availability-state availability-state-neutral';

  let stateContent;
  if (!material) {
    stateContent = h('div', { key: 'state', className: statusClass }, [
      h('p', { key: 'label', className: 'availability-state-label' }, 'Pubblicazione agli studenti'),
      h('p', { key: 'value', className: 'availability-state-value' }, 'Nessun materiale selezionato'),
      h('p', { key: 'description' }, 'Genera o seleziona una Dispensa studenti per verificare e gestire la disponibilità.')
    ]);
  } else if (loadState === 'loading' || loadState === 'idle') {
    stateContent = h('div', { key: 'state', className: statusClass, role: 'status', 'aria-live': 'polite' }, [
      h('p', { key: 'label', className: 'availability-state-label' }, 'Pubblicazione agli studenti'),
      h('p', { key: 'value', className: 'availability-state-value' }, 'Verifica dello stato reale…'),
      h('p', { key: 'description' }, 'In attesa della risposta del servizio docente. Nessuna pubblicazione viene eseguita automaticamente.')
    ]);
  } else if (loadState === 'error') {
    stateContent = h('div', { key: 'state', className: 'availability-state availability-state-error', role: 'alert' }, [
      h('p', { key: 'label', className: 'availability-state-label' }, 'Pubblicazione agli studenti'),
      h('p', { key: 'value', className: 'availability-state-value' }, 'Stato non verificabile'),
      h('p', { key: 'description' }, `Non mostrare questo materiale come pubblicato: ${loadError}`),
      h('button', { key: 'retry', type: 'button', className: 'btn btn-secondary', onClick: refreshStatus }, 'Riprova a verificare')
    ]);
  } else if (statusCopy) {
    const dateDetail = publicationStatus === 'available' && publication.availableUntil
      ? `Disponibile fino al ${formatDateTime(publication.availableUntil)}.`
      : publicationStatus === 'expired' && publication.availableUntil
        ? `La scadenza era ${formatDateTime(publication.availableUntil)}.`
        : publicationStatus === 'withdrawn' && publication.withdrawnAt
          ? `Ritirata il ${formatDateTime(publication.withdrawnAt)}.`
          : '';
    const blockedDetail = publication.blockedReason === 'material_inactive'
      ? 'Il materiale è archiviato o non attivo; riattivalo prima di pubblicarlo.'
      : publication.blockedReason === 'pedagogical_role_changed'
        ? 'Il ruolo del materiale è cambiato rispetto a quello registrato nella pubblicazione.'
        : publication.blockedReason === 'not_student_facing'
          ? 'Il ruolo o il tipo di questa risorsa non è consentito nel portale studenti.'
          : '';
    stateContent = h('div', { key: 'state', className: statusClass, role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' }, [
      h('p', { key: 'label', className: 'availability-state-label' }, 'Pubblicazione agli studenti'),
      h('p', { key: 'value', className: 'availability-state-value' }, statusCopy.label),
      h('p', { key: 'description' }, statusCopy.detail),
      dateDetail ? h('p', { key: 'date', className: 'availability-state-date' }, dateDetail) : null,
      blockedDetail ? h('p', { key: 'blocked', className: 'availability-state-date' }, blockedDetail) : null,
      publication.publishedAt && publicationStatus !== 'available'
        ? h('p', { key: 'published', className: 'availability-state-date' }, `Ultima pubblicazione: ${formatDateTime(publication.publishedAt)}.`)
        : null
    ]);
  } else {
    stateContent = h('div', { key: 'state', className: 'availability-state availability-state-error', role: 'alert' }, [
      h('p', { key: 'label', className: 'availability-state-label' }, 'Pubblicazione agli studenti'),
      h('p', { key: 'value', className: 'availability-state-value' }, 'Stato non disponibile'),
      h('p', { key: 'description' }, 'La risposta del servizio non contiene uno stato riconosciuto.'),
      h('button', { key: 'retry', type: 'button', className: 'btn btn-secondary', onClick: refreshStatus }, 'Riprova a verificare')
    ]);
  }

  const controls = loadState !== 'ready' || !publication
    ? null
    : pendingAction
      ? h('div', { key: 'confirmation', className: 'publication-confirmation', role: 'group', 'aria-labelledby': 'publication-confirmation-title' }, [
        h('div', { key: 'copy' }, [
          h('p', { key: 'eyebrow', className: 'publication-confirmation-kicker' }, pendingAction === 'publish' ? 'Conferma pubblicazione' : 'Conferma ritiro'),
          h('h4', { key: 'title', id: 'publication-confirmation-title' }, pendingAction === 'publish' ? `Rendere visibile ${exactTitle} · v${exactVersion}?` : `Ritirare ${exactTitle} · v${exactVersion}?`),
          h('p', { key: 'detail' }, pendingAction === 'publish'
            ? expiryInput
              ? `Gli studenti potranno consultarla fino al ${formatDateTime(new Date(expiryInput).toISOString())}.`
              : 'Gli studenti potranno consultarla senza una scadenza programmata.'
            : 'Gli studenti non potranno più consultare questa versione dopo il ritiro.')
        ]),
        h('div', { key: 'actions', className: 'publication-confirmation-actions' }, [
          h('button', {
            key: 'confirm',
            ref: confirmationButtonRef,
            type: 'button',
            className: pendingAction === 'publish' ? 'btn btn-primary' : 'btn btn-danger',
            disabled: actionPending,
            onClick: executeAction
          }, actionPending
            ? pendingAction === 'publish' ? 'Pubblicazione in corso…' : 'Ritiro in corso…'
            : pendingAction === 'publish' ? 'Conferma pubblicazione' : 'Conferma ritiro'),
          h('button', {
            key: 'cancel',
            type: 'button',
            className: 'btn btn-secondary',
            disabled: actionPending,
            onClick: () => setPendingAction(null)
          }, 'Annulla')
        ])
      ])
      : canPublish
        ? h('div', { key: 'actions', className: 'publication-actions' }, [
          h('div', { key: 'expiry', className: 'publication-expiry-field' }, [
            h('label', { key: 'label', htmlFor: 'publication-expiry' }, 'Scadenza (facoltativa)'),
            h('input', {
              key: 'input',
              id: 'publication-expiry',
              type: 'datetime-local',
              min: minimumExpiry,
              value: expiryInput,
              onChange: event => setExpiryInput(event.target.value),
              'aria-describedby': 'publication-expiry-help'
            }),
            h('p', { key: 'help', id: 'publication-expiry-help', className: 'publication-help' }, 'Lascia vuoto per mantenere la versione disponibile senza una scadenza programmata.')
          ]),
          !versionIncludedInConfirmation
            ? h('p', { key: 'review-required', className: 'publication-review-required' }, 'Rivedi e conferma nel pacchetto questa versione esatta prima di renderla disponibile.')
            : null,
          h('button', {
            key: 'publish',
            type: 'button',
            className: 'btn btn-primary publication-primary-action',
            onClick: requestPublish
          }, `Pubblica v${exactVersion} agli studenti`)
        ])
        : canWithdraw
          ? h('div', { key: 'actions', className: 'publication-actions publication-withdraw-actions' }, [
            h('p', { key: 'label', className: 'publication-help' }, 'Il ritiro riguarda solo questa versione; le altre versioni pubblicate restano invariate.'),
            h('button', { key: 'withdraw', type: 'button', className: 'btn btn-danger', onClick: requestWithdrawal }, `Ritira v${exactVersion}`)
          ])
          : publicationStatus === 'never_published' || publicationStatus === 'withdrawn' || publicationStatus === 'expired'
            ? h('div', { key: 'blocked', className: 'publication-blocked' }, 'La pubblicazione è disponibile solo dopo la revisione e la conferma della versione esatta nel pacchetto.')
            : null;

  const otherVersions = loadState === 'ready' && publication?.otherAvailableVersions?.length
    ? h('aside', { key: 'other-versions', className: 'publication-other-versions', 'aria-labelledby': 'publication-other-versions-title' }, [
      h('div', { key: 'heading' }, [
        h('p', { key: 'kicker', className: 'publication-confirmation-kicker' }, 'Disponibilità separate'),
        h('h4', { key: 'title', id: 'publication-other-versions-title' }, 'Altre versioni sono ancora disponibili')
      ]),
      h('ul', { key: 'list' }, publication.otherAvailableVersions.map((entry) => h('li', { key: entry.versionNumber }, [
        h('span', { key: 'version', className: 'publication-version-tag' }, `v${entry.versionNumber}`),
        h('span', { key: 'title', className: 'publication-version-title' }, entry.title),
        h('span', { key: 'date', className: 'publication-version-date' }, entry.availableUntil
          ? `Disponibile fino al ${formatDateTime(entry.availableUntil)}`
          : 'Senza scadenza programmata')
      ])))
    ])
    : null;

  return h('section', {
    id: 'preparation-availability',
    className: 'availability-panel preparation-section',
    'aria-labelledby': 'preparation-availability-title'
  }, [
    h('div', { key: 'heading', className: 'flow-section-heading' }, [
      h('p', { key: 'step', className: 'section-kicker' }, '05 · DISPONIBILITÀ'),
      h('h3', { key: 'title', id: 'preparation-availability-title' }, 'Disponibilità agli studenti'),
      h('p', { key: 'intro' }, 'Controlla lo stato reale della versione e scegli esplicitamente se renderla disponibile.')
    ]),
    stateContent,
    h('dl', { key: 'details', className: 'availability-details' }, [
      h('div', { key: 'material' }, [
        h('dt', null, 'Materiale selezionato'),
        h('dd', null, exactTitle)
      ]),
      h('div', { key: 'version' }, [
        h('dt', null, 'Versione esatta'),
        h('dd', null, hasExactVersion ? `v${exactVersion}` : 'Nessuna versione')
      ]),
      h('div', { key: 'prep' }, [
        h('dt', null, 'Nel pacchetto della lezione'),
        h('dd', null, materialPreparationState)
      ])
    ]),
    actionError ? h('div', { key: 'action-error', className: 'publication-action-error', role: 'alert' }, actionError) : null,
    notice ? h('p', { key: 'notice', className: 'publication-action-notice', role: 'status', 'aria-live': 'polite' }, notice) : null,
    controls,
    otherVersions,
    h('p', { key: 'separation', className: 'availability-separation' }, [
      h('strong', { key: 'strong' }, 'Preparazione e pubblicazione sono azioni distinte. '),
      'La conferma congela le versioni del pacchetto ma non le rende visibili agli studenti. Pubblicare o ritirare qui riguarda solo la versione esatta mostrata sopra.'
    ])
  ]);
}
