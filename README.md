# PlacementOS — Deployment Guide

A placement batch management system built with React + Firebase.

---

## What's in the app

| Feature | Description |
|---|---|
| **Dashboard** | Live stats — total, active, placed, avg CAT %ile, gender/category breakdown |
| **Roster** | Filter by CAT %ile, work ex, category, gender, PWD. Sort any column. Import CSV. One-click "Mark Placed" |
| **Placed** | Separate record of placed students with company + date. Unplace if needed |
| **Column Remapper** | Paste company headers → auto-map to your fields → export CSV in their format. Save templates per company |

---

## Step 1 — Create Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it (e.g. `placement-iift-2027`) → Continue
3. Disable Google Analytics (not needed) → **Create project**

---

## Step 2 — Enable Firestore

1. In the left sidebar → **Firestore Database** → **Create database**
2. Choose **Start in production mode** → Next
3. Select region: **asia-south1 (Mumbai)** → **Enable**

---

## Step 3 — Enable Google Auth

1. Left sidebar → **Authentication** → **Get started**
2. Sign-in method tab → **Google** → Enable → add your institute email as support email → **Save**

### Restrict to your team only (recommended)

After enabling Google Auth, go to **Authentication → Settings → Authorized domains** and add your domain.

To restrict to specific emails, update `firestore.rules`:

```
allow read, write: if request.auth != null
  && request.auth.token.email in [
    'yourname@iift.edu',
    'colleague@iift.edu'
  ];
```

---

## Step 4 — Get your Firebase config

1. Project Overview → click the **</>** (Web) icon → Register app
2. Name: `placement-web` → **Register app**
3. Copy the `firebaseConfig` object shown

Open `src/lib/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
}
```

---

## Step 5 — Add your domain to Authorized Domains

1. Firebase Console → **Authentication** → **Settings** → **Authorized domains**
2. Your Firebase Hosting domain (`your-project.web.app`) is added automatically after deploy
3. If using a custom domain, add it here too

---

## Step 6 — Install Firebase CLI & Deploy

```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Login
firebase login

# In the project folder
cd placement-mgmt

# Initialize (select Hosting + Firestore)
firebase init

# When prompted:
# - Use existing project → select the one you created
# - Public directory → dist
# - Single-page app → Yes
# - Auto-builds → No
# - Overwrite dist/index.html → No

# Build the app
npm run build

# Deploy
firebase deploy
```

Your app will be live at `https://your-project-id.web.app`

---

## Step 7 — Deploy Firestore rules

```bash
firebase deploy --only firestore:rules
```

---

## Importing your batch data

1. Open your Google Sheet
2. **File → Download → Comma Separated Values (.csv)**
3. Open the app → **Roster** → **Import CSV**

The app reads all 130 columns automatically. Nothing is lost — it stores the full raw row.

---

## Day-to-day workflow

### When a company sends their column format:
1. Go to **Column Remapper**
2. Paste their header row
3. Click **Auto-map** — it fuzzy-matches ~80% automatically
4. Fix the remaining manually
5. **Save as Template** with the company name
6. **Export Active** → send to company

### When a student gets placed:
1. Go to **Roster** → find the student → click **✓ Place**
2. Enter the company name → **Confirm**
3. Student moves to **Placed** tab automatically

### For the placed sheet:
- Go to **Placed** → **Export Placed Sheet**
- Opens as a CSV with company + date columns appended

---

## Re-deploying after changes

```bash
npm run build
firebase deploy --only hosting
```

---

## Folder structure

```
placement-mgmt/
├── src/
│   ├── lib/
│   │   ├── firebase.js        ← PUT YOUR CONFIG HERE
│   │   ├── columns.js         ← All 130 column definitions + synonym map
│   │   ├── useStudents.js     ← Firestore hooks
│   │   ├── csv.js             ← Import/export logic
│   │   └── AuthContext.jsx    ← Google auth
│   ├── components/
│   │   ├── Layout.jsx         ← Sidebar + nav
│   │   └── UI.jsx             ← Shared components
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── DashboardPage.jsx
│   │   ├── RosterPage.jsx
│   │   └── RemapperPage.jsx
│   │   └── PlacedPage.jsx
│   └── main.jsx
├── firebase.json              ← Hosting config
├── firestore.rules            ← Security rules
└── firestore.indexes.json     ← DB indexes
```

---

## Adding new columns later

All column definitions live in `src/lib/columns.js`.

To add a new field:
1. Add an entry to `OUR_COLS` array with a key, label, and path function
2. Add synonyms to `SYNONYMS` so auto-mapping picks it up
3. Run `npm run build && firebase deploy --only hosting`

---

## Costs

Firebase free tier (Spark plan) covers:
- **Firestore**: 1GB storage, 50k reads/day, 20k writes/day — more than enough for 400 students
- **Hosting**: 10GB/month bandwidth
- **Auth**: Unlimited users

You will not need to pay anything for this scale.
