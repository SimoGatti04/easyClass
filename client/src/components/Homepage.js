import React, { createElement as h } from 'react';

export function Homepage({ onNavigate }) {
  return h('div', { className: 'homepage-container' }, [
    // Top Hero Section
    h('header', { key: 'hero', className: 'homepage-hero' }, [
      h('div', { className: 'hero-badge' }, '🎓 Piattaforma Didattica Integrata'),
      h('h1', { className: 'hero-title' }, 'Teacher Service'),
      h('p', { className: 'hero-subtitle' },
        'Il sistema unificato per la preparazione delle lezioni, lo svolgimento di verifiche ed esercitazioni digitali, e il monitoraggio live d\'aula.'
      )
    ]),

    // Two Main Entry Cards
    h('div', { key: 'cards', className: 'portal-cards-grid' }, [
      // 1. Student Card
      h('div', { key: 'student-card', className: 'portal-card student-card' }, [
        h('div', { className: 'portal-card-header' }, [
          h('div', { className: 'portal-card-icon student-icon' }, '✍️'),
          h('div', null, [
            h('span', { className: 'portal-tag student-tag' }, 'Accesso Studenti'),
            h('h2', { className: 'portal-card-title' }, 'Area Studenti')
          ])
        ]),
        h('p', { className: 'portal-card-desc' },
          'Accedi alla tua classe, seleziona l\'attività assegnata dal docente, dichiara la tua postazione d\'aula e compila la prova con autosalvataggio continuo e ripristino istantaneo.'
        ),
        h('ul', { className: 'portal-features-list' }, [
          h('li', { key: 'f1' }, '✓ Nessun account o password richiesti (identificazione leggera)'),
          h('li', { key: 'f2' }, '✓ Salvataggio continuo e automatico delle risposte'),
          h('li', { key: 'f3' }, '✓ Supporto domande a scelta multipla, aperte, codice e allegati'),
          h('li', { key: 'f4' }, '✓ Dichiarazione postazione e vicini di banco (Seat Map)')
        ]),
        h('div', { className: 'portal-card-footer' }, [
          h('button', {
            type: 'button',
            className: 'portal-btn btn-student',
            onClick: () => onNavigate('/studente')
          }, 'Entra come Studente →')
        ])
      ]),

      // 2. Teacher Card
      h('div', { key: 'teacher-card', className: 'portal-card teacher-card' }, [
        h('div', { className: 'portal-card-header' }, [
          h('div', { className: 'portal-card-icon teacher-icon' }, '👨‍🏫'),
          h('div', null, [
            h('span', { className: 'portal-tag teacher-tag' }, 'Accesso Riservato Docente'),
            h('h2', { className: 'portal-card-title' }, 'Area Docente')
          ])
        ]),
        h('p', { className: 'portal-card-desc' },
          'Prepara materiali didattici con OmniRoute AI, gestisci il curricolo e le attività, segui in tempo reale le risposte degli studenti in aula e correggi le prove con grading assistito.'
        ),
        h('ul', { className: 'portal-features-list' }, [
          h('li', { key: 't1' }, '✓ T1: Generazione guidata Lesson Plan, Script, Dispensa ed Esercizi'),
          h('li', { key: 't2' }, '✓ Monitoraggio live d\'aula con mappa dei banchi (Seat Map)'),
          h('li', { key: 't3' }, '✓ Gestione roster studenti per classe e importazione massiva'),
          h('li', { key: 't4' }, '✓ Correzione assistita da AI con valutazione sovrana del docente')
        ]),
        h('div', { className: 'portal-card-footer' }, [
          h('button', {
            type: 'button',
            className: 'portal-btn btn-teacher',
            onClick: () => onNavigate('/docente')
          }, 'Accedi alla Dashboard Docente →')
        ])
      ])
    ]),

    // Technical Architecture & Compliance Footer
    h('footer', { key: 'footer', className: 'homepage-footer' }, [
      h('div', { className: 'footer-status' }, [
        h('span', { className: 'status-dot-active' }),
        h('span', null, 'Teacher Service v0.1.0 — Architettura K3s & MCP Streamable HTTP • Sviluppo C3')
      ]),
      h('p', { className: 'footer-compliance' },
        'Conforme ai Dossier Normativi 01-11. Separazione rigorosa tra superfici pubbliche studente e superfici autorizzate docente. Zero tracciamento invasivo o proctoring.'
      )
    ])
  ]);
}
