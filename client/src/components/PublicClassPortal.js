import React, { createElement as h, useCallback, useEffect, useState } from 'react';
import { MarkdownViewer } from './MarkdownViewer.js';

async function readJson(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || `Richiesta non riuscita (${response.status})`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function readLocation() {
  const match = window.location.pathname.match(/^\/studente\/classi\/([^/]+)(?:\/materiali\/([^/]+)\/versions\/(\d+))?\/?$/);
  return match
    ? { classId: decodeURIComponent(match[1]), materialId: match[2] ? decodeURIComponent(match[2]) : null, version: match[3] ? Number(match[3]) : null }
    : { classId: null, materialId: null, version: null };
}

export function PublicClassPortal({ onAttemptStarted, notice = '' }) {
  const [location, setLocation] = useState(readLocation);
  const [classes, setClasses] = useState([]);
  const [classroom, setClassroom] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [students, setStudents] = useState([]);
  const [neighbors, setNeighbors] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [seatRow, setSeatRow] = useState('');
  const [seatDesk, setSeatDesk] = useState('');
  const [leftNeighborId, setLeftNeighborId] = useState('none');
  const [rightNeighborId, setRightNeighborId] = useState('none');
  const [pin, setPin] = useState('');
  const [page, setPage] = useState('classes');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const navigate = useCallback((url) => {
    window.history.pushState({}, '', url);
    setLocation(readLocation());
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, []);

  useEffect(() => {
    const handlePopState = () => setLocation(readLocation());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    readJson('/api/student/classes')
      .then((data) => { if (!cancelled) setClasses(data.classes || []); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!location.classId) {
      setClassroom(null);
      setMaterials([]);
      setSelectedMaterial(null);
      setPage('classes');
      setError('');
      return undefined;
    }
    let cancelled = false;
    setBusy(true);
    setError('');
    Promise.all([
      readJson(`/api/student/classes/${encodeURIComponent(location.classId)}`),
      readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/materials`)
    ]).then(([classData, materialData]) => {
      if (cancelled) return;
      setClassroom(classData.class);
      setMaterials(materialData.materials || []);
      setPage(location.materialId ? 'material' : 'class');
    }).catch((err) => {
      if (!cancelled) setError(err.message);
    }).finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [location.classId, location.materialId]);

  useEffect(() => {
    if (!location.classId || !location.materialId || !location.version) {
      setSelectedMaterial(null);
      return undefined;
    }
    let cancelled = false;
    readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/materials/${encodeURIComponent(location.materialId)}/versions/${location.version}`)
      .then((data) => { if (!cancelled) setSelectedMaterial(data.material); })
      .catch((err) => {
        if (!cancelled) {
          setSelectedMaterial(null);
          setError(err.status === 404
            ? 'Questo materiale non è più disponibile: potrebbe essere stato ritirato o la scadenza è terminata.'
            : err.message);
        }
      });
    return () => { cancelled = true; };
  }, [location.classId, location.materialId, location.version]);

  useEffect(() => {
    if (!location.classId || !selectedActivity || !selectedStudentId) {
      setNeighbors([]);
      return undefined;
    }
    let cancelled = false;
    readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/activities/${encodeURIComponent(selectedActivity.id)}/neighbors?studentId=${encodeURIComponent(selectedStudentId)}`)
      .then((data) => { if (!cancelled) setNeighbors(data.neighbors || []); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [location.classId, selectedActivity, selectedStudentId]);

  const openClass = (classId) => {
    setPin('');
    setSelectedActivity(null);
    setActivities([]);
    navigate(`/studente/classi/${encodeURIComponent(classId)}`);
  };

  const openActivities = async () => {
    if (!location.classId) return;
    setBusy(true);
    setError('');
    try {
      const data = await readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/activities`);
      setActivities(data.activities || []);
      setPage('activities');
    } catch (err) {
      if (err.status === 401 || err.status === 403) setPage('pin');
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const enterWithPin = async (event) => {
    event.preventDefault();
    if (!location.classId || !/^\d{4}$/.test(pin)) {
      setError('Inserisci il PIN della classe: quattro cifre.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/activities`);
      setActivities(data.activities || []);
      setPin('');
      setPage('activities');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const chooseActivity = async (activity) => {
    setSelectedActivity(activity);
    setSelectedStudentId('');
    setSeatRow('');
    setSeatDesk('');
    setLeftNeighborId('none');
    setRightNeighborId('none');
    setNeighbors([]);
    setBusy(true);
    setError('');
    try {
      const data = await readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/activities/${encodeURIComponent(activity.id)}/students`);
      setStudents(data.students || []);
      setPage('identity');
    } catch (err) {
      setError(err.message);
      if (err.status === 401 || err.status === 403) setPage('pin');
    } finally {
      setBusy(false);
    }
  };

  const startAttempt = async (event) => {
    event.preventDefault();
    if (!selectedActivity || !selectedStudentId || !seatRow.trim()) {
      setError('Seleziona il nominativo e indica la fila prima di iniziare.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const data = await readJson(`/api/student/classes/${encodeURIComponent(location.classId)}/activities/${encodeURIComponent(selectedActivity.id)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: selectedStudentId,
          seatRow: seatRow.trim(),
          seatDesk: seatDesk.trim(),
          leftNeighborId,
          rightNeighborId
        })
      });
      const attempt = data.session;
      if (!attempt?.token || !attempt.studentId || !attempt.assessmentId) throw new Error('Il server non ha restituito una sessione di prova valida.');
      const cacheKey = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}-${Math.random()}`;
      sessionStorage.setItem('teacher_service_student_token', attempt.token);
      sessionStorage.setItem('teacher_service_student_cache_key', cacheKey);
      navigate(`/studente/prova/${encodeURIComponent(attempt.assessmentId)}`);
      onAttemptStarted?.({ ...attempt, cacheKey });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const exitActivities = async () => {
    if (location.classId) {
      await fetch(`/api/student/classes/${encodeURIComponent(location.classId)}/exit`, { method: 'POST', credentials: 'same-origin' }).catch(() => {});
    }
    setActivities([]);
    setSelectedActivity(null);
    setPage('class');
  };

  const backToClass = () => {
    setError('');
    setPage('class');
    setSelectedActivity(null);
    setActivities([]);
  };

  const materialUrl = (material, suffix) => `/api/student/classes/${encodeURIComponent(location.classId)}/materials/${encodeURIComponent(material.id)}/versions/${material.versionNumber}${suffix}`;
  const selectedFormat = String(selectedMaterial?.format || '').toLowerCase();
  const previewIsPdf = selectedFormat === 'pdf' || selectedMaterial?.mimeType === 'application/pdf';

  return h('main', { className: 'public-class-portal', 'aria-live': 'polite' }, [
    h('header', { key: 'header', className: 'public-portal-header' }, [
      h('a', { href: '/', className: 'public-portal-brand' }, 'Teacher Service'),
      h('span', { className: 'public-portal-label' }, 'Area studenti')
    ]),
    h('div', { key: 'content', className: 'public-portal-content' }, [
      notice && h('div', { key: 'notice', className: 'success-msg-banner', role: 'status' }, notice),
      error && h('div', { key: 'error', className: 'error-msg-banner', role: 'alert' }, error),
      busy && h('p', { key: 'busy', className: 'portal-loading', role: 'status' }, 'Caricamento…'),
      page === 'classes' && h('section', { key: 'classes', className: 'public-page' }, [
        h('a', { href: '/', className: 'portal-breadcrumb' }, '← Home'),
        h('p', { className: 'portal-eyebrow' }, 'Accesso pubblico'),
        h('h1', null, 'Scegli la tua classe'),
        h('p', { className: 'portal-lead' }, 'Consulta i materiali pubblicati oppure accedi alle attività con il PIN condiviso dalla classe.'),
        classes.length ? h('div', { className: 'public-class-grid' }, classes.map((item) => h('button', {
          key: item.id,
          type: 'button',
          className: 'public-class-card',
          onClick: () => openClass(item.id)
        }, [
          h('span', { className: 'public-class-icon', 'aria-hidden': 'true' }, '▤'),
          h('strong', null, item.name),
          h('span', null, [item.section, item.academicYear].filter(Boolean).join(' · ')),
          h('span', { className: 'public-card-link' }, 'Apri classe →')
        ]))) : h('div', { className: 'empty-state-box' }, 'Al momento non ci sono classi da mostrare.')
      ]),

      page === 'class' && classroom && h('section', { key: 'class-page', className: 'public-page' }, [
        h('button', { type: 'button', className: 'portal-breadcrumb portal-back-button', onClick: () => navigate('/studente') }, '← Tutte le classi'),
        h('p', { className: 'portal-eyebrow' }, 'Classe'),
        h('h1', null, classroom.name),
        h('div', { className: 'class-public-sections' }, [
          h('section', { className: 'class-public-section', 'aria-labelledby': 'materials-heading' }, [
            h('div', { className: 'section-heading-row' }, [
              h('div', null, [h('p', { className: 'portal-eyebrow' }, 'Consultazione libera'), h('h2', { id: 'materials-heading' }, 'Materiali')]),
              h('span', { className: 'public-count' }, `${materials.length} pubblicati`)
            ]),
            materials.length ? h('ul', { className: 'public-material-list' }, materials.map((material) => h('li', { key: `${material.id}:${material.versionNumber}` }, [
              h('button', { type: 'button', className: 'public-material-link', onClick: () => navigate(`/studente/classi/${encodeURIComponent(location.classId)}/materiali/${encodeURIComponent(material.id)}/versions/${material.versionNumber}`) }, [
                h('span', { className: 'material-format-badge' }, String(material.format || 'materiale').toUpperCase()),
                h('span', { className: 'public-material-copy' }, [h('strong', null, material.title), material.description && h('small', null, material.description), h('small', null, `Versione ${material.versionNumber}`)]),
                h('span', { 'aria-hidden': 'true' }, '→')
              ])
            ]))) : h('p', { className: 'empty-state-text' }, 'Non sono presenti materiali pubblicati e disponibili.')
          ]),
          h('section', { className: 'class-public-section class-activities-section', 'aria-labelledby': 'activities-heading' }, [
            h('div', null, [h('p', { className: 'portal-eyebrow' }, 'Accesso con PIN'), h('h2', { id: 'activities-heading' }, 'Attività')]),
            h('p', null, 'Verifiche ed esercitazioni attive per la classe sono disponibili dopo l’inserimento del PIN condiviso.'),
            h('button', { type: 'button', className: 'btn btn-primary', onClick: openActivities, disabled: busy }, 'Accedi alle attività →')
          ])
        ])
      ]),

      page === 'material' && selectedMaterial && h('article', { key: 'material', className: 'public-page public-material-reader' }, [
        h('button', { type: 'button', className: 'portal-breadcrumb portal-back-button', onClick: () => navigate(`/studente/classi/${encodeURIComponent(location.classId)}`) }, `← ${classroom?.name || 'Classe'}`),
        h('p', { className: 'portal-eyebrow' }, `${selectedMaterial.resourceType || 'Materiale'} · Versione ${selectedMaterial.versionNumber}`),
        h('h1', null, selectedMaterial.title),
        selectedMaterial.description && h('p', { className: 'portal-lead' }, selectedMaterial.description),
        h('div', { className: 'public-material-reader-actions' }, [
          h('span', null, 'Materiale pubblicato per gli studenti'),
          h('a', { className: 'btn btn-secondary', href: materialUrl(selectedMaterial, '/download') }, 'Scarica originale')
        ]),
        previewIsPdf
          ? h('iframe', { className: 'public-pdf-frame', title: `Lettore PDF: ${selectedMaterial.title}`, src: materialUrl(selectedMaterial, '/preview'), loading: 'lazy' })
          : selectedFormat === 'markdown' || selectedFormat === 'md'
            ? h('div', { className: 'public-markdown-reader' }, h(MarkdownViewer, { content: selectedMaterial.content || '' }))
            : h('pre', { className: 'public-text-reader' }, selectedMaterial.content || 'Anteprima non disponibile. Scarica il documento originale.')
      ]),

      page === 'pin' && h('section', { key: 'pin', className: 'public-page portal-form-page' }, [
        h('button', { type: 'button', className: 'portal-breadcrumb portal-back-button', onClick: backToClass }, '← Torna alla classe'),
        h('p', { className: 'portal-eyebrow' }, classroom?.name || 'Accesso alla classe'),
        h('h1', null, 'Inserisci il PIN'),
        h('p', { className: 'portal-lead' }, 'Il PIN è condiviso con la classe e consente di vedere solo le attività attualmente attive.'),
        h('form', { className: 'portal-access-form', onSubmit: enterWithPin }, [
          h('label', { htmlFor: 'class-pin-input' }, 'PIN della classe'),
          h('input', { id: 'class-pin-input', type: 'text', inputMode: 'numeric', pattern: '[0-9]{4}', maxLength: 4, value: pin, autoComplete: 'off', onChange: (event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4)), placeholder: '0000', required: true }),
          h('button', { type: 'submit', className: 'btn btn-primary', disabled: busy || pin.length !== 4 }, busy ? 'Verifica…' : 'Continua')
        ])
      ]),

      page === 'activities' && classroom && h('section', { key: 'activities', className: 'public-page' }, [
        h('button', { type: 'button', className: 'portal-breadcrumb portal-back-button', onClick: backToClass }, '← Torna ai materiali della classe'),
        h('p', { className: 'portal-eyebrow' }, classroom.name),
        h('h1', null, 'Attività disponibili'),
        activities.length ? h('div', { className: 'public-activity-list' }, activities.map((activity) => h('button', { key: activity.id, type: 'button', className: 'public-activity-card', onClick: () => chooseActivity(activity) }, [
          h('div', null, [h('span', { className: 'active-status-pill' }, 'Attiva'), h('h2', null, activity.title), activity.description && h('p', null, activity.description)]),
          h('div', { className: 'public-activity-meta' }, [`${activity.durationMinutes || '—'} min`, `${activity.maxScore || '—'} punti`, 'Scegli →'].map((label) => h('span', { key: label }, label)))
        ]))) : h('div', { className: 'empty-state-box' }, [h('h2', null, 'Nessuna attività disponibile'), h('p', null, 'Il docente non ha attività attive per la classe in questo momento.')]),
        h('button', { type: 'button', className: 'btn btn-secondary portal-exit-button', onClick: exitActivities }, 'Esci dall’area Attività')
      ]),

      page === 'identity' && selectedActivity && h('section', { key: `identity-${selectedActivity.id}`, className: 'public-page portal-form-page' }, [
        h('button', { type: 'button', className: 'portal-breadcrumb portal-back-button', onClick: () => setPage('activities') }, '← Elenco attività'),
        h('p', { className: 'portal-eyebrow' }, `Attività · ${classroom?.name || ''}`),
        h('h1', null, selectedActivity.title),
        h('p', { className: 'portal-lead' }, 'Seleziona il tuo nominativo e dichiara la disposizione in aula prima di avviare.'),
        h('form', { className: 'portal-identity-form', onSubmit: startAttempt }, [
          h('label', { htmlFor: 'student-name-select' }, 'Il tuo nominativo'),
          h('select', { id: 'student-name-select', value: selectedStudentId, onChange: (event) => setSelectedStudentId(event.target.value), required: true }, [h('option', { value: '' }, 'Seleziona…'), ...students.map((student) => h('option', { key: student.id, value: student.id }, student.fullName))]),
          h('div', { className: 'seat-declaration-grid' }, [
            h('label', null, ['Fila', h('input', { type: 'text', value: seatRow, maxLength: 80, onChange: (event) => setSeatRow(event.target.value), placeholder: 'Es. Fila 2', required: true })]),
            h('label', null, ['Banco (facoltativo)', h('input', { type: 'text', value: seatDesk, maxLength: 80, onChange: (event) => setSeatDesk(event.target.value), placeholder: 'Es. Banco 4' })]),
            h('label', null, ['Vicino a sinistra', h('select', { value: leftNeighborId, onChange: (event) => setLeftNeighborId(event.target.value) }, neighbors.map((neighbor) => h('option', { key: `left-${neighbor.id}`, value: neighbor.id }, neighbor.fullName)))]),
            h('label', null, ['Vicino a destra', h('select', { value: rightNeighborId, onChange: (event) => setRightNeighborId(event.target.value) }, neighbors.map((neighbor) => h('option', { key: `right-${neighbor.id}`, value: neighbor.id }, neighbor.fullName)))])
          ]),
          h('p', { className: 'portal-identity-disclaimer' }, 'La scelta del nominativo è dichiarativa e non costituisce un account o una verifica d’identità. Le risposte salvate sul server restano associate all’attività e al nominativo selezionato.'),
          h('button', { type: 'submit', className: 'btn btn-primary', disabled: busy || !selectedStudentId || !seatRow.trim() }, busy ? 'Avvio…' : 'Inizia attività')
        ])
      ])
    ])
  ]);
}
