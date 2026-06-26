<!--
Sync Impact Report
Version change: template -> 1.0.0
Modified principles: Placeholder principles -> Dashboard Reclamos y Facturacion principles
Added sections: Data and Repository Constraints; Delivery Workflow and Quality Gates
Removed sections: Placeholder SECTION_2 and SECTION_3
Templates requiring updates:
- Updated: .specify/templates/plan-template.md
- Updated: .specify/templates/spec-template.md
- Updated: .specify/templates/tasks-template.md
- Reviewed: .specify/templates/checklist-template.md
Follow-up TODOs: None
-->

# Dashboard Reclamos y Facturacion Constitution

## Core Principles

### I. Preserve Existing Functionality
Every change MUST keep existing user-visible workflows operational. Regressions in
current dashboard behavior, navigation, visual rendering, CSV/XLSX import,
territorial views, maps, filters, or backend contracts are release blockers.

Rationale: This dashboard is an operational tool; new value is unacceptable if it
breaks the workflows already used for reclamos, facturacion, and territorial
analysis.

### II. Never Ship a Blank Screen
Frontend changes MUST preserve a renderable application shell and usable fallback
states for loading, empty, failed, or partially available data. Any error boundary,
data fetch, import flow, map layer, or route change MUST avoid leaving the app in a
blank or unrecoverable visual state.

Rationale: A blank screen hides the failure mode and prevents business users from
continuing their analysis.

### III. Protect Data Import and Source Integrity
CSV and XLSX import behavior MUST remain compatible with existing accepted files,
field mappings, validation, and error reporting. Files under `data/raw` MUST NOT be
modified in place. ZIP files, Parquet files, and heavy Censo source files MUST NOT be
committed to the repository.

Rationale: Import fidelity and immutable raw inputs make analyses reproducible while
keeping the repository lightweight.

### IV. Protect Territorial Experience
Leaflet map behavior, geographic layers, RM view, Regiones view, Ruta Visitador, and
filters by dia, semana, mes, comuna, prioridad, and estado MUST continue to work
after any change. Territorial changes MUST verify both mapped and non-mapped states
without corrupting existing layer toggles or geographic joins.

Rationale: Territorial workflows are central to prioritization, visit planning, and
regional analysis.

### V. Maintain Typed Frontend and Compatible Backend
TypeScript MUST remain strongly typed; `any` is allowed only when integrating
untyped external data and MUST be narrowed as close to the boundary as practical.
FastAPI changes MUST remain compatible with existing endpoints, payload shapes, and
clients unless an explicitly versioned migration is documented.

Rationale: Strong boundaries reduce hidden runtime failures across the React
dashboard, import pipeline, and FastAPI API.

## Data and Repository Constraints

Raw source files are immutable project inputs. New derived data MUST be generated
outside `data/raw` and documented with the command or script that produced it. Large
Censo artifacts, ZIP archives, and Parquet files MUST stay outside Git; use ignored
local storage, documented download steps, or deployment-specific storage instead.

Changes that touch importacion, cruce censo-reclamos, dashboard territorial, or
despliegue MUST identify which stage they belong to and avoid coupling unrelated
stages in the same feature unless the plan documents why the coupling is required.

## Delivery Workflow and Quality Gates

Work MUST be separated by stage: importacion, cruce censo-reclamos, dashboard
territorial, and despliegue. Each plan MUST state the affected stage or stages and
the regression surface for existing behavior.

Frontend changes MUST run `npm run build` before completion. Backend changes MUST
validate `/api/health`, `/api/dashboard/resumen`, and `/api/dashboard/comunas`
before completion, unless the backend cannot be started; in that case the blocker
and residual risk MUST be documented.

Every delivery note MUST document modified files, test commands run, validation
results, and risks detected. If a required validation is skipped, the reason and
manual follow-up MUST be recorded.

## Governance

This constitution supersedes local conventions when planning, implementing, testing,
or reviewing changes in this repository. All specs, plans, and task lists MUST
include constitution checks for the principles above.

Amendments require a documented reason, an updated Sync Impact Report, and review of
dependent Spec Kit templates. Versioning follows semantic versioning: MAJOR for
breaking governance changes, MINOR for new or materially expanded principles, and
PATCH for clarifications that do not change obligations.

Compliance is mandatory before a change is considered complete. Any exception MUST
be explicit in the plan or final delivery note with the reason, risk, and follow-up
owner.

**Version**: 1.0.0 | **Ratified**: 2026-06-25 | **Last Amended**: 2026-06-25