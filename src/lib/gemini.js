import { STAGE_TYPES } from './useOpportunities'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`

async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
}

function normalizeType(type) {
  if (type === 'SIP Hiring') return 'Hiring'
  return type || 'Hiring'
}

function getAnnouncementSubject(opp, preferCombined = false) {
  const org = String(opp?.organization || '').trim()
  const title = String(opp?.title || '').trim()
  if (preferCombined && org && title) {
    const titleHasOrg = title.toLowerCase().includes(org.toLowerCase())
    if (!titleHasOrg) return `${org} / ${title}`
  }
  return org || title || 'Opportunity'
}

function getAnnouncementHeader(opp) {
  const via = String(opp?.via || '').trim()
  const type = normalizeType(opp?.type)
  const ap = String(opp?.applicability || 'both').toLowerCase()

  if (via === 'Case Comp') {
    return `Case Comp | ${getAnnouncementSubject(opp, true)}`
  }

  const subject = getAnnouncementSubject(opp, false)

  if (type === 'Hiring') {
    if (ap === 'summer') return `SIP Opportunity | ${subject}`
    if (ap === 'final') return `Final Opportunity | ${subject}`
    return `Placement Opportunity | ${subject}`
  }

  if (type === 'Live Project') return `Live Project | ${subject}`
  if (type === 'Event') return `Event | ${subject}`
  return `Opportunity | ${subject}`
}

function forceFirstLine(message, header) {
  if (!header) return message
  const lines = String(message || '').split('\n')
  const firstTextIndex = lines.findIndex(line => line.trim().length > 0)
  if (firstTextIndex === -1) return `*${header}*`
  lines[firstTextIndex] = `*${header}*`
  return lines.join('\n')
}

export async function parseOpportunity(rawText) {
  const prompt = `
You are a placement cell data extractor for IIFT Delhi MBA program.
Extract structured data from the opportunity text and return ONLY valid JSON with EXACTLY these keys.
Use null for any field not mentioned. Do not add extra keys.

{
  "title": "short title string",
  "type": "one of: Hiring | Live Project | Event",
  "via": "one of: Case Comp | PPO | Hackathon | Referral | Direct | null",
  "organization": "company or organiser name",
  "applicability": "one of: summer | final | both",
  "roles": ["array of role strings, empty array if none"],
  "stipend": "stipend string e.g. ₹20,000–30,000/month, or null",
  "ctc": "CTC string e.g. 18 LPA, or null",
  "duration": "e.g. 2 months, or null",
  "location": "location string or null",
  "deadline": "deadline as stated in text, or null",
  "eligibility": "eligibility string or null — e.g. Mandatory for all YTP students",
  "eoi_link": "Google Form URL if present, else null",
  "apply_link": "direct application URL if present (different from EOI form), else null",
  "tracker_link": "Google Sheets tracker URL if present, else null",
  "description": "1-2 sentence summary of the opportunity, max 280 chars"
}

If it is a case competition, keep "type" as "Hiring" and set "via" to "Case Comp".

Text:
${rawText}
`
  const json = await callGemini(prompt)
  return JSON.parse(json)
}

export async function generateWhatsAppMessage(opp, stageType, extra = {}) {
  const stageLabel = STAGE_TYPES[stageType]
  const isAnnouncement = stageType === 'opportunity' || stageType === 'generate_announcement'
  const forcedHeader = isAnnouncement ? getAnnouncementHeader(opp) : ''
  const prompt = `
You are drafting a WhatsApp announcement for IIFT Delhi placement committee.
Match the tone and format of these real examples:

Example 1 (opportunity):
*Altius Investech || SIP Application*
Dear Batch,
Altius Investech has opened its applications for summer internship.
*Roles on Offer:*
1. Research Analyst Intern
2. B2B Channel Growth Manager Intern
*Stipend:* 20,000 - 30,000 per month
*Location:* Kolkata
*Duration:* 2 months
*EOI:* https://forms.gle/...
*Deadline:* 9:30 PM, 7th January
*All CRCAD Rules Apply*

Example 2 (shortlist):
*Royal Brothers || Shortlist*
Dear Batch,
PFA the shortlist for Royal Brothers. Please join the WhatsApp group and mark the tracker:
*Tracker*: https://...
*Process Group*: https://...
*Deadline:* 9:00 AM, 21 February 2026
*All CRCAD Rules Apply*

Now write a WhatsApp message for stage: "${stageLabel}"

Opportunity details (use only what's relevant and non-null):
${JSON.stringify({ ...opp, ...extra }, null, 2)}

${extra.whatsappGroupLink ? `WhatsApp group link: ${extra.whatsappGroupLink}` : ''}
${extra.selectedStudents ? `Selected students:\n${extra.selectedStudents}` : ''}

${forcedHeader ? `First line must be exactly: *${forcedHeader}*` : ''}

Rules:
- Use *bold* for headers
- Keep it concise
- End with *All CRCAD Rules Apply*
- Return ONLY the message text, no explanation, no markdown code block
`
  const message = await callGemini(prompt)
  return forcedHeader ? forceFirstLine(message, forcedHeader) : message
}

export async function parseShortlist(rawText, students) {
  const lookup = students.map(s => ({
    roll: s['Roll No.'] || s.roll || '',
    name: [s['First Name'], s['Last Name']].filter(Boolean).join(' ') || s['Full Name'] || '',
    email: s['Official Email ID (d27/ba27)'] || s.official_email || '',
  })).filter(s => s.roll || s.name)

  const prompt = `
You are matching a shortlist text to a student database for IIFT Delhi placement committee.
Student names in announcements follow the pattern "FirstName LastName - RollNo - Programme - Year" e.g. "Vaibhav Verma - 46A - BA - 27".

Student database (roll, name, email):
${JSON.stringify(lookup.slice(0, 300))}

Shortlist text:
${rawText}

Return ONLY valid JSON array of matched students. For each matched student include:
{
  "roll": "roll number from DB",
  "name": "full name from DB",
  "email": "official email from DB",
  "role": "role they are shortlisted for, or null"
}

Only include students you can confidently match. If a name appears in the text but you cannot match to DB, skip them.
`
  const json = await callGemini(prompt)
  return JSON.parse(json)
}
