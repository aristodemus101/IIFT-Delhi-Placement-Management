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
  "type": "one of: Hiring | Case Comp | Live Project | Campus Engagement",
  "subtype": "one of: ${CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS.join(' | ')} | null",
  "via": "one of: PPO | Referral | Direct | null — how students get placed, NOT the opp type",
  "tracks": ["array of track names for Case Comp e.g. Strategy, Finance, Analytics — empty array otherwise"],
  "team_size": "team size string e.g. '2-3 members', or null",
  "prize": "prize or PPI details for Case Comp, or null",
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
  "description": "1-2 sentence summary of the opportunity, max 280 chars",
  "spoc": "committee member name mentioned as POC or SPOC, or null",
  "expected_hires": "integer number of expected hires/offers if mentioned, or null",
  "process_date": "date of the recruitment process/interview day in YYYY-MM-DD format, or null",
  "process_mode": "one of: Online | Offline | Hybrid | null — based on whether the process is in-person or virtual"
}

Rules:
- If it is a case competition, challenge, hackathon, or campus competition, set "type" to "Case Comp". Do NOT set via to "Case Comp".
- "via" is ONLY for how a student gets placed: PPO, Referral, or Direct. Leave null if unknown.
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
    type: normalizeActivityType(opp?.type, opp?.via),
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

export async function geminiAutoMap(companyCols, ourCols) {
  const colList = ourCols.map(c => `${c.key}: ${c.label}`).join('\n')
  const prompt = `You are mapping company CSV column headers to a canonical student database schema for IIFT Delhi MBA placements.

COMPANY COLUMNS (what the company sent):
${companyCols.map((c, i) => `${i}: ${c}`).join('\n')}

OUR CANONICAL COLUMNS (key: label):
${colList}

Rules:
- Match each company column to the single best canonical key, or null if no reasonable match.
- "Student Name" / "Name" / "Candidate" → name
- "CAT" / "CAT %" / "CAT Percentile" / "Percentile" → cat
- "10th" / "X Marks" / "SSC" / "Matric" → x10pct
- "12th" / "XII Marks" / "HSC" / "Intermediate" / "Senior Secondary" → x12pct
- "Graduation" / "UG %" / "CGPA" / "GPA" / "Aggregate" → ugpct
- "Work Experience" / "WE" / "Work Ex" / "Experience (months)" → wx
- "Category" / "Caste" → category
- "Gender" / "Sex" → gender
- "Email" → email; "Official Email" → official_email
- "Mobile" / "Phone" / "Contact" → mobile
- "State" / "Domicile" → state
- "DOB" / "Birth Date" → dob
- "Section" / "Division" → roll (closest proxy; note in confidence)
- Company columns about SIP/Summer internship → sip_company, sip_role, sip_stipend, sip_sector, sip_location, sip_date, sip_status
- If a column is about a previous employer/company → c1_name, c2_name, c3_name
- If ambiguous, pick the most specific match.
- Never map two company columns to the same canonical key (pick the best fit for each, null the rest).

Return ONLY a JSON array with one entry per company column, in the same order:
[
  { "companyCol": "Student Name", "ourKey": "name", "confidence": "high" },
  { "companyCol": "CAT Percentile", "ourKey": "cat", "confidence": "high" },
  ...
]
confidence: "high" | "medium" | "low"
`
  const json = await callGemini(prompt)
  const parsed = JSON.parse(json)
  return parsed.map(item => ({
    companyCol: item.companyCol,
    ourKey: item.ourKey || null,
    auto: !!item.ourKey,
    confidence: item.confidence || 'medium',
  }))
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
