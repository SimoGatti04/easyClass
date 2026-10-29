---
name: Teacher Service
description: Shared design foundation for the teacher console and student learning portal.
colors:
  primary: "#1d4ed8"
  primary-hover: "#1e40af"
  primary-light: "#eff6ff"
  secondary: "#475569"
  success: "#15803d"
  success-light: "#f0fdf4"
  warning: "#b45309"
  warning-light: "#fffbeb"
  danger: "#b91c1c"
  danger-light: "#fef2f2"
  app-background: "#f8fafc"
  surface: "#ffffff"
  surface-subtle: "#f1f5f9"
  border: "#e2e8f0"
  border-strong: "#cbd5e1"
  text-main: "#0f172a"
  text-muted: "#64748b"
  text-subtle: "#94a3b8"
  chrome-dark: "#0f172a"
  chrome-panel: "#1e293b"
  chrome-accent: "#3b82f6"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "clamp(1.8rem, 3vw, 2.35rem)"
    fontWeight: 760
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
components:
  teacher-action:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sm}"
    height: "44px"
---

# Design System: Teacher Service

## Overview

**Creative North Star: “A calm command surface for teaching.”** This is a working design articulation of the approved teacher direction B (Operational Console), not a separate product decision. It extends the existing blue-and-slate visual language rather than replacing it. The teacher workspace puts the next useful action and its class context ahead of decoration; density comes from meaningful labels and grouped work, not a wall of cards.

The approved student direction A (Learning Studio) uses the same semantic colors, type, controls, and accessibility rules with a simpler, more welcoming, mobile-first composition. That student presentation is planned for a later checkpoint and is not implemented by UX1. Do not fork the component library or assume a student-only palette.

**Key Characteristics:** operational clarity; restrained blue/slate palette; real words before icons; explicit status and units; responsive layouts with keyboard-visible focus.

## Colors

The incumbent palette is cool, high-contrast blue and slate on light surfaces. The teacher masthead retains a dark navy surface; success, warning, and danger colors describe actual status rather than decoration.

### Primary
- **Action blue** (`#1d4ed8`): primary actions, current navigation, and focus ring.
- **Action blue hover** (`#1e40af`): hover/active emphasis for primary actions.
- **Action blue tint** (`#eff6ff`): selected navigation and quiet emphasis backgrounds.

### Secondary
- **Slate** (`#475569`): secondary accents and the teacher wordmark outline.

### Neutral
- **Application canvas** (`#f8fafc`): the page background.
- **Surface** (`#ffffff`): navigation, controls, and content surfaces.
- **Subtle surface** (`#f1f5f9`): low-emphasis hover and grouping backgrounds.
- **Main text** (`#0f172a`): primary copy and the dark teacher masthead.
- **Muted text** (`#64748b`): supporting copy and measurement units on light backgrounds.
- **Subtle text** (`#94a3b8`): use only where contrast against the dark chrome is verified; do not use for small body copy on light surfaces.
- **Border** (`#e2e8f0`) and **strong border** (`#cbd5e1`): separators, form boundaries, and structure.
- **Dark chrome panel** (`#1e293b`) and **chrome accent** (`#3b82f6`): existing teacher identity/session treatment.

### Semantic status
- **Success** (`#15803d` / `#f0fdf4`), **warning** (`#b45309` / `#fffbeb`), and **danger** (`#b91c1c` / `#fef2f2`) pair clear language with color. Color alone must never communicate state.

**The Truthful State Rule.** Never invent urgency, a deadline, or a count. Use backend-provided state and label every quantity with what it measures.

## Typography

**Display Font:** system sans stack (`-apple-system`, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif)  
**Body Font:** the same system sans stack  
**Label/Mono Font:** system sans for labels; system monospace only for code or measured technical values.

**Character:** familiar, compact, and neutral enough to support long teaching sessions. Hierarchy comes from size and weight, not decorative typefaces or excessive uppercase.

### Hierarchy
- **Display** (760, `clamp(1.8rem, 3vw, 2.35rem)`, 1.12): the teacher page title.
- **Title** (700–800, roughly 1–1.25rem): work-queue and subsection headings.
- **Body** (400, browser-default 1rem, 1.5): instructions and descriptive copy; keep explanatory lines near 65–75ch where space permits.
- **Label** (600–750, roughly 0.75–0.875rem): navigation, KPI names, and status metadata; prefer sentence case outside compact group labels.
- **Measured value** (760, `clamp(1.65rem, 2.5vw, 2.05rem)`, tabular numerals): counts shown with an adjacent explicit unit.

**The Label-and-Value Rule.** A number never stands alone: show its scope or unit, and use correct singular/plural forms.

## Layout

The teacher workspace uses a full-width shell with a dark identity masthead, a sticky grouped navigation row, and a centered main workspace capped at 1440px. The UX1 overview uses a divided four-measure summary, an attention-first two-column work area, then lower-priority preparation and completed states. It avoids metric-card grids and keeps each work row linked to its class, subject, and lesson when those associations exist.

At 1100px, measures reduce to two columns. At 1024px, grouped desktop links give way to a labeled native section selector with optgroup labels, so tablet landscape does not compress the operational navigation. At 820px, secondary queues stack; at 760px, the page heading/actions become vertical and shell spacing tightens. At 480px, queue actions fill the row width and the full authorization status remains readable rather than being ellipsized. Check the selector, keyboard access, active destination, and page overflow at 1024px, 768px, 390px, and 320px.

For the future student Learning Studio, reuse the shared type, colors, controls, status semantics, and focus treatment; simplify the information hierarchy, prioritize one task per view, and design for phone widths first. Do not copy the teacher console's grouped operational density into the student portal.

## Elevation & Depth

The UX1 dashboard is primarily flat: spacing, dividers, and typography establish groups. Existing subtle shadow tokens remain available to components that genuinely sit above the page. Do not add shadows to every queue, KPI, or section; reserve elevation for overlays or visibly layered content.

## Shapes

The existing radius scale is 6px / 10px / 14px for small, medium, and large surfaces. Teacher controls and work groups favor the smaller radii. Fully rounded pills are reserved for compact role/state badges already present in the shell; they are not a general card style. Focus outlines remain clearly visible and offset from the control boundary.

## Components

- **Navigation:** semantic `<nav>` with a clear label, grouped actions, a visible active state (`aria-current`), and a 44px minimum target for the teacher workspace.
- **Buttons:** use existing `.btn` variants; primary actions are reserved for the main next step, secondary actions for refresh/recovery and row actions. Keep visible keyboard focus.
- **KPI summary:** definition-list semantics, concise label, measured value, and unit; warning emphasis is reserved for non-zero work awaiting correction.
- **Work queues:** plain, scan-friendly lists with a status explanation, class/subject/lesson context, and a verb-led action. Empty states state that the queue is empty and suggest an available next step where useful.
- **Feedback:** loading uses a polite status message; blocking load failures use an alert with a retry action. Preserve the distinction between an AI proposal and a teacher-confirmed grade.
- **Forms and tables:** retain shared field/button styles and semantic labels. On narrow screens, prioritize essential row context and preserve access to every action rather than shrinking text.
- **Student presentation:** reuse these primitives and semantics. Add a shared component only when a real second use exists; do not create a parallel student component library.

## Do's and Don'ts

- **Do** lead the teacher dashboard with work requiring attention and provide direct routes to complete it.
- **Do** show class, subject, and lesson context using available data; state plainly when an association is absent.
- **Do** distinguish active assessments, submitted work awaiting correction, and teacher-confirmed results.
- **Do** verify contrast, keyboard order, visible focus, loading/error/empty states, and responsive behavior in a real browser.
- **Don't** infer deadlines, priority, counts, or student risk that the service does not provide.
- **Don't** let a missing list-field masquerade as a real zero; retrieve available detail or represent unknown data honestly.
- **Don't** use same-size card grids as the whole page structure, decorative eyebrow/kicker labels, emoji, or Unicode glyphs as substitutes for meaningful controls/icons.
- **Don't** change assessment lifecycle or grading behavior to compensate for a presentation problem.

## UX2-A patterns — mobile navigation and action queues

- **Teacher navigation:** retain grouped, text-labeled navigation on wide screens. At tablet and phone widths (up to 900px), use one visibly labeled, native section selector with grouped options. Do not require horizontal scrolling to discover sections. The same destinations and selected state must remain available to keyboard and assistive-technology users.
- **Action queue identity:** show each assessment needing attention once, even when it is both active and has submissions awaiting correction. Keep correction and monitoring states explicit, attach only actions supported by those states, and count unique assessments in the queue heading. Delivery counts remain separate from activity counts.
- **Queue overflow:** show a bounded preview and, when needed, explicit links to the full correction and monitoring views. Never omit a state or invent urgency, due dates, or counts to reduce repetition.
- **Responsive actions:** preserve readable class/subject/lesson context, visible focus, semantic status text, and touch-sized controls. Semantic colors reinforce the wording and never carry meaning alone.

These patterns extend the shared design system. The approved student direction A remains a later, simpler, welcoming, mobile-first presentation using the same semantic tokens and accessible controls; this checkpoint does not redesign the student portal.
