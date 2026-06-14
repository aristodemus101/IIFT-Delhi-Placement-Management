# PlacementOS — IIFT Delhi Placement Management

A batch placement management system built with React + Firebase for the IIFT Delhi placement team.

---

## Live URLs

| Environment | URL | When to use |
|---|---|---|
| **Production** | https://iiftd-pc.web.app | The real app. Used by the placement team. |
| **Staging** | https://placement-mgmt-staging.web.app | For testing changes before they go live. |

---

## How deployments work

This project uses **GitHub Actions** for automated deployments. You never need to run build or deploy commands manually.

```
[Make changes on your machine]
         ↓
git push origin staging
         ↓
GitHub automatically builds and deploys → staging.web.app
         ↓
Test your changes on staging
         ↓
Open a Pull Request: staging → main on GitHub
         ↓
GitHub posts a temporary preview URL on the PR (lasts 7 days)
         ↓
Merge the PR
         ↓
GitHub automatically builds and deploys → iiftd-pc.web.app
AND creates a versioned release (v1.0.1, v1.0.2, ...) with a changelog
```

**The golden rule: never push directly to `main`. Always go through `staging` first.**

---

## Setting up locally

### Prerequisites
- Node.js 20+
- A Google account that is on the authorized team list

### Steps

```bash
# 1. Clone the repo
git clone https://github.com/aristodemus101/IIFT-Delhi-Placement-Management.git
cd IIFT-Delhi-Placement-Management

# 2. Install dependencies
npm install

# 3. Create your local environment file
cp .env.local.example .env.local
# Then open .env.local and fill in the Gemini API key

# 4. Start the dev server (runs against staging Firebase)
npm run dev
```

The dev server runs at `http://localhost:5173` and automatically connects to the **staging** Firebase project.

---

## Environment variables

Create a `.env.local` file in the project root (this file is gitignored — never commit it):

```
VITE_GEMINI_KEY=your_gemini_api_key_here
```

Get the Gemini API key from the team lead. The Firebase config is hardcoded in `src/lib/firebase.js` — no env vars needed for Firebase.

### How staging vs production is selected

The app picks the Firebase project automatically based on the URL:
- `localhost` or `placement-mgmt-staging` in the URL → uses staging Firebase
- Any other domain (e.g. `iiftd-pc.web.app`) → uses production Firebase

You don't need to set anything manually.

---

## Firebase projects

| Project | ID | Used for |
|---|---|---|
| Production | `placement-management-6133f` | Live data |
| Staging | `placement-mgmt-staging` | Testing |

Both projects have separate Firestore databases, Storage buckets, and Auth users. Changes in staging never affect production.

---

## GitHub Actions secrets (for new repo admins)

The CI/CD pipeline requires three secrets set in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | What it is |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_PRODUCTION` | Service account JSON from the production Firebase project |
| `FIREBASE_SERVICE_ACCOUNT_STAGING` | Service account JSON from the staging Firebase project |
| `VITE_GEMINI_KEY` | The Gemini API key |

To get a service account JSON:
1. Firebase Console → select the project → gear icon → **Project Settings**
2. **Service accounts** tab → **Generate new private key**
3. Copy the entire contents of the downloaded JSON file into the secret

---

## Rolling back a bad deploy

### Option 1 — Firebase instant rollback (fastest, no code change)
1. Go to [Firebase Console → Hosting](https://console.firebase.google.com/project/placement-management-6133f/hosting/sites)
2. Click **Release history**
3. Find the last good version → click the three dots → **Rollback**

Live within seconds.

### Option 2 — Git revert (leaves a clean history)
```bash
# Find the bad commit hash
git log --oneline

# Revert it
git revert <commit-hash>

# Push to main — CI will redeploy automatically
git push origin main
```

---

## Roles and access

Roles are managed in the **Admin** page inside the app. There are four roles:

| Role | What they can do |
|---|---|
| **Master Admin** | Everything. Can manage roles, approve changes, delete cohorts. Only one person. |
| **Admin** | Can propose and approve changes (import students, place, delete). |
| **Committee** | Can propose changes but cannot approve their own — needs a second admin. |
| **Viewer** | Read-only access. |

The master admin email is set in `src/lib/roleConfig.js`. Admins and pre-seeded viewers are also listed there.

---

## Project structure

```
placement-mgmt/
├── .github/workflows/
│   ├── deploy-production.yml   ← Runs on push to main
│   ├── deploy-staging.yml      ← Runs on push to staging branch
│   └── preview.yml             ← Runs on pull requests
├── functions/
│   └── index.js                ← Firebase Cloud Functions (Push to Sheets, etc.)
├── src/
│   ├── lib/
│   │   ├── firebase.js         ← Firebase config + project selection logic
│   │   ├── roleConfig.js       ← Admin/viewer email lists
│   │   ├── AuthContext.jsx     ← Auth state + role loading
│   │   ├── BatchContext.jsx    ← Active cohort state
│   │   ├── PendingChangesContext.jsx  ← Proposal/approval workflow
│   │   ├── gemini.js           ← AI parsing for opportunities
│   │   └── useOpportunities.js ← Opportunity CRUD
│   ├── components/
│   │   ├── Layout.jsx          ← Sidebar + nav shell
│   │   └── UI.jsx              ← Shared UI components
│   ├── pages/
│   │   ├── AdminPage.jsx       ← Role management, cohort management
│   │   ├── DashboardPage.jsx   ← Stats overview
│   │   ├── RosterPage.jsx      ← Student list + filters
│   │   ├── ActivityPage.jsx    ← Opportunities tracker
│   │   ├── PlacedPage.jsx      ← Placed students
│   │   ├── AnalyticsPage.jsx   ← Placement analytics
│   │   └── ApprovalsPage.jsx   ← Pending change approvals
│   └── main.jsx
├── firestore.rules             ← Firestore security rules
├── storage.rules               ← Storage security rules
├── firebase.json               ← Hosting + functions config
└── .firebaserc                 ← Project aliases (staging/production)
```

---

## Deploying Firebase rules or functions

Rules and functions are **not** deployed automatically by CI (only hosting is). To deploy them manually:

```bash
# Deploy Firestore + Storage rules
firebase deploy --only firestore:rules,storage -P production

# Deploy Cloud Functions
firebase deploy --only functions -P production

# Deploy everything
firebase deploy -P production
```

Always deploy rules to staging first and test before doing production.

---

## Common tasks

### Add a new admin
1. Ask them to sign in to the app once (so their account is created)
2. Go to **Admin page** → find their name → change role to **Admin**

### Add a new cohort
1. Go to **Admin page** → **Cohorts** section → **New Cohort**
2. Import students via the **Import** button on the Roster page

### Update the Gemini API key
1. Update `.env.local` locally (for dev)
2. Update the `VITE_GEMINI_KEY` secret in GitHub (for CI builds)
3. Push any commit to trigger a rebuild — the new key will be baked in

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Routing | React Router v6 |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (Google) |
| Storage | Firebase Storage |
| Hosting | Firebase Hosting |
| Functions | Firebase Cloud Functions (Node.js) |
| AI | Google Gemini API |
| CI/CD | GitHub Actions |
