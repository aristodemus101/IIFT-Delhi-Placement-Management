# Architecture

This app is a React + Firebase placement management system for cohort-scoped student operations, imports, approvals, roster views, placements, and admin workflows.

## Stack

- Frontend: React 18, Vite, React Router
- Backend: Firebase Auth, Firestore, Hosting
- Utilities: PapaParse for CSV import/export, XLSX for spreadsheet handling, Lucide icons

## Environment Selection

The app chooses Firebase configuration in [src/lib/firebase.js](src/lib/firebase.js) based on the runtime environment.

- Production uses the `placement-management-6133f` Firebase project
- Staging uses the `placement-mgmt-staging` Firebase project

The build scripts in [package.json](package.json) support separate staging and production builds, and the staging deploy path is `npm run build:staging && firebase deploy --only hosting --project placement-mgmt-staging`.

## Core Domain Model

The app is organized around approved cohort metadata stored in Firestore.

- `batches/{cohort}` is the source of truth for approved, visible cohorts
- `students/{id}` stores the student record, including `cohort`
- Pending import and admin actions are stored in `pendingChanges`
- Roles, templates, opportunities, and audit data live in their own Firestore collections

The current runtime flow does not depend on legacy `_batch` fields. Visible scope and navigation are driven from approved backend cohort documents.

## Scope Model

Scope is hierarchical and backend-driven:

1. Cycle
2. Graduating year
3. Campus
4. Programme

`src/lib/BatchContext.jsx` derives the available scope options from approved cohort documents and exposes the selected scope to the rest of the app. UI components read that scope to filter rosters, dashboards, analytics, placed records, and admin views.

## Import and Approval Flow

Imports are intentionally two-step:

1. A user proposes an import from the roster UI
2. The proposal is written to `pendingChanges`
3. An admin approves the proposal
4. Approval creates or updates the cohort doc in `batches/{cohort}`
5. Approved student rows are written to `students/{id}` with the required cohort field

This keeps the UI and Firestore rules aligned: student writes are only valid when the cohort exists in `batches`.

## UI Structure

The shell is centered around [src/components/Layout.jsx](src/components/Layout.jsx).

- Sidebar navigation routes to Dashboard, Roster, Placed, Analytics, Approvals, Admin, and Remapper
- The layout shows compact scope chips and count summaries
- Pages consume shared scope state through `BatchContext`

The main pages are:

- [src/pages/DashboardPage.jsx](src/pages/DashboardPage.jsx): summary cards and cohort overview
- [src/pages/RosterPage.jsx](src/pages/RosterPage.jsx): roster, import entry point, and record actions
- [src/pages/PlacedPage.jsx](src/pages/PlacedPage.jsx): placed students and unplace workflow
- [src/pages/AnalyticsPage.jsx](src/pages/AnalyticsPage.jsx): pipeline analytics and heatmaps
- [src/pages/ApprovalsPage.jsx](src/pages/ApprovalsPage.jsx): pending and historical workflow actions
- [src/pages/AdminPage.jsx](src/pages/AdminPage.jsx): roles, cohort management, and schema editing
- [src/pages/RemapperPage.jsx](src/pages/RemapperPage.jsx): column mapping and export templates

## Data Flow

The app is read-heavy in the UI and write-restricted in the backend.

- Firestore queries populate the roster, analytics, and admin screens
- CSV import parses raw rows into pending artifacts
- Approval writes student records and cohort metadata
- Firestore rules enforce authenticated access and valid cohort references

## Security Model

Firestore rules are the last line of defense.

- Authenticated users can read data according to their role and scope
- Student writes require a valid cohort
- The cohort must exist in `batches`
- Admin-only paths protect import approval, role management, and schema changes

## Deployment

Current deployment targets are:

- Staging: `placement-mgmt-staging`
- Production: `placement-management-6133f`

Recommended commands:

```bash
npm run build:staging
firebase deploy --only hosting --project placement-mgmt-staging
firebase deploy --only firestore:rules --project placement-mgmt-staging
```

## Notes

- The app intentionally keeps user-facing labels short because the navigation already carries a hierarchical scope model
- Legacy batch wording may still exist in helper names or documentation, but runtime scope selection is cohort-based