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
  onOpenNewLesson
}) {
  return h('div', { className: 'context-bar' }, [
    h('div', { key: 'selectors', className: 'context-selectors' }, [
      // Class selector
      h('div', { key: 'class-grp', className: 'context-group' }, [
        h('label', { key: 'lbl', className: 'context-label' }, 'Classe'),
        h('div', { key: 'row', style: { display: 'flex', gap: '0.4rem' } }, [
          h(
            'select',
            {
              key: 'sel',
              id: 'class-select',
              className: 'form-select',
              value: selectedClassId || '',
              onChange: (e) => onSelectClass(e.target.value)
            },
            classes.length === 0
              ? h('option', { value: '' }, 'Nessuna classe disponibile')
              : classes.map((c) => h('option', { key: c.id, value: c.id }, `${c.name} (${c.academic_year})`))
          ),
          h('button', { key: 'btn', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onOpenNewClass, id: 'btn-new-class', title: 'Nuova Classe' }, '+')
        ])
      ]),

      // Subject selector
      h('div', { key: 'sub-grp', className: 'context-group' }, [
        h('label', { key: 'lbl', className: 'context-label' }, 'Materia'),
        h('div', { key: 'row', style: { display: 'flex', gap: '0.4rem' } }, [
          h(
            'select',
            {
              key: 'sel',
              id: 'subject-select',
              className: 'form-select',
              value: selectedSubjectId || '',
              onChange: (e) => onSelectSubject(e.target.value),
              disabled: !selectedClassId || subjects.length === 0
            },
            subjects.length === 0
              ? h('option', { value: '' }, selectedClassId ? 'Nessuna materia' : 'Seleziona una classe')
              : subjects.map((s) => h('option', { key: s.id, value: s.id }, `${s.name}${s.code ? ` (${s.code})` : ''}`))
          ),
          h('button', { key: 'btn', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onOpenNewSubject, disabled: !selectedClassId, id: 'btn-new-subject', title: 'Nuova Materia' }, '+')
        ])
      ]),

      // Lesson selector
      h('div', { key: 'les-grp', className: 'context-group' }, [
        h('label', { key: 'lbl', className: 'context-label' }, 'Prossima Lezione'),
        h('div', { key: 'row', style: { display: 'flex', gap: '0.4rem' } }, [
          h(
            'select',
            {
              key: 'sel',
              id: 'lesson-select',
              className: 'form-select',
              value: selectedLessonId || '',
              onChange: (e) => onSelectLesson(e.target.value),
              disabled: !selectedSubjectId || lessons.length === 0
            },
            lessons.length === 0
              ? h('option', { value: '' }, selectedSubjectId ? 'Nessuna lezione programmata' : 'Seleziona materia')
              : lessons.map((l) => h('option', { key: l.id, value: l.id }, `${l.title} ${l.date ? `(${l.date})` : ''}`))
          ),
          h('button', { key: 'btn', type: 'button', className: 'btn btn-secondary btn-sm', onClick: onOpenNewLesson, disabled: !selectedSubjectId, id: 'btn-new-lesson', title: 'Nuova Lezione' }, '+')
        ])
      ])
    ])
  ]);
}
