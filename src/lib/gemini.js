import { STAGE_TYPES } from './useOpportunities'
import {
  CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS,
  normalizeActivityType,
  normalizeCampusEngagementSubtype,
  getActivityAnnouncementHeader,
} from '../config/activityTaxonomy'

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_KEY}`

async function callGemini(prompt) {
  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 2048 },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)
  const data = await res.json()
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
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
  "type": "one of: Hiring | Live Project | Campus Engagement",
  "subtype": "one of: ${CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS.join(' | ')} | null",
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

Rules:
- If it is a case competition, keep "type" as "Hiring" and set "via" to "Case Comp".
- If it is a guest lecture, workshop, webinar, alumni session, company visit, panel discussion, seminar, conference, networking session, or similar, set "type" to "Campus Engagement" and fill "subtype".
- Use "Campus Engagement" whenever the text is about a non-hiring campus event.
- Prefer the exact subtype labels shown above.

Text:
${rawText}
`
  const json = await callGemini(prompt)
  return JSON.parse(json)
}

export async function generateWhatsAppMessage(opp, stageType, extra = {}) {
  const stageLabel = STAGE_TYPES[stageType]
  const isAnnouncement = stageType === 'opportunity' || stageType === 'generate_announcement'
  const normalizedOpp = {
    ...opp,
    type: normalizeActivityType(opp?.type),
    subtype: normalizeCampusEngagementSubtype(opp?.subtype),
  }
  const forcedHeader = isAnnouncement ? getActivityAnnouncementHeader(normalizedOpp) : ''
  const messageStyle = normalizedOpp.type === 'Campus Engagement'
    ? `
Campus engagement message style:
- Use a clean announcement with one line describing the engagement type first.
- Include the speaker/organization if present.
- Include venue, time, date, and registration or tracker links if present.
- Keep the same section order every time: header, greeting, engagement summary, details, action required, closing line.
`
    : `
Opportunity message style:
- Use a clean announcement with the same section order every time: header, greeting, summary, roles, compensation, location, duration, links, deadline, closing line.
- Keep the wording concise and professional.
`
  const promptPayload = {
    ...normalizedOpp,
    ...extra,
    type: normalizedOpp.type,
    subtype: normalizedOpp.subtype,
    via: normalizedOpp.via || '',
  }
  const prompt = `
You are drafting a WhatsApp announcement for IIFT Delhi placement committee.
Follow these formatting rules exactly and do not deviate:

STRUCTURE (in this exact order, every time):
1. Header line (bold, forced if provided)
2. Blank line
3. "Dear Batch,"
4. Blank line
5. The description / body of the announcement — written directly, NO label like "Description:" or "Type:" before it
6. Key details (roles, compensation, location, duration, links, deadline — each on its own line, bold label)
7. "*Mandatory for everyone.*"
8. Action required (if any)
9. "*All CRCAD Rules Apply*"

TONE:
- Stern and directive. No soft language. Use imperative sentences.
- Do not use words like "exciting", "pleased", "delighted", "opportunity to grow".
- Do not write "Description:", "Type:", "Subtype:", or any raw field name as a label.

Now write a WhatsApp message for stage: "${stageLabel}"

Opportunity details (use only what's relevant and non-null):
${JSON.stringify(promptPayload, null, 2)}

${extra.whatsappGroupLink ? `WhatsApp group link: ${extra.whatsappGroupLink}` : ''}
${extra.selectedStudents ? `Selected students:\n${extra.selectedStudents}` : ''}

${forcedHeader ? `First line must be exactly: *${forcedHeader}*` : ''}
${messageStyle}

Additional rules:
- Use *bold* for section labels and the header only
- Return ONLY the message text — no explanation, no markdown code block, no preamble
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
