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

### GitHub Actions (primary — use this)
- **Push to `main`** → GitHub Actions auto-builds and deploys to **production** (`iiftd-pc.web.app`) + creates a versioned GitHub Release (`v1.0.N`)
- **Push to `staging` branch** → auto-deploys to staging Firebase project
- **Pull request** → deploys a temporary Firebase preview channel (expires 7 days)

**VITE_GEMINI_KEY** is stored as a GitHub secret — do not add it to the build command manually.

### Workflow
1. Make changes, build locally (`npm run build`) to verify no errors
2. Commit with co-author line, push to `main`
3. Pipeline runs automatically — check with `gh run list --limit 5`
4. Production is live once the run shows `✓ completed success`

Do **not** run `firebase deploy --only hosting` manually — the pipeline handles it. Never push to production without user confirmation.

---

## Release Process

### When to create a release
After every significant milestone — not every commit. Triggers:
- Major new features (new page, new data model, new workflow)
- Performance improvements with measurable impact
- Security fixes
- Bug fixes affecting data integrity or user access
- Batch of related improvements shipped together

Minor copy changes, icon tweaks, and single-line fixes do not warrant a release on their own.

### How releases work (automated)
Every push to `main` triggers the GitHub Actions pipeline which **automatically creates a versioned GitHub Release** (`v1.0.N`) after a successful deploy. You do not need to create releases manually — they are created by the pipeline.

To verify a release was created:
```bash
gh release list --limit 5
gh release view v1.0.N
```

### Release notes (manual, for significant changes)
The auto-created release has a bare commit message. For major milestones, add descriptive notes:

```bash
gh release edit v1.0.N --notes "$(cat <<'EOF'
## Summary
- What changed and why (not just what)
- Breaking changes (if any)
- Migration steps (if any)

## Test coverage
- N tests passing (vitest)
- Auth/security invariants: verified
- Layout: verified

## Deploy
- Deployed to production: iiftd-pc.web.app
- Staging verified before production: yes
EOF
)"
```

### Versioning convention
The pipeline auto-increments `v1.0.N`. Semantic versioning intent:
- `v1.0.N` — production-stable, incremental improvements
- `v1.1.0` — major new module or breaking schema change (manual tag required)
- `v2.0.0` — architectural rewrite (manual tag required)

To manually tag a major version:
```bash
git tag v1.1.0 -m "Release v1.1.0: <short description>"
git push origin v1.1.0
gh release create v1.1.0 --title "v1.1.0" --notes "..."
```

### Rollback
Each GitHub Release is tied to a specific commit SHA. To roll back production:
1. Find the last good release: `gh release list`
2. Get its commit: `gh release view v1.0.N --json targetCommitish`
3. Revert: `git revert HEAD` (preferred) or coordinate a force-push with the team
4. Push the revert — the pipeline will deploy it as a new release

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
| `/intel/{docId}` | Recruiter intelligence records (multi-college, multi-year) |

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
    useSearch.js             # Full-text search across student columns
    intel.js                 # Intel: column mapping, dedup key, batch upload, fuzzy match
    useIntel.js              # Intel: Firestore hook, filter, IIFT benchmark join
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
    IntelPage.jsx            # Recruiter intelligence (all roles)
    AboutPage.jsx            # About / info page
    roster/
      ImportModal.jsx
      ColumnsModal.jsx
      PlaceModal.jsx
      useRosterPrefs.js
    analytics/
      TpoAnalytics.jsx
    intel/
      IntelTable.jsx         # Dense sortable table view
      CompanyDrawer.jsx      # Right-side detail panel (Overview/IIFT History/All Records/POC)
      IntelEditModal.jsx     # Add / edit single intel record
      UploadModal.jsx        # Excel bulk upload with parse preview + progress bar
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
7. **SIP columns must never be stored on the student doc** — `parseSipColumns()` strips them; they live only in `_placement_summer`.
8. **`config/authorizedUsers` must always exist** — master admins bypass it in code but all other users are blocked without it. Never delete this doc.
9. **Intel records are never hard-deleted from the client** — soft-delete sets `_deleted: true`; only admin can hard-delete via Firestore console. The `useIntel` hook always queries `where('_deleted', '!=', true)`.
10. **Intel dedup key** = `recruiterId + collegeName + placementYear + placementCycle + program` (all uppercased/normalised). Same company at different colleges = different docs. Do not change this key formula without migrating existing `_dedupKey` fields.
11. **Intel IIFT benchmark window** = last 2 calendar years. Hardcoded in `useIntel.js` as `currentYear - 2`. Never extend to all-time without user confirmation — it would collapse the "IIFT Gap" signal.

---

## Authorised Users (as of last sync)

All 20 users are in `config/authorizedUsers` on both staging and production:

| Email | Role |
|---|---|
| divyaanshmehta513@gmail.com | admin (master) |
| divyaansh_d27@iift.edu | admin (master) |
| jay_d27@iift.edu | admin |
| adityasingh_d27@iift.edu | admin |
| basil_d27@iift.edu | admin |
| lakshyc_d27@iift.edu | committee |
| ranishka_d27@iift.edu | committee |
| rahulm_d27@iift.edu | committee |
| arnav_d27@iift.edu | committee |
| shibanee_ba27@iift.edu | committee |
| sidhant_d27@iift.edu | committee |
| jatin_d27@iift.edu | committee |
| mohamed_d27@iift.edu | committee |
| khushi_d27@iift.edu | committee |
| dev_ba27@iift.edu | committee |
| vaibhav_ba27@iift.edu | committee |
| preeti.tak@iift.edu | faculty_coordinator |
| preetitak@iift.edu | faculty_coordinator |
| sonali@iift.edu | tpo |
| monikatiwari@iift.edu | tpo |

---

# Engineering Operating System

This project prioritizes:

1. Data Integrity
2. Security
3. Auditability
4. Reliability
5. Maintainability
6. Performance
7. UX
8. Developer Convenience

When tradeoffs exist, always favor the higher priority item.

---

## Architecture Principles

Before implementing any change:

1. Understand existing implementation.
2. Reuse existing patterns.
3. Extend before replacing.
4. Reuse hooks before creating hooks.
5. Reuse components before creating components.
6. Minimize surface area of changes.
7. Preserve backwards compatibility.
8. Avoid unnecessary dependencies.

Always ask:

- Does this already exist?
- Is there a simpler solution?
- Does this affect permissions?
- Does this affect Firestore rules?
- Does this affect auditability?
- Does this affect production behavior?

---

## Architecture Hierarchy

Always prefer:

1. Existing utility
2. Existing hook
3. Existing component
4. Existing page pattern
5. New hook
6. New utility
7. New component
8. New dependency

Never skip levels without justification.

---

## Change Risk Classification

### Low Risk

- Styling
- Labels
- Icons
- Documentation

### Medium Risk

- New pages
- New hooks
- Analytics changes
- New collections

### High Risk

- Authentication
- Roles
- Permissions
- Firestore Rules
- Approval Flow
- Batch Logic
- Placement Status Logic
- Data Import Logic

For High Risk changes:

1. Explain impact.
2. Identify affected files.
3. Explain rollback strategy.
4. Verify security implications.
5. Verify staging before production.

## Pending Changes Flow

1. Committee or admin **proposes** a change (place/unplace/delete/import) → written to `/pendingChanges` with status `pending`
2. A **different** admin approves or rejects
3. Approved changes are applied to `/students`; all steps logged in `/auditLog`

---

## Placement Data Schema

Every student doc in `/students/{id}` carries two independent placement slots:

```js
{
  // ... all roster columns ...
  cohort: '27-Delhi-IB',

  _placed_summer: true,          // boolean
  _placement_summer: {
    date:        '2025-04-10',   // YYYY-MM-DD
    company:     'KPMG',
    role:        'Analyst',
    sector:      'Consulting & Professional Services',
    location:    'Domestic',     // or 'International'
    package:     '10 LPA',       // stipend for summer
    ctcNotes:    '',
    via:         'Summer PPO',   // see VIA_OPTIONS in PlaceModal
    placedAtIso: '2025-04-10T00:00:00.000Z',
  },

  _placed_final: false,
  _placement_final: null,        // same shape as above when filled
}
```

Both slots are independent — a student can have both true simultaneously.

### Cohort active cycle
`/batches/{cohortId}.activeCycle` — `'summer'` or `'final'` (default `'final'`). Controls:
- Which placement filter Roster shows by default
- Which cycle PlaceModal locks to
- Which tab Placed page defaults to

---

## Intel — Recruiter Intelligence

`/intel/{docId}` stores one recruiter-appearance per document. The same company (e.g. KPMG) recruiting at 5 colleges in 3 years = 15 documents. This is intentional and correct.

### Schema

```js
{
  recruiterId:     'ASIANPAINTS',      // normalised uppercase, no spaces — dedup key component
  recruiterName:   'Asian Paints',     // display name
  alias:           'Asian Paints',
  placementYear:   2022,               // number
  academicBatch:   '2020-22',
  placementCycle:  'Finals',           // 'Finals' | 'Summer' | 'Lateral'
  collegeName:     'SPJIMR',
  campus:          '',
  program:         'PGDM',
  sector:          'FMCG',
  function:        '',
  rolesMentioned:  '',
  recruiterType:   '',
  internationalOpp: false,
  internationalLoc: '',
  numberOfOffers:  null,               // number or null
  sourceReport:    'report.pdf',
  sourceType:      'Logo Wall',
  evidence:        '',
  remarks:         '',
  compensation:    '18–24 LPA',
  poc: { name: '', email: '', phone: '' },
  notes:           '',
  importBatch:     'upload-1234-uid',  // UUID from bulk upload
  _dedupKey:       'ASIANPAINTS::SPJIMR::2022::FINALS::PGDM',
  _deleted:        false,              // soft-delete flag
  createdAt:       Timestamp,
  updatedAt:       Timestamp,
  createdBy:       uid,
  updatedBy:       uid,
}
```

### Permission model

| Role | Read | Write (add/edit) | Upload (bulk) | Delete (soft) |
|------|------|-----------------|--------------|--------------|
| `admin` | ✓ | ✓ | ✓ | ✓ |
| `committee` | ✓ | ✓ | ✗ | ✗ |
| `tpo` | ✓ | ✗ | ✗ | ✗ |
| `faculty_coordinator` | ✓ | ✗ | ✗ | ✗ |

Actions: `writeIntel`, `uploadIntel`, `deleteIntel` in `permissions.js`. Page `intel` is in `CONFIGURABLE_PAGES` so access can be toggled via the Admin panel.

### IIFT Benchmark

`useIntel.js` builds an in-memory set of normalised company names from `/students` where `_placed_final` or `_placed_summer` is true and the placement date is within the last 2 calendar years. Each intel record gets `_iiftStatus: 'at_iift' | 'gap'` attached at read time — this is never stored in Firestore.

Fuzzy matching in `intel.js → fuzzyMatch()`: normalises both strings (uppercase, strip non-alphanumeric), checks containment, then token overlap for strings ≥ 4 chars.

### Upload flow

1. Admin selects `.xlsx` / `.xls` / `.csv` file in `UploadModal.jsx`
2. XLSX parses first sheet → `parseIntelRows()` maps headers (case-insensitive) to canonical fields
3. Preview shown (first 10 rows, warnings for skipped rows)
4. On confirm: `uploadIntelBatch()` writes in chunks of 499 (Firestore batch limit)
5. Dedup: queries existing docs by `_dedupKey` (in chunks of 30), upserts matches, inserts new
6. Progress bar updates via `onProgress` callback
7. Audit log entry written to `/auditLog` with `type: 'intel_upload'`

---

## SIP Import (Summer data pre-loaded)

When importing a cohort that has already completed Summers, use the **"Summer (SIP) data already in file"** toggle in the Import modal. The file must include these columns alongside all bio columns:

| Column | Maps to |
|---|---|
| `SIP Status` | `_placed_summer = true` if value is `Placed` |
| `SIP Company` | `_placement_summer.company` |
| `SIP Role` | `_placement_summer.role` |
| `SIP Company Sector` | `_placement_summer.sector` |
| `SIP Company Domain` | `_placement_summer.sector` (fallback) |
| `SIP Roles and Responsibilities` | `_placement_summer.ctcNotes` |
| `Location` | `_placement_summer.location` |
| `DOP` | `_placement_summer.date` |
| `Placed Via` | `_placement_summer.via` |
| `SIP Stipend (In Lakhs/month)` | `_placement_summer.package` |

On approval: SIP columns are stripped from the student doc, `_placed_summer` is set per row, and cohort `activeCycle` is forced to `'final'` automatically.

Logic in `src/lib/PendingChangesContext.jsx` → `parseSipColumns()` and `approveImport()`.

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

# Skill Operating System

Claude should proactively select skills before implementation.

---

## find-skills

Use when:

- Unsure which skill applies.
- Complex feature requests.
- Architecture discussions.
- Large debugging sessions.

Purpose:

Discover relevant skills before starting work.

---

## context-canary

Use before:

- Large refactors.
- Data model changes.
- Permission changes.
- Ambiguous requirements.

Purpose:

Identify hidden assumptions, conflicting requirements, and missing context.

Typical workflow:

find-skills
→ context-canary
→ implementation

---

## grill-me

Use for:

- Architecture reviews
- Security reviews
- Permission reviews
- Firestore reviews
- Scalability reviews

Purpose:

Act as principal engineer and challenge the proposed design.

Typical workflow:

context-canary
→ grill-me
→ implementation

---

## junior-to-senior

Use for:

- React reviews
- Hook reviews
- Firebase integration reviews
- Refactoring

Purpose:

Upgrade implementation quality to production-grade standards.

Typical workflow:

implementation
→ junior-to-senior
→ final implementation

---

## caveman

Use when:

- Architecture feels overengineered
- Too many abstractions exist
- Multiple hooks are being introduced
- Refactors are becoming complex

Purpose:

Find the simplest possible solution.

Typical workflow:

grill-me
→ caveman
→ implementation

---

## loop-factory

Use when:

- New modules
- Analytics systems
- Workflow redesigns
- Multi-step migrations
- Major feature development

Purpose:

Create implementation roadmap before coding.

Typical workflow:

context-canary
→ loop-factory
→ implementation

---

## interface-kit

Use when:

- New pages
- New modals
- New dashboards
- New tables
- New admin screens

Purpose:

Maintain UI consistency with PlacementOS patterns.

Typical workflow:

interface-kit
→ implementation

---

## fuck-slop

Use when:

- Documentation
- User-facing copy
- Admin instructions
- Error messages
- Empty states

Purpose:

Remove AI-generated language and improve clarity.

Typical workflow:

draft
→ fuck-slop
→ final content

---

# Recommended Skill Chains

## New Feature

context-canary
→ loop-factory
→ interface-kit
→ junior-to-senior

---

## Security-Sensitive Change

context-canary
→ grill-me
→ implementation
→ junior-to-senior

---

## Firestore Schema Change

context-canary
→ grill-me
→ caveman
→ implementation

---

## Dashboard Development

context-canary
→ loop-factory
→ interface-kit
→ junior-to-senior

---

## Refactor

grill-me
→ caveman
→ junior-to-senior

---

## Documentation

draft
→ fuck-slop

---

# Self Review Process

Before completing any implementation:

1. Review for simpler solutions.
2. Review security implications.
3. Review role impacts.
4. Review Firestore impacts.
5. Review mobile responsiveness.
6. Review auditability.
7. Remove unused imports.
8. Verify backwards compatibility.
9. Verify staging behavior.
10. Verify consistency with existing patterns.

Never complete medium or high-risk work without a self-review.

## Git / Commit Conventions

- Branch: `main` (single branch, push directly)
- Always stage specific files — never `git add -A`
- Commit message format: short imperative title, then body if needed
- Co-author line: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
- Deploy to staging before production; never push to production without explicit user confirmation
