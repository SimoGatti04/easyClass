import React, { createElement as h, useState, useEffect } from 'react';

import { TeacherPreparationView } from './TeacherPreparationView.js';
import { ActivitiesView } from './ActivitiesView.js';
import { StudentsView } from './StudentsView.js';
import { LiveMonitoringView } from './LiveMonitoringView.js';
import { SubmissionsView } from './SubmissionsView.js';
import { IntegrityPreviewView } from './IntegrityPreviewView.js';
import { TeacherOverviewView } from './TeacherOverviewView.js';

export function TeacherArea({ onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
  const [selectedSubmissionId, setSelectedSubmissionId] = useState('');
  const [features, setFeatures] = useState({ integrityAnalysis: false });

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.features) setFeatures(data.features);
      })
      .catch(() => {});
  }, []);

  const navigate = (tab, assessmentId = '') => {
    setActiveTab(tab);
    if (assessmentId) setSelectedAssessmentId(assessmentId);
    setSelectedSubmissionId('');
  };

  const handleSelectSubmission = (assessmentId, submissionId) => {
    setSelectedAssessmentId(assessmentId || '');
    setSelectedSubmissionId(submissionId || '');
    setActiveTab('submissions');
  };

  const navGroups = [
    {
      label: 'Insegnamento',
      items: [
        { id: 'overview', label: 'Panoramica' },
        { id: 'prep', label: 'Preparazione' },
        { id: 'activities', label: 'Attività' },
        { id: 'students', label: 'Registro studenti' }
      ]
    },
    {
      label: 'Verifiche',
      items: [
        { id: 'live', label: 'Monitoraggio' },
        { id: 'submissions', label: 'Da correggere' },
        { id: 'reviewed', label: 'Valutazioni concluse' }
      ]
    },
...(features.integrityAnalysis ? [{
      label: 'Integrità',
      items: [{ id: 'integrity', label: 'Evidenze' }]
    }] : [])
  ];
  let content;
  switch (activeTab) {
    case 'overview':
      content = h(TeacherOverviewView, { onNavigate: navigate });
      break;
    case 'activities':
      content = h(ActivitiesView, { onSelectLiveMonitor: id => navigate('live', id) });
      break;
    case 'students':
      content = h(StudentsView, null);
      break;
    case 'live':
      content = h(LiveMonitoringView, {
        initialAssessmentId: selectedAssessmentId,
        onOpenSubmission: handleSelectSubmission
      });
      break;
    case 'submissions':
      content = h(SubmissionsView, {
        key: `submissions-${selectedAssessmentId}-${selectedSubmissionId}`,
        initialAssessmentId: selectedAssessmentId,
        initialSubmissionId: selectedSubmissionId,
        initialStatusFilter: 'pending'
      });
      break;
    case 'reviewed':
      content = h(SubmissionsView, {
        key: `reviewed-${selectedAssessmentId}`,
        initialAssessmentId: selectedAssessmentId,
        initialStatusFilter: 'reviewed'
      });
      break;
    case 'integrity':
      content = features.integrityAnalysis ? h(IntegrityPreviewView, null) : h(TeacherOverviewView, { onNavigate: navigate });
      break;
    case 'prep':
    default:
      content = h(TeacherPreparationView, null);
      break;
  }

  return h('div', { className: 'teacher-portal-layout' }, [
    h('header', { key: 'teacher-header', className: 'teacher-top-navbar' }, [
      h('div', { className: 'navbar-left' }, [
        h('button', {
          type: 'button',
          className: 'btn btn-sm btn-ghost back-to-home-btn',
          onClick: () => onNavigate ? onNavigate('home') : (window.location.hash = '#/')
        }, '← Home Portale'),
        h('div', { className: 'portal-branding' }, [
          h('span', { className: 'brand-logo', 'aria-hidden': 'true' }, 'TS'),
          h('div', null, [
            h('h1', { className: 'brand-title' }, 'Teacher Service'),
            h('span', { className: 'brand-tag' }, 'Area Docente')
          ])
        ])
      ]),
      h('div', { className: 'navbar-right' }, [
        h('div', { className: 'user-badge-container' }, [
          h('span', { className: 'user-role-pill' }, 'Docente'),
          h('span', { className: 'user-email-text' }, 'Sessione autorizzata')
        ])
      ])
    ]),
    h('nav', { key: 'tabs-nav', className: 'teacher-tabs-nav', 'aria-label': 'Navigazione docente' }, [
      h('div', { className: 'teacher-nav-groups' }, navGroups.map(group => h('div', { className: 'teacher-nav-group', key: group.label }, [
        h('span', { className: 'teacher-nav-group-label' }, group.label),
        h('div', { className: 'tabs-scroll-container', role: 'group', 'aria-label': group.label }, group.items.map(item => h('button', {
          type: 'button',
          key: item.id,
          className: `teacher-nav-tab ${activeTab === item.id ? 'tab-active' : ''}`,
          'aria-current': activeTab === item.id ? 'page' : undefined,
          onClick: () => navigate(item.id)
        }, item.label)))
      ]))),
      h('label', { className: 'teacher-mobile-nav' }, [
        h('span', { className: 'field-label' }, 'Vai a'),
        h('select', {
          className: 'select-input',
          'aria-label': 'Sezione docente',
          value: activeTab,
          onChange: event => navigate(event.target.value)
        }, navGroups.map(group => h('optgroup', { key: group.label, label: group.label }, group.items.map(item =>
          h('option', { key: item.id, value: item.id }, item.label)
        ))))
      ])
    ]),
    h('main', { key: 'main-workspace', className: 'teacher-main-workspace' }, content)
  ]);
}
