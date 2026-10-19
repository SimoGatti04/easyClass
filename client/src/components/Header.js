import React, { createElement as h } from 'react';

export function Header({ user }) {
  const isAuth = user?.authenticated && user?.teacherAuthorized;

  return h('header', { className: 'app-header' }, [
    h('div', { key: 'top', className: 'header-top' }, [
      h('div', { key: 'brand', className: 'brand' }, [
        h('span', { key: 'icon', className: 'brand-icon' }, '🎓'),
        h('div', { key: 'text' }, [
          h('h1', { key: 'title', className: 'brand-title header-title' }, 'Teacher Service'),
          h('span', { key: 'sub', className: 'brand-subtitle' }, 'Tomorrow is ready • Preparazione Lezioni')
        ])
      ]),
      h('div', { key: 'user', className: 'user-badge' }, [
        h('span', {
          key: 'dot',
          className: 'status-dot',
          style: { background: isAuth ? 'var(--success)' : 'var(--danger)' }
        }),
        h('span', { key: 'email' }, isAuth ? (user.user?.email || user.principal || 'Docente Autorizzato') : 'Non Autenticato (Cloudflare Access)')
      ])
    ])
  ]);
}
