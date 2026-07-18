// ─────────────────────────────────────────────────────────────────────────────
// OPPORTUNITY ACTIONS CONFIG
// ─────────────────────────────────────────────────────────────────────────────
//
// This file controls which action buttons appear on each opportunity type
// inside the "View & Manage" panel on the Activity page.
//
// HOW TO EDIT
// ───────────
// Each opportunity type has an `actions` array. The order of items in the
// array is the order they appear on screen.
//
// To ADD an action:    push a new entry (see ALL_ACTIONS below for valid keys)
// To REMOVE an action: delete the line or comment it out with //
// To REORDER:          move lines up or down
// To ADD a new type:   copy an existing block and change the key
//
// AVAILABLE ACTION KEYS  (copy-paste from here)
// ────────────────────────────────────────────────
//   generate_announcement      — initial WhatsApp blast
//   create_eoi_tracker         — new sheet tab: Roll | Name | Email | Filled EOI (Yes/No)
//   release_shortlist          — paste names → Gemini matches → saves to student records
//   create_shortlist_tracker   — new sheet tab: Roll | Name | Email | Joined Group (Yes/No)
//   generate_shortlist_msg     — WhatsApp message with shortlist + WA group link
//   post_interview             — paste interview list → match students → save
//   create_interview_tracker   — new sheet tab: Roll | Name | Email | Attended Interview (Yes/No)
//   generate_interview_msg     — WhatsApp message for interview round
//   post_final_selection       — paste final names → match → triggers placement approval
//   create_final_tracker       — new sheet tab: Roll | Name | Email | Offer Accepted (Yes/No)
//   generate_final_msg         — WhatsApp message for final selection
//   generate_reminder          — deadline / attendance reminder message
//   post_submission            — Case Comp: record team/individual submissions
//   create_attendance_tracker  — Campus Engagement: Roll | Name | Email | Attended (Yes/No)
//   generate_event_msg         — Campus Engagement: reminder with venue, time, dress code
//   mark_closed                — closes the opportunity, no further actions
//
// ─────────────────────────────────────────────────────────────────────────────

export const OPPORTUNITY_ACTIONS = {

  'Hiring': {
    label: 'Hiring',
    actions: [
      'generate_announcement',
      'post_ppt',                   // record PPT details (date, mode, attendance)
      'open_applications',          // mark applications as open
      'create_eoi_tracker',
      'release_shortlist',
      'create_shortlist_tracker',
      'generate_shortlist_msg',
      'post_gd_pi',                 // GD / PI round with student matching
      'create_interview_tracker',
      'generate_interview_msg',
      'post_final_selection',       // triggers placement approval flow for Final batch
      'create_final_tracker',
      'generate_final_msg',
      'generate_reminder',
      'mark_closed',
    ],
  },

  'Case Comp': {
    label: 'Case Competition',
    actions: [
      'generate_announcement',
      'create_eoi_tracker',
      'generate_reminder',
      'post_round',              // add a new round (Problem Statement, Round 1, Finals…)
      'create_round_tracker',    // tracker sheet for the current round
      'post_final_selection',    // final winners → triggers placement approval
      'generate_final_msg',
      'mark_closed',
    ],
  },

  'Live Project': {
    label: 'Live Project',
    actions: [
      'generate_announcement',
      'create_eoi_tracker',
      'release_shortlist',
      'create_shortlist_tracker',
      'generate_shortlist_msg',
      'post_final_selection',
      'create_final_tracker',
      'generate_final_msg',
      'generate_reminder',
      'mark_closed',
    ],
  },

  'Campus Engagement': {
    label: 'Campus Engagement',
    actions: [
      'generate_event_msg',
      'generate_reminder',
      'create_attendance_tracker',
      'mark_closed',
    ],
  },

}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION METADATA  — labels, descriptions, tracker config
// Edit display names and descriptions here. Do not change the keys.
// ─────────────────────────────────────────────────────────────────────────────

export const ACTION_META = {
  post_ppt: {
    label:       'Record PPT',
    description: 'Log the Pre-Placement Talk — date, mode (Online/Offline/Hybrid), and attendance count',
    icon:        'Presentation',
    color:       'blue',
  },
  open_applications: {
    label:       'Open Applications',
    description: 'Mark applications as open and record the deadline',
    icon:        'FileText',
    color:       'green',
  },
  post_gd_pi: {
    label:       'Post GD / PI Round',
    description: 'Paste list of students called for GD/PI → Gemini matches to DB',
    icon:        'Users',
    color:       'amber',
  },
  generate_announcement: {
    label:       'Generate Announcement',
    description: 'WhatsApp-ready opening blast for this opportunity',
    icon:        'MessageSquare',
    color:       'blue',
  },
  create_eoi_tracker: {
    label:       'Create EOI Tracker',
    description: 'Google Sheet: Roll | Name | Email | Filled EOI (Yes/No)',
    icon:        'Sheet',
    color:       'green',
    tracker:     { sheetTitle: 'EOI', colHeader: 'Filled EOI' },
  },
  release_shortlist: {
    label:       'Release Shortlist',
    description: 'Paste shortlist text → Gemini matches to student DB',
    icon:        'Users',
    color:       'amber',
  },
  create_shortlist_tracker: {
    label:       'Create Shortlist Tracker',
    description: 'Google Sheet: Roll | Name | Email | Joined Group (Yes/No)',
    icon:        'Sheet',
    color:       'green',
    tracker:     { sheetTitle: 'Shortlist', colHeader: 'Joined Group' },
  },
  generate_shortlist_msg: {
    label:       'Generate Shortlist Message',
    description: 'WhatsApp message with shortlist, tracker link, WA group link',
    icon:        'MessageSquare',
    color:       'blue',
  },
  post_interview: {
    label:       'Post Interview Round',
    description: 'Paste interview list → match students → save to records',
    icon:        'Users',
    color:       'amber',
  },
  create_interview_tracker: {
    label:       'Create Interview Tracker',
    description: 'Google Sheet: Roll | Name | Email | Attended Interview (Yes/No)',
    icon:        'Sheet',
    color:       'green',
    tracker:     { sheetTitle: 'Interview', colHeader: 'Attended Interview' },
  },
  generate_interview_msg: {
    label:       'Generate Interview Message',
    description: 'WhatsApp message for the interview round',
    icon:        'MessageSquare',
    color:       'blue',
  },
  post_final_selection: {
    label:       'Post Final Selection',
    description: 'Paste final names → match → triggers placement approval (Final batch)',
    icon:        'Award',
    color:       'purple',
  },
  create_final_tracker: {
    label:       'Create Final Tracker',
    description: 'Google Sheet: Roll | Name | Email | Offer Accepted (Yes/No)',
    icon:        'Sheet',
    color:       'green',
    tracker:     { sheetTitle: 'Final', colHeader: 'Offer Accepted' },
  },
  generate_final_msg: {
    label:       'Generate Final Selection Message',
    description: 'WhatsApp message announcing final selections',
    icon:        'MessageSquare',
    color:       'blue',
  },
  generate_reminder: {
    label:       'Generate Reminder',
    description: 'Deadline or attendance reminder message',
    icon:        'Bell',
    color:       'amber',
  },
  post_round: {
    label:       'Post Round',
    description: 'Add a new case comp round (Problem Statement, Round 1, Finals…) and record who advanced',
    icon:        'Trophy',
    color:       'purple',
  },
  create_round_tracker: {
    label:       'Create Round Tracker',
    description: 'Google Sheet tab for the current round: Roll | Name | Email | Advanced (Yes/No)',
    icon:        'Sheet',
    color:       'green',
    tracker:     { sheetTitle: 'Round', colHeader: 'Advanced to Next Round' },
  },
  post_submission: {
    label:       'Post Submission Round',
    description: 'Case Comp: record team or individual submissions',
    icon:        'FileText',
    color:       'purple',
  },
  create_attendance_tracker: {
    label:       'Create Attendance Tracker',
    description: 'Google Sheet: Roll | Name | Email | Attended (Yes/No)',
    icon:        'Sheet',
    color:       'green',
    tracker:     { sheetTitle: 'Engagement', colHeader: 'Attended' },
  },
  generate_event_msg: {
    label:       'Generate Engagement Message',
    description: 'WhatsApp message with venue, time, dress code, etc.',
    icon:        'MessageSquare',
    color:       'blue',
  },
  mark_closed: {
    label:       'Mark as Closed',
    description: 'Close this opportunity — no further actions',
    icon:        'XCircle',
    color:       'red',
  },
}
