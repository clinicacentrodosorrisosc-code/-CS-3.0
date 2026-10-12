---
version: 1
name: Centro do Sorriso Operational System
description: A calm, precise and compact clinical operating system. Navigation stays familiar, information hierarchy leads, and color communicates action or state rather than decoration.

colors:
  primary: "#2563EB"
  primary-hover: "#1D4ED8"
  primary-soft: "#EFF6FF"
  canvas: "#F4F6F8"
  surface: "#FFFFFF"
  surface-subtle: "#F8FAFC"
  surface-raised: "#FFFFFF"
  ink: "#17211D"
  ink-secondary: "#52615A"
  ink-muted: "#74817B"
  border: "#DCE3DF"
  border-strong: "#C8D2CD"
  success: "#15803D"
  success-soft: "#ECFDF3"
  warning: "#B45309"
  warning-soft: "#FFF8E6"
  danger: "#BE123C"
  danger-soft: "#FFF1F2"
  info: "#0369A1"
  info-soft: "#F0F9FF"

darkColors:
  canvas: "#101411"
  surface: "#171C18"
  surface-subtle: "#1D241F"
  surface-raised: "#222A24"
  ink: "#F3F7F4"
  ink-secondary: "#B4C0B9"
  ink-muted: "#87958D"
  border: "#303A33"
  border-strong: "#435047"
  primary: "#73A6FF"
  primary-hover: "#91B8FF"

typography:
  family: "Plus Jakarta Sans, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  dataFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Consolas, monospace"
  title:
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.03em
  section:
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.015em
  body:
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.35
  metadata:
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.4

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px

rounded:
  control: 8px
  card: 12px
  panel: 16px
  pill: 9999px

motion:
  press: 120ms
  quick: 160ms
  standard: 220ms
  overlay: 260ms
  easeOut: "cubic-bezier(0.23, 1, 0.32, 1)"
  easeInOut: "cubic-bezier(0.77, 0, 0.175, 1)"

components:
  page-header:
    height: auto
    title: "{typography.title}"
    padding: "16px 20px"
    borderBottom: "{colors.border}"
  button:
    minHeight: 36px
    rounded: "{rounded.control}"
    typography: "{typography.label}"
  touch-control:
    minHeight: 44px
    rounded: "{rounded.control}"
  input:
    minHeight: 38px
    rounded: "{rounded.control}"
    typography: "{typography.body}"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    borderColor: "{colors.border}"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    borderColor: "{colors.border}"
  metric:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  status:
    rounded: "{rounded.pill}"
    typography: "{typography.metadata}"
---

# Centro do Sorriso Operational System

## Purpose

This system governs the authenticated CS3.0 application in \`src/\`. It is an Operate interface for repeated clinical, commercial, financial and administrative tasks. It does not govern marketing pages or the separate \`apps/crm-james\` product.

## Principles

1. The task leads. Brand expression appears through disciplined type, palette, density and one quiet state transition.
2. Familiar controls stay familiar. Buttons, tabs, fields, tables, dialogs and drawers use standard web affordances.
3. Density is intentional. Primary content is at least 12px, body content defaults to 14px, and touch targets reach 44px on mobile.
4. Color has a job. Blue means action or selection; green, amber and red are reserved for semantic state.
5. One owner per decision. Tokens live in \`src/styles/tokens.css\`; shared component treatment lives in \`src/styles/system.css\`.
6. Motion explains state. Frequent navigation is instant or a short fade; no bounce or repeated page choreography.

## Information hierarchy

- Page title names the current job.
- Module tabs change the working view.
- Filters sit directly above the data they scope.
- KPIs summarize decisions, not every available number.
- Lists and tables carry the work; details open inline, in a side panel or in an accessible dialog when interruption is required.
- Empty, loading and error states retain the surrounding layout.

## Responsive behavior

- Desktop may use two or three coordinated panes when comparison benefits from it.
- Tablet collapses low-priority insight panels before compressing the working list.
- Mobile turns wide tables into summary rows with progressive detail.
- Horizontal scrolling is allowed only inside a data region where column comparison is essential.

## Accessibility

- Every icon-only control has an accessible name.
- Focus is visible and never removed.
- State is communicated by label or icon in addition to color.
- Dialogs trap focus, close with Escape and return focus to their trigger.
- Reduced motion removes positional movement while retaining useful opacity and color feedback.

## Exceptions

- Data visualization may use additional series colors from the documented chart scale.
- Monospace is limited to money, counts, identifiers and measurements.
- Pill radius is limited to status badges, tags and compact segmented controls.
