import { useState, useEffect } from 'react'
import {
  collection, query, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from './firebase'

export const OPP_STATUS = ['open', 'shortlisted', 'interviewing', 'closed']

export const STAGE_TYPES = {
  opportunity:  'Opportunity Posted',
  shortlist:    'Shortlist Released',
  interview:    'Interview Round',
  selected:     'Final Selection',
}

// Canonical blank opportunity — every doc always has these keys
export function blankOpportunity() {
  return {
    title:        '',
    type:         'Hiring',              // Hiring | Live Project | Campus Engagement
    subtype:      '',                    // Guest Lecture | Workshop | Webinar | ...
    via:          '',                    // Case Comp | PPO | Hackathon | Referral | Direct | ''
    organization: '',
    applicability:'both',                // summer | final | both
    roles:        [],
    stipend:      '',
    ctc:          '',
    duration:     '',
    location:     '',
    deadline:     '',
    eligibility:  '',
    eoi_link:     '',
    apply_link:   '',
    tracker_link: '',
    description:  '',
    notes:        '',
    status:       'open',
  }
}

// ── Opportunities feed ────────────────────────────────────────────────────────

export function useOpportunities() {
  const [opportunities, setOpportunities] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, 'opportunities'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setOpportunities(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, err => { console.error('opportunities error', err); setLoading(false) })
    return () => unsub()
  }, [])

  return { opportunities, loading }
}

// ── Stages subcollection for one opportunity ──────────────────────────────────

export function useStages(oppId) {
  const [stages, setStages] = useState([])

  useEffect(() => {
    if (!oppId) return
    const q = query(collection(db, 'opportunities', oppId, 'stages'), orderBy('createdAt', 'asc'))
    const unsub = onSnapshot(q, snap => {
      setStages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }, err => console.error('stages error', err))
    return () => unsub()
  }, [oppId])

  return stages
}

// ── Applicants subcollection ──────────────────────────────────────────────────

export function useApplicants(oppId) {
  const [applicants, setApplicants] = useState([])

  useEffect(() => {
    if (!oppId) return
    const unsub = onSnapshot(
      collection(db, 'opportunities', oppId, 'applicants'),
      snap => setApplicants(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      err => console.error('applicants error', err)
    )
    return () => unsub()
  }, [oppId])

  return applicants
}

// ── Write helpers ─────────────────────────────────────────────────────────────

function sanitizeOpportunityFields(data) {
  const isCampusEngagement = String(data.type || '').trim() === 'Campus Engagement'
  const clean = { ...data }
  // via is meaningless for Campus Engagement
  if (isCampusEngagement) clean.via = ''
  // subtype is meaningless for Hiring / Live Project
  if (!isCampusEngagement) clean.subtype = ''
  // never persist the internal whatsapp draft key
  delete clean._whatsappMessage
  return clean
}

export async function postOpportunity(data, user) {
  const opp = {
    ...blankOpportunity(),
    ...sanitizeOpportunityFields(data),
    postedBy: { uid: user.uid, name: user.displayName, email: user.email },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }
  const ref = await addDoc(collection(db, 'opportunities'), opp)
  // Record the first stage
  await addDoc(collection(db, 'opportunities', ref.id, 'stages'), {
    type: 'opportunity',
    message: data._whatsappMessage || '',
    createdAt: serverTimestamp(),
    createdBy: { uid: user.uid, name: user.displayName },
  })
  return ref.id
}

export async function advanceStage(oppId, stageType, stageData, user) {
  const statusMap = {
    shortlist:  'shortlisted',
    interview:  'interviewing',
    selected:   'closed',
  }
  await addDoc(collection(db, 'opportunities', oppId, 'stages'), {
    type: stageType,
    ...stageData,
    createdAt: serverTimestamp(),
    createdBy: { uid: user.uid, name: user.displayName },
  })
  if (statusMap[stageType]) {
    await updateDoc(doc(db, 'opportunities', oppId), {
      status: statusMap[stageType],
      updatedAt: serverTimestamp(),
    })
  }
}

export async function deleteOpportunity(oppId) {
  await deleteDoc(doc(db, 'opportunities', oppId))
}
