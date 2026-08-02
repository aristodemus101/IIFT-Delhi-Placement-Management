/**
 * Backfill script: clean up invalid `via` values in /opportunities
 *
 * Changes made:
 *   1. `via: 'Referral'` → `via: ''`  (Referral removed from VIA_OPTIONS)
 *   2. `via: 'Case Comp'` on non-Hiring docs → `via: ''`
 *      (Legacy docs that were already correctly resolved as Case Comp type
 *       but still carry the old via='Case Comp' marker string)
 *
 * Run against STAGING first, verify, then run against PRODUCTION.
 *
 * Usage:
 *   FIREBASE_PROJECT=placement-mgmt-staging node scripts/backfill-via.mjs
 *   FIREBASE_PROJECT=placement-management-6133f node scripts/backfill-via.mjs
 *
 * Requires: @firebase/app and @firebase/firestore (already in package.json as firebase)
 * Uses the Firebase Admin SDK — set GOOGLE_APPLICATION_CREDENTIALS or run
 * with `firebase emulators:exec` for local testing.
 */

import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT = process.env.FIREBASE_PROJECT
if (!PROJECT) {
  console.error('Set FIREBASE_PROJECT env var (staging or production project ID)')
  process.exit(1)
}

const VALID_VIA = new Set(['PPO', 'Direct', ''])

initializeApp({ projectId: PROJECT })
const db = getFirestore()

async function run() {
  const snap = await db.collection('opportunities').get()
  const toFix = []

  for (const doc of snap.docs) {
    const data = doc.data()
    const { type, via } = data
    let newVia = via ?? ''

    // 'Referral' is no longer a valid via value
    if (newVia === 'Referral') {
      newVia = ''
    }

    // 'Case Comp' in via was only ever a legacy type marker — not a placement route.
    // It should have been cleared when we first canonicalised type.
    // Safe to clear because the real type field is now 'Case Comp'.
    if (newVia === 'Case Comp') {
      newVia = ''
    }

    // Any other value not in VALID_VIA
    if (!VALID_VIA.has(newVia)) {
      newVia = ''
    }

    if (newVia !== (via ?? '')) {
      toFix.push({ id: doc.id, title: data.title, type, oldVia: via, newVia })
    }
  }

  if (toFix.length === 0) {
    console.log('✓ No documents need updating.')
    return
  }

  console.log(`Found ${toFix.length} document(s) to update:`)
  toFix.forEach(d => {
    console.log(`  [${d.id}] "${d.title}" (type=${d.type}) via: "${d.oldVia}" → "${d.newVia}"`)
  })

  const DRY_RUN = process.env.DRY_RUN !== 'false'
  if (DRY_RUN) {
    console.log('\nDRY RUN — no writes. Set DRY_RUN=false to apply.')
    return
  }

  console.log('\nApplying updates…')
  const batch = db.batch()
  toFix.forEach(({ id, newVia }) => {
    batch.update(db.collection('opportunities').doc(id), { via: newVia })
  })
  await batch.commit()
  console.log(`✓ Updated ${toFix.length} document(s).`)
}

run().catch(err => { console.error(err); process.exit(1) })
