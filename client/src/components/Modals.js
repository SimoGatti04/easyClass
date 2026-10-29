import React, { createElement as h, useState } from 'react';

export function ModalBackdrop({ title, onClose, children }) {
  return h('div', { className: 'modal-backdrop', onClick: onClose }, [
    h('div', { className: 'modal-content', onClick: (e) => e.stopPropagation() }, [
      h('div', { key: 'hdr', className: 'modal-header' }, [
        h('h3', { key: 't' }, title),
        h('button', { key: 'x', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onClose }, '✕')
      ]),
      h('div', { key: 'body', style: { padding: '1.25rem 0' } }, children)
    ])
  ]);
}

export function NewClassModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026/2027');
  const [section, setSection] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), academicYear: academicYear.trim(), section: section.trim() || undefined });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return h(ModalBackdrop, { title: 'Nuova Classe', onClose }, [
    h('form', { onSubmit: handleFormSubmit }, [
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Nome Classe *'),
        h('input', {
          type: 'text',
          className: 'form-control',
          id: 'class-name', placeholder: 'es. 4A Informatica',
          value: name,
          onChange: (e) => setName(e.target.value),
          required: true
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Anno Scolastico *'),
        h('input', {
          type: 'text',
          className: 'form-control',
          id: 'class-year', value: academicYear,
          onChange: (e) => setAcademicYear(e.target.value),
          required: true
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Sezione'),
        h('input', {
          type: 'text',
          className: 'form-control',
          placeholder: 'es. A',
          value: section,
          onChange: (e) => setSection(e.target.value)
        })
      ]),
      h('div', { className: 'modal-footer' }, [
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose, disabled: submitting }, 'Annulla'),
        h('button', { id: 'modal-btn-submit-class', type: 'submit', className: 'btn btn-primary', disabled: submitting }, submitting ? 'Creazione...' : 'Crea Classe')
      ])
    ])
  ]);
}

export function NewSubjectModal({ classId, onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({ classId, name: name.trim(), code: code.trim() || undefined });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return h(ModalBackdrop, { title: 'Nuova Materia', onClose }, [
    h('form', { onSubmit: handleFormSubmit }, [
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Nome Materia *'),
        h('input', {
          type: 'text',
          className: 'form-control',
          id: 'subject-name',
          placeholder: 'es. Sistemi e Reti, Informatica...',
          value: name,
          onChange: (e) => setName(e.target.value),
          required: true
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Codice Materia (opzionale)'),
        h('input', {
          type: 'text',
          className: 'form-control',
          placeholder: 'es. SR4, INF',
          value: code,
          onChange: (e) => setCode(e.target.value)
        })
      ]),
      h('div', { className: 'modal-footer' }, [
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose, disabled: submitting }, 'Annulla'),
        h('button', { id: 'modal-btn-submit-subject', type: 'submit', className: 'btn btn-primary', disabled: submitting }, submitting ? 'Creazione...' : 'Crea Materia')
      ])
    ])
  ]);
}

export function NewLessonModal({ classId, subjectId, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [submitting, setSubmitting] = useState(false);

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        classId,
        subjectId,
        title: title.trim(),
        date: date || undefined,
        durationMinutes: Number(durationMinutes) || 60
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return h(ModalBackdrop, { title: 'Nuova Lezione Didattica', onClose }, [
    h('form', { onSubmit: handleFormSubmit }, [
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Argomento Principale della Lezione *'),
        h('input', {
          type: 'text',
          className: 'form-control',
          id: 'lesson-title',
          placeholder: 'es. Handshake a tre vie TCP e controllo di flusso',
          value: title,
          onChange: (e) => setTitle(e.target.value),
          required: true
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Data Programmata'),
        h('input', {
          type: 'date',
          className: 'form-control',
          value: date,
          onChange: (e) => setDate(e.target.value)
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Durata (Minuti)'),
        h('input', {
          id: 'lesson-duration',
          type: 'number',
          className: 'form-control',
          min: 15,
          max: 300,
          value: durationMinutes,
          onChange: (e) => setDurationMinutes(e.target.value)
        })
      ]),
      h('div', { className: 'modal-footer' }, [
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose, disabled: submitting }, 'Annulla'),
        h('button', { id: 'modal-btn-submit-lesson', type: 'submit', className: 'btn btn-primary', disabled: submitting }, submitting ? 'Creazione...' : 'Crea Lezione')
      ])
    ])
  ]);
}

export function UploadModal({ classId, subjectId, lessonId, onClose, onUpload }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [title, setTitle] = useState('');
  const [role, setRole] = useState('support_material');
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e) {
    const f = e.target.files?.[0];
    if (f) {
      setSelectedFile(f);
      if (!title) {
        setTitle(f.name.replace(/\.[^/.]+$/, ''));
      }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedFile) return;
    setUploading(true);
    try {
      await onUpload(selectedFile, title || selectedFile.name, role);
      onClose();
    } finally {
      setUploading(false);
    }
  }

  return h(ModalBackdrop, { title: 'Carica Documento di Supporto', onClose }, [
    h('form', { onSubmit: handleSubmit }, [
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'File da caricare (.pdf, .docx, .md, .txt, .html) *'),
        h('input', {
          type: 'file',
          className: 'form-control',
          accept: '.pdf,.docx,.md,.txt,.html',
          onChange: handleFileChange,
          required: true
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Titolo del Materiale'),
        h('input', {
          type: 'text',
          className: 'form-control',
          placeholder: 'Titolo descrittivo per gli studenti o il docente',
          value: title,
          onChange: (e) => setTitle(e.target.value)
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Ruolo Didattico'),
        h(
          'select',
          {
            className: 'form-select',
            value: role,
            onChange: (e) => setRole(e.target.value)
          },
          [
            h('option', { value: 'support_material' }, 'Materiale di Supporto (fonte per AI / approfondimento)'),
            h('option', { value: 'teacher_material' }, 'Materiale Docente (riservato)'),
            h('option', { value: 'student_material' }, 'Materiale Studenti (pubblicabile)')
          ]
        )
      ]),
      h('div', { className: 'modal-footer' }, [
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose, disabled: uploading }, 'Annulla'),
        h('button', { type: 'submit', className: 'btn btn-primary', disabled: !selectedFile || uploading }, uploading ? 'Caricamento sicuro...' : 'Carica File')
      ])
    ])
  ]);
}

export function RevisionModal({ artifact, onClose, onSubmitRevision, onSubmitRegenerateSection }) {
  const [instruction, setInstruction] = useState('');
  const [sectionTitle, setSectionTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!instruction.trim()) return;
    setSubmitting(true);
    try {
      if (sectionTitle.trim()) {
        await onSubmitRegenerateSection(artifact.id, sectionTitle.trim(), instruction.trim());
      } else {
        await onSubmitRevision(artifact.id, instruction.trim());
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return h(ModalBackdrop, { title: `Revisione AI: ${artifact.title}`, onClose }, [
    h('form', { onSubmit: handleSubmit }, [
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Istruzione per la revisione *'),
        h('textarea', {
          className: 'form-control',
          rows: 4,
          placeholder: 'Es. Approfondisci la spiegazione del three-way handshake aggiungendo un diagramma ascii, oppure semplifica il linguaggio per studenti con BES...',
          value: instruction,
          onChange: (e) => setInstruction(e.target.value),
          required: true
        })
      ]),
      h('div', { className: 'form-group' }, [
        h('label', { className: 'form-label' }, 'Rigenera solo una specifica sezione (opzionale)'),
        h('input', {
          type: 'text',
          className: 'form-control',
          placeholder: 'Titolo esatto della sezione Markdown (es. "Fase di Chiusura TCP")',
          value: sectionTitle,
          onChange: (e) => setSectionTitle(e.target.value)
        })
      ]),
      h('div', { className: 'modal-footer' }, [
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose, disabled: submitting }, 'Annulla'),
        h('button', { type: 'submit', className: 'btn btn-primary', disabled: submitting }, submitting ? 'Elaborazione AI...' : 'Applica Revisione')
      ])
    ])
  ]);
}

export function ConfirmPrepModal({ pack, onClose, onConfirm }) {
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function handleConfirmSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      await onConfirm(notes);
      onClose();
    } catch (error) {
      setSubmitError(error?.message || 'Non è stato possibile confermare il pacchetto. Riprova.');
    } finally {
      setSubmitting(false);
    }
  }

  const artifacts = pack?.artifacts || {};
  const versions = [
    ['Piano di lezione', artifacts.lessonPlan],
    ['Copione docente', artifacts.teacherScript],
    ['Esercizi graduati', artifacts.exercises],
    ['Dispensa studenti', artifacts.studentMaterial]
  ];

  return h(ModalBackdrop, { title: 'Conferma le versioni del pacchetto', onClose }, [
    h('form', { key: 'form', onSubmit: handleConfirmSubmit }, [
      h('p', { key: 'intro', className: 'confirmation-explainer' },
        'Confermi di aver revisionato le versioni esatte elencate qui sotto? La conferma le congela nel pacchetto della lezione; non pubblica i materiali e non li rende disponibili agli studenti.'
      ),
      h('ul', { key: 'versions', className: 'confirmation-version-list', 'aria-label': 'Versioni incluse nel pacchetto' }, versions.map(([label, artifact]) =>
        h('li', { key: label }, [
          h('span', { key: 'name' }, label),
          h('strong', { key: 'version' }, artifact?.current_version ? `v${artifact.current_version}` : 'Non disponibile')
        ])
      )),
      h('div', { key: 'notes', className: 'form-group' }, [
        h('label', { className: 'form-label', htmlFor: 'confirm-notes' }, 'Nota di conferma · facoltativa'),
        h('input', {
          type: 'text', className: 'form-control', id: 'confirm-notes',
          placeholder: 'Aggiungi una nota per il registro docente',
          value: notes, onChange: event => setNotes(event.target.value)
        })
      ]),
      submitError ? h('p', { key: 'error', className: 'inline-error', role: 'alert' }, submitError) : null,
      h('div', { key: 'actions', className: 'modal-footer' }, [
        h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose, disabled: submitting }, 'Annulla'),
        h('button', { id: 'modal-btn-submit-confirm', type: 'submit', className: 'btn btn-success', disabled: submitting }, submitting ? 'Conferma in corso…' : 'Conferma pacchetto')
      ])
    ])
  ]);
}

export function ExportModal({ artifact, onClose }) {
  function downloadFile(format) {
    window.open(`/api/materials/${artifact.id}/export?format=${format}&includeTeacherSolutions=true`, '_blank');
  }

  function printDocument() {
    // Open printable HTML view
    const printWindow = window.open(`/api/materials/${artifact.id}/export?format=html&includeTeacherSolutions=true`, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  }

  return h(ModalBackdrop, { title: `Esporta: ${artifact.title}`, onClose }, [
    h('div', { className: 'export-modal' }, [
    h('p', { style: { fontSize: '0.9rem', marginBottom: '1.25rem', color: 'var(--text-muted)' } },
      'Scegli il formato desiderato per esportare o stampare il materiale:'
    ),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: '0.75rem' } }, [
      h(
        'button',
        { id: 'btn-do-export-markdown', type: 'button', className: 'btn btn-secondary', style: { justifyContent: 'flex-start', padding: '0.75rem 1rem' }, onClick: () => downloadFile('markdown') },
        '📝 Documento Markdown (.md)'
      ),
      h(
        'button',
        { type: 'button', className: 'btn btn-secondary', style: { justifyContent: 'flex-start', padding: '0.75rem 1rem' }, onClick: () => downloadFile('html') },
        '🌐 Pagina HTML formattata (.html)'
      ),
      h(
        'button',
        { type: 'button', className: 'btn btn-secondary', style: { justifyContent: 'flex-start', padding: '0.75rem 1rem' }, onClick: () => downloadFile('docx') },
        '📄 Microsoft Word (.docx via Pandoc)'
      ),
      h(
        'button',
        { type: 'button', className: 'btn btn-primary', style: { justifyContent: 'flex-start', padding: '0.75rem 1rem' }, onClick: printDocument },
        '🖨️ Stampa / Salva in PDF dal browser'
      )
    ]),
    h('div', { className: 'modal-footer', style: { marginTop: '1.5rem' } }, [
      h('button', { type: 'button', className: 'btn btn-secondary', onClick: onClose }, 'Chiudi')
    ])
  ])]);
}
