# Staging Environment Setup Guide

## Overview
This guide helps you set up a staging Firebase project with automatic data expiry (1 month TTL).

## Step 1: Create Staging Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Add project"** → Name it `placement-mgmt-staging`
3. Enable Google Analytics (optional)
4. Wait for project creation to complete

## Step 2: Set Up Authentication & Firestore

1. In Firebase Console, go to **Authentication**
   - Enable **Google** as a sign-in method
   - Add authorized redirect URIs for your staging domain

2. Go to **Firestore Database**
   - Click **"Create database"**
   - Select region (same as production recommended)
   - Start in **production mode** (we'll secure with rules)

## Step 3: Configure Firestore TTL Rules

1. Go to **Firestore** → **Rules**
2. Replace with the rules from `firestore.rules` (includes TTL validation)
3. Deploy the rules

## Step 4: Add Staging Config to firebase.js

In `src/lib/firebase.js`, update the staging config with your Firebase Console credentials:

```javascript
const stagingConfig = {
  apiKey: "YOUR_STAGING_API_KEY",           // From Firebase Console
  authDomain: "placement-mgmt-staging.firebaseapp.com",
  projectId: "placement-mgmt-staging",
  storageBucket: "placement-mgmt-staging.firebasestorage.app",
  messagingSenderId: "YOUR_STAGING_MESSAGING_ID",
  appId: "YOUR_STAGING_APP_ID",
  measurementId: "YOUR_STAGING_MEASUREMENT_ID"
};
```

Get these from: **Firebase Console** → **Project Settings** → **Your apps** → **Web**

## Step 5: Update Environment Variables

Create `.env.staging`:
```
VITE_NODE_ENV=staging
```

Create `.env.production`:
```
VITE_NODE_ENV=production
```

## Step 6: Running Different Environments

### Development (uses staging):
```bash
npm run dev
```

### Production build:
```bash
npm run build -- --mode production
```

### Staging build:
```bash
npm run build -- --mode staging
```

## How TTL Works

### Adding TTL to New Documents

When creating documents in staging, add the TTL field:

```javascript
import { withTTL } from './lib/firestoreTTL';
import { ENVIRONMENT } from './lib/firebase';

const isStaging = ENVIRONMENT === 'staging';
const docData = withTTL(
  { name: 'Test Data', /* other fields */ },
  isStaging
);

// Then save:
await setDoc(doc(db, 'collection', 'docId'), docData);
```

### What Happens After 30 Days

Firestore automatically deletes documents with `__expiresAt` timestamps that have passed. This is a built-in Firestore feature (TTL policy).

**Requirements:**
- Enable TTL policy in Firestore settings for your staging project
- Set policy to delete documents when `__expiresAt` field is older than "now"

### Enable TTL Policy in Firestore

1. Go to **Firestore Database** → **Settings** → **TTL policy**
2. Click **"Create policy"**
3. Collection: (optional, or leave blank for all)
4. TTL field: `__expiresAt`
5. Click **Save**

## Step 7: Deploy with Environment Switching

Update your deployment to respect `NODE_ENV`:

- **Staging Deploy**: Set `NODE_ENV=staging` environment variable
- **Production Deploy**: Set `NODE_ENV=production` environment variable

Or in `.firebaserc`:
```json
{
  "projects": {
    "staging": "placement-mgmt-staging",
    "production": "placement-management-6133f"
  }
}
```

Deploy to staging:
```bash
firebase deploy --project staging
```

## Summary

✅ Separate Firebase projects for production and staging
✅ Automatic data deletion after 30 days in staging
✅ Environment-based configuration
✅ TTL fields on all staging documents
✅ Clean separation of test and production data
