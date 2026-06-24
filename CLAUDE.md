# PlacementOS — CLAUDE.md

Project-level instructions for Claude Code. These override defaults.

---

## Project Overview

**PlacementOS** is the placement management platform for IIFT Delhi (and other campuses). It is a React + Firebase SPA used by the placement committee, TPOs, and faculty to manage student placements, outreach activities, and analytics.

- **Stack:** React 18, React Router v6, Vite, Firebase (Auth, Firestore, Storage, Functions), PapaParse, XLSX, Lucide icons
- **Auth:** Google Sign-In only. Allowlist-gated via `/config/authorizedUsers` in Firestore.
- **Hosting:** Two environments — `localhost` / staging host → **staging** Firebase project; production domain → **production** Firebase project (auto-detected in `src/lib/firebase.js`)
- **Gemini:** Used for column auto-mapping in the Remapper. Key in `.env.local` as `VITE_GEMINI_KEY` (gitignored).

---

## Running the App

```bash
npm run dev       # start dev server (connects to STAGING Firebase)
npm run build     # production build
npm run preview   # preview production build locally
```

Dev server runs on `localhost` → always hits **staging** Firebase. Never test destructive operations against production.

---

## Deploy Flow

1. **Always staging first.** `npm run build` + deploy to staging host. Verify there.
2. **Production only when user explicitly says so.** Do not push to production without confirmation.

---

## Firebase Projects

| Environment | Project ID | Used when |
|-------------|-----------|-----------|
| Staging | `placement-mgmt-staging` | localhost / staging host |
| Production | `placement-management-6133f` | production domain |

Firebase config lives in `src/lib/firebase.js`. Environment is exported as `ENVIRONMENT`.

Cloud Functions are deployed in region `asia-south1`.

---

## Roles & Permissions

### Role keys (stored in Firestore `/roles/{uid}`)

| Key | Display name | Home route |
|-----|-------------|-----------|
| `admin` | Admin | `/` (Dashboard) |
| `committee` | Committee Member | `/` (Dashboard) |
| `tpo` | TPO | `/tpo` |
| `faculty_coordinator` | Faculty Incharge | `/analytics` |

**CRITICAL:** The internal role key `faculty_coordinator` is stored in Firebase and must NEVER be renamed. Only the display label changes. The display label is `'Faculty Incharge'` (changed from "Faculty Coordinator" — do not revert).

### Master Admin
Defined in `src/lib/roleConfig.js` → `MASTER_ADMIN_EMAILS`. Master admins bypass the allowlist and can toggle master-admin status on other admins. There can be multiple master admins.

### Permission system
- `src/lib/permissions.js` — central source of truth: `PAGE_ACCESS`, `ACTION_ACCESS`, `FIELD_DEFAULTS`, `ROLE_LABELS`, `ROLES`, `CONFIGURABLE_ROLES`
- `src/lib/usePermissions.js` — React hook wrapping the above; reads runtime config overrides from Firestore `/config/permissions`
- `src/lib/AuthContext.jsx` — provides `user`, `role`, `isMasterAdmin`, `authStatus` via context
- **Master admin can only restrict field visibility further, never grant more than `admin`**
- Page access is enforced both client-side (`PageGate` in `App.jsx`) and in Firestore security rules

### Firestore security rules
`firestore.rules` — function names like `isFacultyCoordinator()` use the internal key `faculty_coordinator`. Comments in rules use "faculty_incharge" (updated). Do not rename the Firestore function names or role string values.

---

## Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `/students/{id}` | Student records (per cohort) |
| `/pendingChanges/{id}` | Proposed changes (place/unplace/delete/import) awaiting approval |
| `/roles/{uid}` | Per-user role document |
| `/auditLog/{id}` | Immutable audit trail (append-only) |
| `/batches/{batchId}` | Cohort definitions |
| `/config/authorizedUsers` | Email allowlist + roleMap for first login |
| `/config/permissions` | Runtime-configurable permission overrides |
| `/templates/{id}` | Column-mapping templates (Remapper) |
| `/userPrefs/{uid}` | Per-user UI preferences (column visibility, sort, filters) |
| `/opportunities/{oppId}` | Placement opportunities (Activity page) |
| `/tpoProfiles/{tpoUid}` | TPO profile docs |
| `/tpoProfiles/{tpoUid}/outreach/{id}` | TPO outreach entries |

---

## Cohort / Batch System

- Cohort ID format: `'27-Delhi-IB'` (yearCode-Campus-Programme)
- Campuses: `Delhi`, `Kakinada`, `Gift City`, `Kolkata`
- Programmes: `IB`, `BA` (BA only at Delhi)
- Helpers in `src/lib/batch.js`
- `BatchContext` provides active cohorts and selected cohort state across the app

---

## Key Source Files

```
src/
  App.jsx                   # Router, AuthGate, PageGate, RoleHome
  lib/
    AuthContext.jsx          # Auth state, role loading, allowlist check
    permissions.js           # PAGE_ACCESS, ACTION_ACCESS, ROLE_LABELS, etc.
    usePermissions.js        # Runtime permission hook
    useRoles.js              # Firestore roles CRUD
    firebase.js              # Firebase init, env detection
    roleConfig.js            # MASTER_ADMIN_EMAILS
    batch.js                 # Cohort helpers
    columns.js               # OUR_COLS — canonical field definitions
    gemini.js                # Gemini 2.5 Flash calls (column mapping)
    sheetsSync.js            # Google Sheets sync helper
    useStudents.js           # Student data hook
    useOpportunities.js      # Opportunities/pipeline hook
    useTpoOutreach.js        # TPO outreach hooks (own + all)
    usePermissions.js        # Permission hook with Firestore config overrides
    useSearch.js             # Full-text search across student columns
  config/
    activityTaxonomy.js      # Activity/opportunity type taxonomy
    opportunityActions.js    # Opportunity stage actions
  components/
    Layout.jsx               # App shell, sidebar nav, role chip
    UI.jsx                   # Design system: Btn, Input, Select, Badge, Modal, Table, etc.
    CohortPicker.jsx         # Cohort selector component
  pages/
    DashboardPage.jsx        # Summary stats (admin/committee)
    RosterPage.jsx           # Student roster with filters, sort, import
    PlacedPage.jsx           # Placed students view
    ActivityPage.jsx         # Opportunities / pipeline
    AnalyticsPage.jsx        # Analytics tabs; faculty_coordinator sees TPO tab only
    TpoPage.jsx              # TPO outreach (write for TPO; read-only for admin/faculty_incharge)
    ApprovalsPage.jsx        # Pending changes approval queue
    AdminPage.jsx            # Team access (roles), permissions grid, cohort management
    RemapperPage.jsx         # CSV column remapper (uses Gemini)
    AboutPage.jsx            # About / info page
    roster/
      ImportModal.jsx
      ColumnsModal.jsx
      PlaceModal.jsx
      useRosterPrefs.js
    analytics/
      TpoAnalytics.jsx
```

---

## UI Component Conventions

All shared UI primitives are in `src/components/UI.jsx`:
- `Btn` — button with `variant` (`primary`/`ghost`/`danger`) and `size` (`sm`/`md`)
- `Input` — text/number input; always set explicit `width` via `style` prop
- `Select` — styled `<select>`; **has `width: 100%` by default** — always pass `style={{ width: 'auto' }}` when used inside a flex-wrap filter bar, or it will stretch full-width on wrap
- `Badge` — coloured label with `color` prop (`blue`/`amber`/`green`/`gray`/`red`)
- `Modal` — portal modal with `open`, `onClose`, `title`, `width`
- `Table` — virtualised table with `headers`, `rows`, `onRowContextMenu`
- `PageHeader` — page title + subtitle

---

## Known Invariants / Never Break

1. **Never rename `faculty_coordinator`** in Firestore, rules, or role arrays. Only the display label (`ROLE_LABELS`) changes.
2. **No admin can approve their own pending change** — enforced in Firestore rules and UI.
3. **Master admin status** is separate from the `admin` role — a user can be `admin` without being master admin.
4. **`localhost` always hits staging** — firebase.js detects by hostname.
5. **`FIELD_DEFAULTS`** are hardcoded minimums — Firestore config can only restrict further, never grant more than admin.
6. **Firestore rules are the authoritative security layer** — UI permission checks are UX only.

---

## Pending Changes Flow

1. Committee or admin **proposes** a change (place/unplace/delete/import) → written to `/pendingChanges` with status `pending`
2. A **different** admin approves or rejects
3. Approved changes are applied to `/students`; all steps logged in `/auditLog`

---

## Gemini Integration

- Model: `gemini-2.5-flash` via REST
- Used in `RemapperPage` for auto-mapping CSV headers to canonical columns
- API key: `VITE_GEMINI_KEY` in `.env.local` (gitignored — never commit this file)
- Logic in `src/lib/gemini.js`

---

## Google Sheets Sync

- `src/lib/sheetsSync.js` — pushes filtered roster data to a shared Google Sheet
- Cloud Function `pushFilteredToSheet` (region: `asia-south1`) handles the server-side push
- Exposed via `SheetsSyncContext`

---

## /graphify Skill

When the user types `/graphify`, invoke the Skill tool with `skill: "graphify"` before doing anything else. This skill converts any input (code, docs, data) into a knowledge graph. If a `graphify-out/` directory exists in the project, treat any codebase questions as a `/graphify` query against that graph.

---

## Git / Commit Conventions

- Branch: `main` (single branch, push directly)
- Always stage specific files — never `git add -A`
- Commit message format: short imperative title, then body if needed
- Co-author line: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Deploy to staging before production; never push to production without explicit user confirmation
