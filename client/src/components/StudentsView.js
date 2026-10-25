import React, { createElement as h, useState, useEffect } from 'react';

export function StudentsView() {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [classPinStatus, setClassPinStatus] = useState(null);
  const [newClassPin, setNewClassPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState('');

  // Add student form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // Bulk import modal
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  useEffect(() => {
    fetch('/api/classes')
      .then(res => res.json())
      .then(data => {
        if (data.classes && data.classes.length > 0) {
          setClasses(data.classes);
          setSelectedClassId(data.classes[0].id);
        }
      })
      .catch(err => setError('Errore caricamento classi: ' + err.message));
  }, []);

  const loadStudents = (classId) => {
    if (!classId) return;
    setLoading(true);
    fetch(`/api/classes/${encodeURIComponent(classId)}/students`)
      .then(res => res.json())
      .then(data => {
        setStudents(data.students || []);
        setLoading(false);
      })
      .catch(err => {
        setError('Errore caricamento studenti: ' + err.message);
        setLoading(false);
      });
  };

  const loadClassPinStatus = async (classId) => {
    if (!classId) return;
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(classId)}/activity-pin`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Impossibile leggere lo stato del PIN');
      setClassPinStatus(payload.pin);
      setPinError('');
    } catch (error) {
      setClassPinStatus(null);
      setPinError(error.message);
    }
  };

  useEffect(() => {
    if (selectedClassId) {
      loadStudents(selectedClassId);
      setNewClassPin('');
      void loadClassPinStatus(selectedClassId);
    }
  }, [selectedClassId]);

  const generateClassPin = async () => {
    if (!selectedClassId) return;
    if (classPinStatus?.active && !confirm('Rigenerare il PIN invaliderà i nuovi accessi alla sezione Attività. Le prove già iniziate continueranno senza interruzioni. Procedere?')) return;
    setPinBusy(true);
    setPinError('');
    setNewClassPin('');
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(selectedClassId)}/activity-pin`, { method: 'POST' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Impossibile generare il PIN');
      setNewClassPin(payload.pin.pin);
      await loadClassPinStatus(selectedClassId);
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinBusy(false);
    }
  };

  const revokeClassPin = async () => {
    if (!selectedClassId || !confirm('Revocare il PIN impedirà i nuovi accessi alle Attività. Le prove già iniziate non saranno invalidate.')) return;
    setPinBusy(true);
    setPinError('');
    setNewClassPin('');
    try {
      const response = await fetch(`/api/classes/${encodeURIComponent(selectedClassId)}/activity-pin`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Impossibile revocare il PIN');
      await loadClassPinStatus(selectedClassId);
    } catch (error) {
      setPinError(error.message);
    } finally {
      setPinBusy(false);
    }
  };

  const handleAddStudent = (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !selectedClassId) return;

    fetch(`/api/classes/${encodeURIComponent(selectedClassId)}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null
      })
    })
      .then(res => res.json())
      .then(data => {
        setFirstName('');
        setLastName('');
        setEmail('');
        setSuccessMsg(`Studente ${data.student.first_name} ${data.student.last_name} aggiunto con successo`);
        setTimeout(() => setSuccessMsg(''), 4000);
        loadStudents(selectedClassId);
      })
      .catch(err => setError('Errore aggiunta studente: ' + err.message));
  };

  const handleBulkImport = (e) => {
    e.preventDefault();
    if (!bulkText.trim() || !selectedClassId) return;

    // Parse lines: each line can be "Cognome Nome" or "Cognome, Nome, email"
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedStudents = lines.map(line => {
      if (line.includes(',')) {
        const parts = line.split(',').map(p => p.trim());
        return {
          lastName: parts[0] || 'Cognome',
          firstName: parts[1] || 'Nome',
          email: parts[2] || null
        };
      } else {
        const words = line.split(/\s+/);
        return {
          lastName: words[0] || 'Cognome',
          firstName: words.slice(1).join(' ') || 'Nome',
          email: null
        };
      }
    });

    fetch(`/api/classes/${encodeURIComponent(selectedClassId)}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: parsedStudents })
    })
      .then(res => res.json())
      .then(data => {
        setIsBulkOpen(false);
        setBulkText('');
        setSuccessMsg(`Importati ${data.count || parsedStudents.length} studenti con successo`);
        setTimeout(() => setSuccessMsg(''), 4000);
        loadStudents(selectedClassId);
      })
      .catch(err => setError('Errore importazione studenti: ' + err.message));
  };

  const handleDeleteStudent = (studentId, fullName) => {
    if (!confirm(`Sei sicuro di voler rimuovere lo studente ${fullName}?`)) return;

    fetch(`/api/classes/${encodeURIComponent(selectedClassId)}/students/${encodeURIComponent(studentId)}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(() => {
        setSuccessMsg(`Studente rimosso`);
        setTimeout(() => setSuccessMsg(''), 4000);
        loadStudents(selectedClassId);
      })
      .catch(err => setError('Errore eliminazione studente: ' + err.message));
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return h('div', { className: 'view-container students-view' }, [
    // Top Bar: Class Selector + Actions
    h('div', { key: 'top-bar', className: 'view-header-row' }, [
      h('div', { className: 'class-filter-box' }, [
        h('label', { className: 'filter-label' }, 'Classe:'),
        h('select', {
          className: 'select-class-dropdown',
          value: selectedClassId,
          onChange: e => setSelectedClassId(e.target.value)
        }, classes.map(c => h('option', { key: c.id, value: c.id }, `${c.name} (${c.academic_year || ''})`)))
      ]),
      h('div', { className: 'actions-group' }, [
        h('button', {
          type: 'button',
          className: 'btn-secondary-action',
          onClick: () => setIsBulkOpen(true)
        }, '📥 Importa Elenco Roster')
      ])
    ]),

    // Shared class PIN management. Cleartext is shown only immediately after generation.
    h('section', { key: 'class-pin', className: 'card class-pin-manager', 'aria-labelledby': 'class-pin-title' }, [
      h('div', { className: 'class-pin-manager-copy' }, [
        h('h3', { id: 'class-pin-title' }, 'Accesso alle Attività'),
        h('p', null, classPinStatus?.active
          ? 'Il PIN condiviso è attivo. Comunicalo alla classe per abilitare l’elenco delle attività.'
          : 'Genera un PIN condiviso di quattro cifre per consentire l’accesso alle attività della classe.'),
        classPinStatus?.active && h('p', { className: 'class-pin-status' }, `Attivo dal ${new Date(classPinStatus.createdAt).toLocaleString()}. Il PIN non viene conservato in chiaro e non può essere riletto.`),
        classPinStatus && !classPinStatus.configured && h('p', { className: 'error-msg-banner', role: 'alert' }, 'Accesso alle attività non configurato sul server: manca il segreto stabile previsto per il PIN di classe.'),
        newClassPin && h('div', { className: 'class-pin-reveal', role: 'status', 'aria-live': 'polite' }, [
          h('span', null, 'Nuovo PIN — mostralo alla classe ora'),
          h('strong', { className: 'class-pin-value' }, newClassPin)
        ]),
        pinError && h('p', { className: 'error-msg-banner', role: 'alert' }, pinError)
      ]),
      h('div', { className: 'class-pin-manager-actions' }, [
        h('button', { type: 'button', className: 'btn btn-primary', disabled: pinBusy || !selectedClassId || !classPinStatus?.configured, onClick: generateClassPin }, pinBusy ? 'Attendi…' : classPinStatus?.active ? 'Rigenera PIN' : 'Genera PIN'),
        classPinStatus?.active && h('button', { type: 'button', className: 'btn btn-secondary', disabled: pinBusy, onClick: revokeClassPin }, 'Revoca PIN')
      ])
    ]),

    // Messages
    error && h('div', { key: 'err', className: 'error-msg-banner' }, error),
    successMsg && h('div', { key: 'succ', className: 'success-msg-banner' }, successMsg),

    // Quick Add Student Inline Bar
    h('div', { key: 'quick-add', className: 'quick-add-student-card' }, [
      h('h3', { className: 'quick-add-title' }, `Aggiungi singolo studente a ${selectedClass?.name}`),
      h('form', { className: 'quick-add-form', onSubmit: handleAddStudent }, [
        h('input', {
          type: 'text',
          placeholder: 'Cognome *',
          required: true,
          className: 'input-text',
          value: lastName,
          onChange: e => setLastName(e.target.value)
        }),
        h('input', {
          type: 'text',
          placeholder: 'Nome *',
          required: true,
          className: 'input-text',
          value: firstName,
          onChange: e => setFirstName(e.target.value)
        }),
        h('input', {
          type: 'email',
          placeholder: 'Email istituzionale (opzionale)',
          className: 'input-text',
          value: email,
          onChange: e => setEmail(e.target.value)
        }),
        h('button', {
          type: 'submit',
          className: 'btn-add-student'
        }, '+ Aggiungi Studente')
      ])
    ]),

    // Students Table
    h('div', { key: 'table-wrap', className: 'students-table-wrapper' }, [
      loading ? h('p', { className: 'loading-text' }, 'Caricamento elenco studenti...') :
      students.length === 0 ? (
        h('div', { className: 'empty-state-box' }, [
          h('span', { className: 'empty-icon' }, '👥'),
          h('h3', null, `Nessuno studente iscritto a ${selectedClass?.name}`),
          h('p', null, 'Aggiungi il primo studente o importa l\'elenco massivo della classe.')
        ])
      ) : (
        h('table', { className: 'data-table' }, [
          h('thead', null, [
            h('tr', null, [
              h('th', null, '#'),
              h('th', null, 'Cognome e Nome'),
              h('th', null, 'Email Istituzionale'),
              h('th', null, 'ID Sistema'),
              h('th', null, 'Azioni')
            ])
          ]),
          h('tbody', null,
            students.map((s, idx) => h('tr', { key: s.id }, [
              h('td', { className: 'cell-idx' }, idx + 1),
              h('td', { className: 'cell-student-name' }, [
                h('span', { className: 'student-avatar-inline' }, '👤'),
                h('strong', null, `${s.last_name} `),
                h('span', null, s.first_name)
              ]),
              h('td', null, s.email || '—'),
              h('td', { className: 'cell-mono' }, s.id),
              h('td', { className: 'cell-actions' }, [
                h('button', {
                  type: 'button',
                  className: 'btn-action-delete',
                  title: 'Rimuovi studente',
                  onClick: () => handleDeleteStudent(s.id, `${s.last_name} ${s.first_name}`)
                }, '🗑 Rimuovi')
              ])
            ]))
          )
        ])
      )
    ]),

    // Bulk Import Modal
    isBulkOpen && h('div', { key: 'bulk-modal', className: 'modal-overlay' }, [
      h('div', { className: 'modal-dialog' }, [
        h('div', { className: 'modal-header' }, [
          h('h3', { className: 'modal-title' }, `Importazione Massiva Studenti — ${selectedClass?.name}`)
        ]),
        h('form', { onSubmit: handleBulkImport }, [
          h('div', { className: 'modal-body' }, [
            h('p', { className: 'modal-help' },
              'Incolla l\'elenco degli studenti della classe (uno per riga). Formati supportati: "Cognome Nome" oppure "Cognome, Nome, email".'
            ),
            h('textarea', {
              className: 'form-textarea bulk-textarea',
              rows: 10,
              placeholder: 'Cognome Nome\nCognome, Nome, email@esempio.example',
              required: true,
              value: bulkText,
              onChange: e => setBulkText(e.target.value)
            })
          ]),
          h('div', { className: 'modal-footer' }, [
            h('button', {
              type: 'button',
              className: 'btn-secondary',
              onClick: () => setIsBulkOpen(false)
            }, 'Annulla'),
            h('button', {
              type: 'submit',
              className: 'btn-primary'
            }, 'Importa Elenco Studenti')
          ])
        ])
      ])
    ])
  ]);
}
