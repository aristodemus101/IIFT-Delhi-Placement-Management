import { STAGE_TYPES } from './useOpportunities'
import {
  CAMPUS_ENGAGEMENT_SUBTYPE_OPTIONS,
  normalizeActivityType,
  normalizeCampusEngagementSubtype,
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
  const normalizedOpp = {
    ...opp,
    type: normalizeActivityType(opp?.type, opp?.via),
    subtype: normalizeCampusEngagementSubtype(opp?.subtype),
  }
  const suggestedCompany = String(normalizedOpp?.organization || normalizedOpp?.title || '').trim()
  const promptPayload = {
    ...normalizedOpp,
    ...extra,
    type: normalizedOpp.type,
    subtype: normalizedOpp.subtype,
    via: normalizedOpp.via || '',
  }
  const prompt = `
You are the Placement Committee of IIFT Delhi drafting an official WhatsApp bulletin. Every message must read exactly as the Placement Committee wrote it — never as AI. Follow the rules below with ZERO deviation.

=== 1. STANDARD BULLETIN STRUCTURE ===
*Purpose | Company Name*

Dear Batch,

[A brief introduction explaining the announcement and the action required.]

*Key Details:*
- Role / opportunity / eligibility
- Application link / EOI link
- Tracker / WhatsApp group / JD
- Other relevant process instructions

*Deadline: [Time] | [Date]*

[Important instructions or consequences, if applicable.]

All CRCAD Rules Apply

=== 2. HEADING RULE (ABSOLUTE) ===
- The first line is ALWAYS the heading, wrapped in single asterisks: *Purpose | Company Name*
- Order is ALWAYS Purpose FIRST, Company Name SECOND. Never the reverse.
- The Purpose must accurately describe the message (e.g. SIP Shortlist, Pre-Placement Talk, Application Form, PPI Shortlist, Mandatory Submission, Reminder, Guest Lecture, Live Project).
- For a general mandatory submission with no relevant company, the Company Name may be omitted (e.g. *Mandatory Submission | SIP Detail Form* — use the form/subject name in place of a company, or just the purpose).
- Heading examples (note: single pipe |):
  *SIP Shortlist | Flipkart*
  *Pre-Placement Talk | PwC AC India*
  *Application Form | IndiaMART*
  *PPI Shortlist | BNY*
  *Mandatory Submission | SIP Detail Form*
${suggestedCompany ? `- The company / subject for THIS message is: "${suggestedCompany}". Choose the Purpose yourself to fit the stage and content.` : ''}

=== 3. FORMATTING CONVENTIONS ===
- Heading: *Purpose | Company Name*
- Salutation: Dear Batch,
- Emphasis: single asterisks for WhatsApp bold (*like this*). Never use ** double asterisks or markdown headings.
- Deadline line: *Deadline: 9:00 PM | 15th October 2026* (bold, full). Add "(Strict)" only if the input says it is strict.
- Links: full, directly accessible URLs on their own line, under a bold label (e.g. *Application Link:* then the URL on the next line).
- Candidate lists: one name per line.
- Candidate details: table format ONLY when explicitly requested.
- Instructions: concise bullet points or numbered steps.
- Closing: the last line is exactly "All CRCAD Rules Apply" (no asterisks needed, nothing after it).

=== 4. TONE AND LANGUAGE ===
- Professional and concise. No unnecessary introductions or lengthy explanations.
- Natural and human. Avoid generic, AI-sounding phrases and corporate jargon.
- Firm when necessary: mandatory submissions, deadlines, and consequences must be explicit.
- Warm when appropriate (recruiter-facing content stays courteous).
- Action-oriented: students must immediately understand what to do and by when.

=== 5. FLOW BY BULLETIN TYPE ===
A. Company opportunities:
   Heading -> opportunity overview -> role and eligibility -> compensation (if provided) -> application links -> tracker -> deadline -> relevant instructions -> closing.
B. Shortlists and PPIs:
   Heading -> shortlisted candidates (one name per line, or tracker link) -> WhatsApp group link -> joining deadline -> instruction to join.
C. Pre-placement talks and sessions:
   Heading -> purpose of the session -> date and time -> mode (online/offline) -> meeting link or venue -> dress code -> attendance and conduct guidelines. If the session is already live, write "The session is currently live." and do not announce it as upcoming.
D. Mandatory submissions and reminders:
   Heading -> mandatory requirement -> form link -> deadline -> consequences of non-compliance -> closing. Reminders should be firmer, not more verbose.
E. Confidentiality and compliance:
   Heading -> permitted use -> explicit restrictions -> monitoring/consequences (where applicable) -> closing.

=== 6. HARD RULES (NEVER BREAK) ===
1. Heading order is ALWAYS Purpose | Company Name.
2. Preserve names, links, dates, deadlines, compensation figures, and eligibility criteria EXACTLY as supplied. Do not reformat or round numbers.
3. Never invent missing details or add unconfirmed requirements. Only use fields present and non-null in the input.
4. Keep links clearly labelled and directly accessible.
5. No repeated information and no unnecessary sections.
6. If the input specifies an edit instruction (e.g. "only names", "remove this", "keep the rest as is"), change ONLY what is specified.
7. Distinguish application deadlines, tracker deadlines, group-joining deadlines, and interview dates — never merge them.
8. Use tables only when useful or explicitly requested.
9. No emojis. Minimal decorative formatting.
10. End every standard placement bulletin with exactly: All CRCAD Rules Apply (unless the input explicitly instructs otherwise).

=== 7. BANNED ===
- "We are delighted...", "We are pleased...", "Hope everyone is doing well...", and any enthusiastic or AI-style filler.
- Raw field-name labels like "Description:", "Type:", "Subtype:".
- Copying recruiter emails verbatim — extract only the actionable information.
- Double asterisks ** or markdown headings (#). WhatsApp bold is single asterisks only.

=== NOW WRITE ===
Write the bulletin for stage: "${stageLabel}".

Opportunity details (use only fields that are present and non-null):
${JSON.stringify(promptPayload, null, 2)}

${extra.whatsappGroupLink ? `WhatsApp Group:\n${extra.whatsappGroupLink}` : ''}
${extra.selectedStudents ? `Selected students (one name per line):\n${extra.selectedStudents}` : ''}

Return ONLY the message text — no explanation, no markdown code block, no preamble.
`
  return callGemini(prompt)
}

/**
 * Auto-map company column headers to raw student doc column strings.
 * rawTargetCols: string[] — actual column names from getCohortColumns()
 */
export async function geminiAutoMap(companyCols, rawTargetCols) {
  const prompt = `You are mapping company CSV column headers to actual student database columns for IIFT Delhi MBA placements.

COMPANY COLUMNS (what the company sent — map each of these):
${companyCols.map((c, i) => `${i}: ${c}`).join('\n')}

OUR ACTUAL DATABASE COLUMNS (exact strings stored in Firestore — these are the valid target values):
${rawTargetCols.map((c, i) => `${i}: ${c}`).join('\n')}

Rules:
- Match each company column to the single best database column string, or null if no reasonable match.
- Use fuzzy matching: "Student Name" → "Full Name", "CAT %" → "CAT Percentile", "Work Ex" → "Total Work Experience (Months)" etc.
- The ourKey value MUST be one of the exact strings from "OUR ACTUAL DATABASE COLUMNS" above. Do not invent new values.
- If a company column matches nothing in our database, set ourKey to null.
- Never map two company columns to the same database column.
- "Name" / "Student Name" / "Candidate" → the Full Name column
- "CAT" / "CAT %" / "Percentile" → the CAT Percentile column
- "Work Experience" / "WE" / "Work Ex" / "Work Ex (months)" → the work experience months column
- "10th" / "X Marks" / "SSC" / "Matric" / "Class X" → the Class X / 10th score column
- "12th" / "XII" / "HSC" / "Intermediate" / "Class XII" → the Class XII / 12th score column
- "Graduation" / "UG %" / "CGPA" / "GPA" → the UG/graduation score column
- "Gender" / "Sex" → the Gender column
- "DOB" / "Birth Date" / "Date of Birth" → the Date of Birth column
- "Category" / "Caste" / "Reservation" → the Category column
- "Email" (personal) → the personal email column; "Official Email" → the official/institute email column
- "Mobile" / "Phone" / "Contact" / "WhatsApp" → the mobile number column

Return ONLY a JSON array, one entry per company column, same order:
[
  { "companyCol": "Student Name", "ourKey": "Full Name", "confidence": "high" },
  { "companyCol": "Unknown Col", "ourKey": null, "confidence": "low" },
  ...
]
confidence: "high" | "medium" | "low"
`
  const json = await callGemini(prompt)
  const parsed = JSON.parse(json)
  // Validate: ourKey must be one of the rawTargetCols or null
  const validSet = new Set(rawTargetCols)
  return parsed.map(item => {
    const key = (item.ourKey && validSet.has(item.ourKey)) ? item.ourKey : null
    return {
      companyCol: item.companyCol,
      ourKey: key,
      auto: !!key,
      confidence: item.confidence || 'medium',
    }
  })
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
