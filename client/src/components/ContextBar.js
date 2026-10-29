import React, { createElement as h } from 'react';

export function ContextBar({
  classes = [],
  subjects = [],
  lessons = [],
  selectedClassId,
  selectedSubjectId,
  selectedLessonId,
  onSelectClass,
  onSelectSubject,
  onSelectLesson,
  onOpenNewClass,
  onOpenNewSubject,
  onOpenNewLesson,
  classLoading = false,
  subjectLoading = false,
  lessonLoading = false,
  classError = '',
  subjectError = '',
  lessonError = '',
  onRetryClasses,
  onRetrySubjects,
  onRetryLessons,
  locked = false
}) {
  const selectedClass = classes.find(item => item.id === selectedClassId);
  const selectedSubject = subjects.find(item => item.id === selectedSubjectId);
  const selectedLesson = lessons.find(item => item.id === selectedLessonId);

  function fieldStatus({ loading, error, retry, label }) {
    if (loading) return h('span', { className: 'context-field-status', role: 'status' }, `Caricamento ${label.toLowerCase()}…`);
    if (!error) return null;
    return h('span', { className: 'context-field-error', role: 'alert' }, [
      h('span', { key: 'message' }, error),
      retry ? h('button', { key: 'retry', type: 'button', className: 'text-button', onClick: retry }, 'Riprova') : null
    ]);
  }

  return h('section', {
    id: 'preparation-context',
    className: `context-bar preparation-section${locked ? ' context-locked' : ''}`,
    'aria-busy': classLoading || subjectLoading || lessonLoading,
    'aria-labelledby': 'preparation-context-title'
  }, [
    h('div', { key: 'intro', className: 'context-intro' }, [
      h('div', { key: 'heading' }, [
        h('p', { key: 'step', className: 'section-kicker' }, '01 · CONTESTO'),
        h('h2', { key: 'title', id: 'preparation-context-title' }, 'Scegli la lezione da preparare')
      ]),
      h('p', { key: 'summary', className: 'context-current', 'aria-live': 'polite' }, selectedLesson
        ? [
            h('strong', { key: 'class' }, selectedClass?.name || 'Classe'),
            h('span', { key: 'sep1', 'aria-hidden': 'true' }, ' / '),
            h('strong', { key: 'subject' }, selectedSubject?.name || 'Materia'),
            h('span', { key: 'sep2', 'aria-hidden': 'true' }, ' / '),
            h('strong', { key: 'lesson' }, selectedLesson.title)
          ]
        : 'Seleziona una classe, una materia e una lezione per proseguire.')
    ]),
    h('div', { key: 'selectors', className: 'context-selectors' }, [
      h('div', { key: 'class', className: 'context-group' }, [
        h('label', { key: 'label', className: 'context-label', htmlFor: 'class-select' }, 'Classe'),
        h('div', { key: 'controls', className: 'context-control-row' }, [
          h('select', {
            key: 'select', id: 'class-select', className: 'form-select',
            value: selectedClassId || '',
            disabled: locked || classLoading || classes.length === 0,
            onChange: event => onSelectClass(event.target.value || null)
          }, classes.length === 0
            ? h('option', { value: '' }, classLoading ? 'Caricamento classi…' : 'Nessuna classe disponibile')
            : classes.map(item => h('option', { key: item.id, value: item.id }, `${item.name} (${item.academic_year})`))),
          h('button', {
            key: 'new', type: 'button', className: 'btn btn-secondary btn-sm',
            onClick: onOpenNewClass, disabled: locked, 'aria-label': 'Crea una classe', title: 'Crea una classe'
          }, 'Nuova')
        ]),
        fieldStatus({ loading: classLoading, error: classError, retry: onRetryClasses, label: 'classi' })
      ]),
      h('div', { key: 'subject', className: 'context-group' }, [
        h('label', { key: 'label', className: 'context-label', htmlFor: 'subject-select' }, 'Materia'),
        h('div', { key: 'controls', className: 'context-control-row' }, [
          h('select', {
            key: 'select', id: 'subject-select', className: 'form-select',
            value: selectedSubjectId || '',
            disabled: locked || !selectedClassId || subjectLoading || subjects.length === 0,
            onChange: event => onSelectSubject(event.target.value || null)
          }, subjects.length === 0
            ? h('option', { value: '' }, subjectLoading ? 'Caricamento materie…' : selectedClassId ? 'Nessuna materia' : 'Seleziona una classe')
            : subjects.map(item => h('option', { key: item.id, value: item.id }, `${item.name}${item.code ? ` (${item.code})` : ''}`))),
          h('button', {
            key: 'new', type: 'button', className: 'btn btn-secondary btn-sm',
            onClick: onOpenNewSubject, disabled: locked || !selectedClassId,
            'aria-label': 'Crea una materia', title: 'Crea una materia'
          }, 'Nuova')
        ]),
        fieldStatus({ loading: subjectLoading, error: subjectError, retry: onRetrySubjects, label: 'materie' })
      ]),
      h('div', { key: 'lesson', className: 'context-group' }, [
        h('label', { key: 'label', className: 'context-label', htmlFor: 'lesson-select' }, 'Lezione'),
        h('div', { key: 'controls', className: 'context-control-row' }, [
          h('select', {
            key: 'select', id: 'lesson-select', className: 'form-select',
            value: selectedLessonId || '',
            disabled: locked || !selectedSubjectId || lessonLoading || lessons.length === 0,
            onChange: event => onSelectLesson(event.target.value || null)
          }, lessons.length === 0
            ? h('option', { value: '' }, lessonLoading ? 'Caricamento lezioni…' : selectedSubjectId ? 'Nessuna lezione' : 'Seleziona una materia')
            : lessons.map(item => h('option', { key: item.id, value: item.id }, `${item.title}${item.date ? ` (${item.date})` : ''}`))),
          h('button', {
            key: 'new', type: 'button', className: 'btn btn-secondary btn-sm',
            onClick: onOpenNewLesson, disabled: locked || !selectedSubjectId,
            'aria-label': 'Crea una lezione', title: 'Crea una lezione'
          }, 'Nuova')
        ]),
        fieldStatus({ loading: lessonLoading, error: lessonError, retry: onRetryLessons, label: 'lezioni' })
      ])
    ])
  ]);
}
