import React, { createElement as h, useState, useEffect } from 'react';

export function ActivitiesView({ onSelectLiveMonitor }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [activities, setActivities] = useState([]);
  const [publishedMaterials, setPublishedMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modals state
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedActivityForItems, setSelectedActivityForItems] = useState(null);

  // Questions editor state
  const [editingItem, setEditingItem] = useState(null); // null = new, or existing item object
  const [itemType, setItemType] = useState('multiple_choice');
  const [itemQuestionText, setItemQuestionText] = useState('');
  const [itemMaxScore, setItemMaxScore] = useState(5);
  const [itemTeacherSolution, setItemTeacherSolution] = useState('');
  const [itemStarterCode, setItemStarterCode] = useState('');
  const [itemLanguage, setItemLanguage] = useState('python');
  const [itemOptions, setItemOptions] = useState([
    { id: 'A', text: '', isCorrect: true },
    { id: 'B', text: '', isCorrect: false },
    { id: 'C', text: '', isCorrect: false },
    { id: 'D', text: '', isCorrect: false }
  ]);
  const [itemRubric, setItemRubric] = useState({ criteria: 'Correttezza concettuale', max: 5 });
  const [itemSourceId, setItemSourceId] = useState('');
  const [itemSourceVersion, setItemSourceVersion] = useState(1);
  const [isSavingItem, setIsSavingItem] = useState(false);

  // New activity form
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('test');
  const [newDuration, setNewDuration] = useState(45);
  const [newMaxScore, setNewMaxScore] = useState(30);
  const [newDescription, setNewDescription] = useState('');

  // Load classes
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

  // Load activities and published materials when class changes
  const loadActivities = (classId) => {
    if (!classId) return;
    setLoading(true);
    fetch(`/api/assessments?classId=${encodeURIComponent(classId)}`)
      .then(res => res.json())
      .then(async data => {
        const listedAssessments = data.assessments || [];
        const assessmentsWithActiveQuestionCounts = await Promise.all(listedAssessments.map(async assessment => {
          if (Number.isInteger(assessment.itemCount) || assessment.status !== 'active') return assessment;
          try {
            const detailResponse = await fetch(`/api/assessments/${encodeURIComponent(assessment.id)}`);
            if (!detailResponse.ok) return assessment;
            const detailBody = await detailResponse.json();
            const itemCount = detailBody.assessment?.itemCount ?? detailBody.assessment?.items?.length;
            return Number.isInteger(itemCount) ? { ...assessment, itemCount } : assessment;
          } catch {
            return assessment;
          }
        }));
        setActivities(assessmentsWithActiveQuestionCounts);
        setLoading(false);
      })
      .catch(err => {
        setError('Errore caricamento attività: ' + err.message);
        setLoading(false);
      });

    // Also load published materials for grounding
    fetch(`/api/materials?classId=${encodeURIComponent(classId)}`)
      .then(res => res.json())
      .then(data => {
        const mats = (data.materials || []).filter(m => m.pedagogical_role === 'student_material' || m.pedagogical_role === 'support_material');
        setPublishedMaterials(mats);
        if (mats.length > 0) {
          setItemSourceId(mats[0].id);
          setItemSourceVersion(mats[0].version || 1);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    if (selectedClassId) {
      loadActivities(selectedClassId);
    }
  }, [selectedClassId]);

  // Create Activity
  const handleCreateActivity = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !selectedClassId) return;

    fetch('/api/assessments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        classId: selectedClassId,
        activityType: newType,
        durationMinutes: parseInt(newDuration, 10) || 60,
        maxScore: parseInt(newMaxScore, 10) || 30,
        description: newDescription.trim() || null,
        items: []
      })
    })
      .then(res => res.json())
      .then(data => {
        setIsNewModalOpen(false);
        setNewTitle('');
        setNewDescription('');
        setSuccessMsg('Attività creata con successo.');
        loadActivities(selectedClassId);
      })
      .catch(err => setError('Errore creazione attività: ' + err.message));
  };

  // Change Assessment Status
  const handleStatusChange = (activityId, newStatus) => {
    fetch(`/api/assessments/${activityId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    })
      .then(res => res.json())
      .then(() => {
        setSuccessMsg(`Stato aggiornato a '${newStatus}'.`);
        loadActivities(selectedClassId);
      })
      .catch(err => setError('Errore aggiornamento stato: ' + err.message));
  };

  // Load questions for an assessment
  const openItemEditor = (activity) => {
    setError('');
    setSuccessMsg('');
    fetch(`/api/assessments/${activity.id}`)
      .then(res => res.json())
      .then(data => {
        setSelectedActivityForItems(data.assessment);
        resetItemForm();
      })
      .catch(err => setError('Errore caricamento dettagli quesiti: ' + err.message));
  };

  const resetItemForm = () => {
    setEditingItem(null);
    setItemType('multiple_choice');
    setItemQuestionText('');
    setItemMaxScore(5);
    setItemTeacherSolution('');
    setItemStarterCode('');
    setItemLanguage('python');
    setItemOptions([
      { id: 'A', text: '', isCorrect: true },
      { id: 'B', text: '', isCorrect: false },
      { id: 'C', text: '', isCorrect: false },
      { id: 'D', text: '', isCorrect: false }
    ]);
    setItemRubric({ criteria: 'Correttezza concettuale', max: 5 });
    if (publishedMaterials.length > 0) {
      setItemSourceId(publishedMaterials[0].id);
      setItemSourceVersion(publishedMaterials[0].version || 1);
    }
  };

  const handleEditItemClick = (item) => {
    setEditingItem(item);
    setItemType(item.type || 'open_question');
    setItemQuestionText(item.question_text || '');
    setItemMaxScore(item.max_score || 5);
    setItemTeacherSolution(item.teacher_solution || '');
    setItemStarterCode(item.starter_code || '');
    setItemLanguage(item.language || 'python');
    if (Array.isArray(item.options)) {
      setItemOptions(item.options.map((o, idx) => ({
        id: o.id || String.fromCharCode(65 + idx),
        text: o.text || '',
        isCorrect: Boolean(o.isCorrect)
      })));
    }
    if (item.rubric) {
      setItemRubric(item.rubric);
    }
    if (item.assessable_source_id) {
      setItemSourceId(item.assessable_source_id);
      setItemSourceVersion(item.assessable_source_version || 1);
    }
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    if (!itemQuestionText.trim() || !selectedActivityForItems) return;

    setIsSavingItem(true);
    const payload = {
      type: itemType,
      questionText: itemQuestionText.trim(),
      maxScore: parseFloat(itemMaxScore) || 5,
      teacherSolution: itemTeacherSolution.trim(),
      assessableSourceId: itemSourceId || null,
      assessableSourceVersion: parseInt(itemSourceVersion, 10) || 1
    };

    if (itemType === 'multiple_choice') {
      payload.options = itemOptions;
      payload.isSelfCorrecting = true;
    } else if (itemType === 'code') {
      payload.language = itemLanguage;
      payload.starterCode = itemStarterCode;
    } else if (itemType === 'open_question') {
      payload.rubric = itemRubric;
    }

    const url = editingItem
      ? `/api/assessments/${selectedActivityForItems.id}/items/${editingItem.id}`
      : `/api/assessments/${selectedActivityForItems.id}/items`;
    const method = editingItem ? 'PUT' : 'POST';

    fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(res => {
        if (!res.ok) return res.json().then(j => { throw new Error(j.message || `HTTP ${res.status}`); });
        return res.json();
      })
      .then(() => {
        setIsSavingItem(false);
        resetItemForm();
        // Refresh items
        fetch(`/api/assessments/${selectedActivityForItems.id}`)
          .then(r => r.json())
          .then(d => {
            setSelectedActivityForItems(d.assessment);
            loadActivities(selectedClassId);
          });
      })
      .catch(err => {
        setIsSavingItem(false);
        setError('Errore salvataggio quesito: ' + err.message);
      });
  };

  const handleDeleteItem = (itemId) => {
    if (!confirm('Sei sicuro di voler eliminare questo quesito?')) return;
    fetch(`/api/assessments/${selectedActivityForItems.id}/items/${itemId}`, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(() => {
        fetch(`/api/assessments/${selectedActivityForItems.id}`)
          .then(r => r.json())
          .then(d => {
            setSelectedActivityForItems(d.assessment);
            loadActivities(selectedClassId);
          });
      })
      .catch(err => setError('Errore eliminazione quesito: ' + err.message));
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);

  return h('div', { className: 'view-container activities-view' }, [
    // Top Bar: Filter by Class + Action
    h('div', { key: 'top-bar', className: 'view-header-row' }, [
      h('div', { className: 'class-filter-box' }, [
        h('label', { className: 'filter-label' }, 'Classe:'),
        h('select', {
          className: 'select-class-dropdown',
          value: selectedClassId,
          onChange: e => setSelectedClassId(e.target.value)
        }, classes.map(c => h('option', { key: c.id, value: c.id }, `${c.name} (${c.academic_year || ''})`)))
      ]),
      h('button', {
        type: 'button',
        className: 'btn btn-primary',
        onClick: () => setIsNewModalOpen(true)
      }, '+ Nuova Attività / Verifica')
    ]),

    error && h('div', { key: 'err', className: 'error-msg-banner' }, error),
    successMsg && h('div', { key: 'suc', className: 'notice-success p-3 rounded mb-4' }, successMsg),

    // Activities Grid / Table
    h('div', { key: 'list', className: 'activities-table-wrapper card p-0' }, [
      loading ? h('p', { className: 'loading-text p-6' }, 'Caricamento attività in corso...') :
      activities.length === 0 ? (
        h('div', { className: 'empty-state-box p-8 text-center' }, [
          h('span', { className: 'empty-icon text-3xl' }, '📋'),
          h('h3', { className: 'text-lg font-bold mt-2' }, `Nessuna attività registrata per la classe ${selectedClass?.name || ''}`),
          h('p', { className: 'text-sm text-gray-500 mt-1' }, 'Crea una verifica sommativa o un\'esercitazione per abilitare lo svolgimento digitale e il monitoraggio d\'aula.')
        ])
      ) : (
        h('table', { className: 'data-table w-full' }, [
          h('thead', null, [
            h('tr', null, [
              h('th', null, 'Titolo Attività'),
              h('th', null, 'Tipologia'),
              h('th', null, 'Stato Lifecycle'),
              h('th', null, 'Durata'),
              h('th', null, 'Punti Max'),
              h('th', null, 'Quesiti'),
              h('th', { className: 'text-right' }, 'Azioni Docente')
            ])
          ]),
          h('tbody', null,
            activities.map(a => h('tr', { key: a.id }, [
              h('td', { className: 'cell-title' }, [
                h('div', { className: 'title-main font-semibold' }, a.title),
                a.description && h('div', { className: 'title-sub text-xs text-gray-500' }, a.description)
              ]),
              h('td', null, [
                h('span', {
                  className: `badge ${a.activity_type === 'exercise' ? 'badge-secondary' : 'badge-primary'}`
                }, a.activity_type === 'exercise' ? 'Esercitazione' : 'Verifica')
              ]),
              h('td', null, [
                h('select', {
                  className: `status-select status-${a.status} text-xs font-semibold rounded px-2 py-1 border`,
                  value: a.status,
                  onChange: e => handleStatusChange(a.id, e.target.value)
                }, [
                  h('option', { value: 'draft' }, 'Bozza (draft)'),
                  h('option', { value: 'ready' }, 'Pronta (ready)'),
                  h('option', { value: 'active' }, 'In Corso (active)'),
                  h('option', { value: 'closed' }, 'Chiusa (closed)')
                ])
              ]),
              h('td', null, `${a.duration_minutes || 60} min`),
              h('td', null, `${a.max_score || 30} pt`),
              h('td', null, [
                h('button', {
                  type: 'button',
                  className: 'btn btn-secondary btn-sm',
                  onClick: () => openItemEditor(a)
                }, Number.isInteger(a.itemCount)
                  ? `Modifica quesiti (${a.itemCount})`
                  : a.status === 'active'
                    ? 'Quesiti (conteggio non disponibile)'
                    : 'Modifica quesiti')
              ]),
              h('td', { className: 'text-right space-x-2' }, [
                h('button', {
                  type: 'button',
                  className: 'btn btn-primary btn-sm',
                  onClick: () => onSelectLiveMonitor && onSelectLiveMonitor(a.id)
                }, '📊 Monitora Live →')
              ])
            ]))
          )
        ])
      )
    ]),

    // Modal Create Activity
    isNewModalOpen && h('div', { key: 'modal-create', className: 'modal-overlay' }, [
      h('div', { className: 'modal-dialog' }, [
        h('div', { className: 'modal-header' }, [
          h('h3', { className: 'modal-title' }, `Nuova Attività per ${selectedClass?.name}`)
        ]),
        h('form', { onSubmit: handleCreateActivity }, [
          h('div', { className: 'modal-body space-y-4' }, [
            h('div', { className: 'form-group' }, [
              h('label', { className: 'form-label' }, 'Titolo Verifica o Esercitazione:'),
              h('input', {
                type: 'text',
                className: 'form-input w-full',
                required: true,
                placeholder: 'Es: Verifica su Basi di Dati e SQL',
                value: newTitle,
                onChange: e => setNewTitle(e.target.value)
              })
            ]),
            h('div', { className: 'form-group' }, [
              h('label', { className: 'form-label' }, 'Tipologia:'),
              h('select', {
                className: 'form-select w-full',
                value: newType,
                onChange: e => setNewType(e.target.value)
              }, [
                h('option', { value: 'test' }, 'Verifica Sommativa (valutazione formale)'),
                h('option', { value: 'exercise' }, 'Esercitazione Formativa (allenamento guidato)')
              ])
            ]),
            h('div', { className: 'grid grid-cols-2 gap-4' }, [
              h('div', { className: 'form-group' }, [
                h('label', { className: 'form-label' }, 'Durata (minuti):'),
                h('input', {
                  type: 'number',
                  className: 'form-input w-full',
                  min: 5,
                  max: 240,
                  value: newDuration,
                  onChange: e => setNewDuration(e.target.value)
                })
              ]),
              h('div', { className: 'form-group' }, [
                h('label', { className: 'form-label' }, 'Punteggio Massimo (pt):'),
                h('input', {
                  type: 'number',
                  className: 'form-input w-full',
                  min: 1,
                  max: 100,
                  value: newMaxScore,
                  onChange: e => setNewMaxScore(e.target.value)
                })
              ])
            ]),
            h('div', { className: 'form-group' }, [
              h('label', { className: 'form-label' }, 'Descrizione o istruzioni per gli studenti (opzionale):'),
              h('textarea', {
                className: 'form-textarea w-full',
                rows: 2,
                placeholder: 'Indicazioni generali, argomenti coperti...',
                value: newDescription,
                onChange: e => setNewDescription(e.target.value)
              })
            ])
          ]),
          h('div', { className: 'modal-footer flex justify-end gap-2' }, [
            h('button', {
              type: 'button',
              className: 'btn btn-secondary',
              onClick: () => setIsNewModalOpen(false)
            }, 'Annulla'),
            h('button', {
              type: 'submit',
              className: 'btn btn-primary'
            }, 'Crea Attività')
          ])
        ])
      ])
    ]),

    // Modal Question Item Editor
    selectedActivityForItems && h('div', { key: 'modal-items', className: 'modal-overlay' }, [
      h('div', { className: 'modal-dialog modal-xl max-w-4xl max-h-[90vh] overflow-y-auto' }, [
        h('div', { className: 'modal-header flex justify-between items-center' }, [
          h('div', null, [
            h('h3', { className: 'modal-title font-bold text-lg' }, `Quesiti: ${selectedActivityForItems.title}`),
            h('p', { className: 'text-xs text-gray-500' }, `Stato: ${selectedActivityForItems.status} • Punti Totali: ${selectedActivityForItems.items?.reduce((acc, i) => acc + (i.max_score || 0), 0) || 0} / ${selectedActivityForItems.max_score} pt`)
          ]),
          h('button', {
            type: 'button',
            className: 'text-gray-400 hover:text-gray-600 text-xl font-bold',
            onClick: () => setSelectedActivityForItems(null)
          }, '✕')
        ]),

        h('div', { className: 'modal-body p-4 space-y-6' }, [
          // Items List
          h('div', { className: 'existing-items-section' }, [
            h('h4', { className: 'font-semibold text-sm text-gray-700 mb-2' }, `Quesiti Configurato (${selectedActivityForItems.items?.length || 0}):`),
            (!selectedActivityForItems.items || selectedActivityForItems.items.length === 0) ? (
              h('p', { className: 'text-sm text-gray-400 italic bg-gray-50 p-4 rounded text-center' }, 'Nessun quesito inserito. Usa il modulo sottostante per aggiungere domande a risposta chiusa, aperta, codice o allegato.')
            ) : (
              h('div', { className: 'space-y-3' }, selectedActivityForItems.items.map((item, idx) => {
                return h('div', { key: item.id, className: 'card p-3 border rounded shadow-sm bg-white' }, [
                  h('div', { className: 'flex justify-between items-start gap-2' }, [
                    h('div', { className: 'flex-1' }, [
                      h('div', { className: 'flex items-center gap-2 mb-1' }, [
                        h('span', { className: 'font-bold text-sm text-blue-700' }, `D${idx + 1}.`),
                        h('span', { className: 'badge badge-neutral text-xs' }, item.type),
                        h('span', { className: 'badge badge-primary text-xs' }, `${item.max_score} pt`)
                      ]),
                      h('div', { className: 'font-medium text-sm text-gray-800' }, item.question_text),

                      // Options preview for MCQ
                      item.type === 'multiple_choice' && item.options && h('div', { className: 'mt-2 pl-3 border-l-2 border-blue-200 text-xs space-y-1' },
                        item.options.map(opt => h('div', {
                          key: opt.id,
                          className: opt.isCorrect ? 'text-green-700 font-semibold' : 'text-gray-600'
                        }, `${opt.id}) ${opt.text} ${opt.isCorrect ? '✓ (Corretta)' : ''}`))
                      ),

                      // Code preview
                      item.type === 'code' && item.starter_code && h('pre', { className: 'mt-2 bg-gray-900 text-gray-100 p-2 rounded text-xs overflow-x-auto font-mono' }, item.starter_code),

                      // Teacher Solution Preview
                      item.teacher_solution && h('div', { className: 'mt-2 text-xs bg-amber-50 border border-amber-200 p-2 rounded text-amber-900' }, [
                        h('span', { className: 'font-bold' }, '🔒 Soluzione Riservata Docente: '),
                        item.teacher_solution
                      ])
                    ]),
                    h('div', { className: 'flex gap-1 shrink-0' }, [
                      h('button', {
                        type: 'button',
                        className: 'btn btn-secondary btn-sm text-xs',
                        onClick: () => handleEditItemClick(item)
                      }, 'Modifica'),
                      h('button', {
                        type: 'button',
                        className: 'btn btn-danger btn-sm text-xs',
                        onClick: () => handleDeleteItem(item.id)
                      }, 'Elimina')
                    ])
                  ])
                ]);
              }))
            )
          ]),

          // Add / Edit Item Form
          h('div', { className: 'item-form-section border-t pt-4 bg-gray-50 p-4 rounded-lg' }, [
            h('h4', { className: 'font-bold text-sm text-gray-800 mb-3' }, editingItem ? `Modifica Quesito (${editingItem.id})` : '+ Aggiungi Nuovo Quesito'),
            h('form', { onSubmit: handleSaveItem, className: 'space-y-4' }, [
              h('div', { className: 'grid grid-cols-3 gap-3' }, [
                h('div', null, [
                  h('label', { className: 'form-label text-xs' }, 'Tipologia Quesito:'),
                  h('select', {
                    className: 'form-select w-full text-sm',
                    value: itemType,
                    onChange: e => setItemType(e.target.value)
                  }, [
                    h('option', { value: 'multiple_choice' }, 'Scelta Multipla (MCQ)'),
                    h('option', { value: 'open_question' }, 'Risposta Aperta'),
                    h('option', { value: 'code' }, 'Scrittura Codice'),
                    h('option', { value: 'attachment' }, 'Consegna con Allegato')
                  ])
                ]),
                h('div', null, [
                  h('label', { className: 'form-label text-xs' }, 'Punteggio Massimo (pt):'),
                  h('input', {
                    type: 'number',
                    className: 'form-input w-full text-sm',
                    min: 1,
                    max: 50,
                    value: itemMaxScore,
                    onChange: e => setItemMaxScore(e.target.value)
                  })
                ]),
                h('div', null, [
                  h('label', { className: 'form-label text-xs' }, 'Fonte Assessabile (Grounding):'),
                  publishedMaterials.length === 0 ? (
                    h('p', { className: 'text-xs text-amber-700 mt-1' }, 'Nessun materiale pubblicato per la classe.')
                  ) : (
                    h('select', {
                      className: 'form-select w-full text-sm',
                      value: itemSourceId,
                      onChange: e => {
                        setItemSourceId(e.target.value);
                        const sel = publishedMaterials.find(m => m.id === e.target.value);
                        if (sel) setItemSourceVersion(sel.version || 1);
                      }
                    }, publishedMaterials.map(m => h('option', { key: m.id, value: m.id }, `${m.title} (v${m.version || 1})`)))
                  )
                ])
              ]),

              h('div', null, [
                h('label', { className: 'form-label text-xs' }, 'Testo della Domanda / Traccia:'),
                h('textarea', {
                  className: 'form-textarea w-full text-sm',
                  rows: 3,
                  required: true,
                  placeholder: 'Inserisci la traccia del quesito...',
                  value: itemQuestionText,
                  onChange: e => setItemQuestionText(e.target.value)
                })
              ]),

              // Options for Multiple Choice
              itemType === 'multiple_choice' && h('div', { className: 'bg-white p-3 rounded border space-y-2' }, [
                h('label', { className: 'form-label text-xs font-semibold' }, 'Opzioni di Risposta (seleziona la corretta):'),
                itemOptions.map((opt, idx) => h('div', { key: opt.id, className: 'flex items-center gap-2' }, [
                  h('input', {
                    type: 'radio',
                    name: 'correct_option',
                    checked: opt.isCorrect,
                    onChange: () => {
                      setItemOptions(itemOptions.map((o, i) => ({ ...o, isCorrect: i === idx })));
                    }
                  }),
                  h('span', { className: 'font-bold text-xs text-gray-500 w-4' }, `${opt.id})`),
                  h('input', {
                    type: 'text',
                    className: 'form-input flex-1 text-xs',
                    placeholder: `Risposta ${opt.id}...`,
                    value: opt.text,
                    onChange: e => {
                      const updated = [...itemOptions];
                      updated[idx].text = e.target.value;
                      setItemOptions(updated);
                    }
                  })
                ]))
              ]),

              // Code Specific Fields
              itemType === 'code' && h('div', { className: 'grid grid-cols-2 gap-3 bg-white p-3 rounded border' }, [
                h('div', null, [
                  h('label', { className: 'form-label text-xs' }, 'Linguaggio:'),
                  h('select', {
                    className: 'form-select w-full text-xs',
                    value: itemLanguage,
                    onChange: e => setItemLanguage(e.target.value)
                  }, [
                    h('option', { value: 'python' }, 'Python'),
                    h('option', { value: 'javascript' }, 'JavaScript'),
                    h('option', { value: 'sql' }, 'SQL'),
                    h('option', { value: 'c' }, 'C / C++'),
                    h('option', { value: 'java' }, 'Java'),
                    h('option', { value: 'html' }, 'HTML / CSS')
                  ])
                ]),
                h('div', { className: 'col-span-2' }, [
                  h('label', { className: 'form-label text-xs' }, 'Starter Code (codice iniziale facoltativo):'),
                  h('textarea', {
                    className: 'form-textarea w-full font-mono text-xs bg-gray-900 text-gray-100',
                    rows: 3,
                    placeholder: '# Scrivi qui la struttura iniziale...',
                    value: itemStarterCode,
                    onChange: e => setItemStarterCode(e.target.value)
                  })
                ])
              ]),

              // Teacher Solution & Rubric
              h('div', { className: 'space-y-2 bg-amber-50/50 p-3 rounded border border-amber-200' }, [
                h('label', { className: 'form-label text-xs text-amber-900 font-semibold' }, '🔒 Soluzione Riservata del Docente (non visibile allo studente):'),
                h('textarea', {
                  className: 'form-textarea w-full text-xs',
                  rows: 2,
                  placeholder: 'Spiegazione o risposta modello per facilitare la correzione...',
                  value: itemTeacherSolution,
                  onChange: e => setItemTeacherSolution(e.target.value)
                })
              ]),

              h('div', { className: 'flex justify-end gap-2 pt-2' }, [
                editingItem && h('button', {
                  type: 'button',
                  className: 'btn btn-secondary btn-sm',
                  onClick: resetItemForm
                }, 'Annulla Modifica'),
                h('button', {
                  type: 'submit',
                  className: 'btn btn-primary btn-sm',
                  disabled: isSavingItem
                }, isSavingItem ? 'Salvataggio...' : (editingItem ? 'Aggiorna Quesito' : 'Aggiungi Quesito'))
              ])
            ])
          ])
        ]),

        h('div', { className: 'modal-footer p-3 border-t flex justify-end' }, [
          h('button', {
            type: 'button',
            className: 'btn btn-secondary',
            onClick: () => setSelectedActivityForItems(null)
          }, 'Chiudi')
        ])
      ])
    ]),


  ]);
}
