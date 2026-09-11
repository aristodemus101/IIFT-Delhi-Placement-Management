/**
 * INSERT-ONLY script — adds ALL missing opportunities to production.
 * Does NOT delete anything. Safe to run against production.
 *
 * Current production state: 14 IB-only entries (from cleanup_and_reseed.mjs).
 * This script adds everything else: the ~28 PC-bulletin entries that were wiped,
 * plus additional PC-bulletin entries never seeded before.
 *
 * Run: node scripts/insert_missing_opps.mjs [--production]
 *
 * Already in production (14 IB-only, do NOT re-add):
 *   Morgan Stanley | IBD GC Summer Internship
 *   Morgan Stanley | Pre-Placement Talk
 *   Godrej Properties | Guest Lecture
 *   Godrej Properties | Sales & Marketing / P&L Summer Internship
 *   Godrej Properties | Space Program Case Competition
 *   Godrej Consumer Products | Guest Lecture
 *   Godrej Consumer Products | Craft Lab Summer Internship
 *   PepsiCo | Leadership Session
 *   Deloitte USI | Pre-Placement Talk
 *   Deloitte USI | Summer Internship
 *   Titan & CaratLane | Summer Internship
 *   Snabbit | Summer Internship
 *   Tata Administrative Services | TAS Summer Internship
 *   Marico | Over the Wall Season 14
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const isProd = process.argv.includes('--production')
const PROJECT_ID = isProd ? 'placement-management-6133f' : 'placement-mgmt-staging'
console.log(`\nTarget: ${isProd ? '🔴 PRODUCTION' : '🟡 STAGING'} (${PROJECT_ID})\n`)

initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

const POSTED_BY = {
  uid:   'divyaanshmehta513@gmail.com',
  name:  'Divyaansh Mehta',
  email: 'divyaanshmehta513@gmail.com',
}

function opp({
  title, type = 'Hiring', subtype = '', via = '', organization,
  applicability = 'summer', roles = [], stipend = '', ctc = '', duration = '',
  location = '', deadline = '', eligibility = '', eoi_link = '', apply_link = '',
  tracker_link = '', description = '', notes = '', expected_hires = null,
  process_date = '', process_mode = '', tracks = [], prize = '', team_size = '',
  spoc = '', status = 'open',
}) {
  return {
    title, type, subtype, via, organization, applicability,
    roles, stipend, ctc, duration, location, deadline, eligibility,
    eoi_link, apply_link, tracker_link, description, notes,
    expected_hires, process_date, process_mode, tracks, prize, team_size, spoc,
    status, currentRound: 0,
    postedBy: POSTED_BY,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }
}

const OPPS_TO_INSERT = [

  // ════════════════════════════════════════════════════════════
  // PC BULLETIN — Hiring (SIP applications)
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'Dr. Reddy\'s | Destination 3.0 Summer Internship',
    organization: 'Dr. Reddy\'s',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    apply_link:   'https://gradpartners.in/festival/destination-dr-reddys-2026',
    description:  'Dr. Reddy\'s Destination 3.0 — all summer interns recruited through this program. Engage on LinkedIn with #iiftdelhi.',
    notes:        'LinkedIn: https://www.linkedin.com/feed/update/urn:li:activity:7485610769040961536',
    status:       'open',
  }),

  opp({
    title:        'Accenture Strategy | Summer Internship',
    organization: 'Accenture',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Strategy', 'Consulting'],
    apply_link:   'https://indiacampus.accenture.com/register/accenture/bsclnew/apply/?event=1467319',
    eoi_link:     'https://forms.gle/ehdK9zkiz2ekUP1z8',
    tracker_link: 'https://docs.google.com/spreadsheets/d/18JtuTGtmVIHnOFZT0PIczfO7WV7PuOdSHhI947oGQRo/edit?usp=sharing',
    description:  'Accenture Strategy & Consulting SIP application. Detailed form — do not wait until last minute. Use personal email ID.',
    notes:        'Mandatory for all yet-to-be-placed.',
    status:       'open',
  }),

  opp({
    title:        'JP Morgan Chase | Summer Internship',
    organization: 'JP Morgan Chase',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['CIB R&A – Banking', 'PB Credit Risk', 'IB Credit Risk', 'AWM Risk Analytics'],
    tracker_link: 'https://docs.google.com/spreadsheets/d/1xXb17MOliyKBhx3SFvSutoVoxJ3VFzrpkS1VtCP7nxM/edit?gid=0#gid=0',
    deadline:     '2026-07-26',
    description:  'JP Morgan Chase SIP — 4 roles: CIB R&A Banking, PB Credit Risk, IB Credit Risk, AWM Risk Analytics. Mandatory to fill all 4 application forms using personal Gmail.',
    status:       'open',
  }),

  opp({
    title:        'Goldman Sachs | Summer Internship',
    organization: 'Goldman Sachs',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Operational Risk', 'Credit Risk'],
    apply_link:   'https://hdpc.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CampusHiring/job/170814/?utm_medium=jobshare&utm_source=External+Job+Share',
    eoi_link:     'https://forms.gle/GEiHSMqjzh2urkj56',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1pmn-BhoOhFPD9UY-WINifFRgr7A5RdxmdhRJU63Pu24/edit?gid=0#gid=0',
    deadline:     '2026-07-29',
    description:  'Goldman Sachs Summer Internship — Operational Risk and Credit Risk divisions. Apply using personal email ID. Do NOT withdraw applications once submitted.',
    status:       'open',
  }),

  opp({
    title:        'D.E. Shaw | Summer Internship',
    organization: 'D.E. Shaw',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    eoi_link:     'https://forms.gle/sUbWxancvmkTEno3A',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1hsz24KmUgl37u9skRk2jzq5vdwNrlmFFQi2-nI2YeBY/edit?gid=0#gid=0',
    deadline:     '2026-07-30',
    description:  'D.E. Shaw SIP application. Online test scheduled 2 Aug 2026, 8 PM. Register via email link after applying.',
    notes:        'Mandatory for everyone.',
    status:       'open',
  }),

  opp({
    title:        'Synergy Consulting | Summer Internship',
    organization: 'Synergy Consulting',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    description:  'Synergy Consulting SIP application.',
    status:       'open',
  }),

  opp({
    title:        'Philips | Summer Internship',
    organization: 'Philips',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    description:  'Philips SIP application.',
    status:       'open',
  }),

  opp({
    title:        'iD Fresh Consumer | Insights Fellowship',
    organization: 'iD Fresh Consumer',
    type:         'Live Project',
    applicability:'summer',
    apply_link:   'https://www.linkedin.com/safety/go/?url=https%3A%2F%2Flnkd.in%2Fg7yb8Xsu',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=710320830#gid=710320830',
    deadline:     '2026-07-25',
    description:  'iD Fresh Consumer Insights Fellowship 2026 for first-year MBA students. Apply via LinkedIn link.',
    notes:        'Mandatory to mark tracker after applying.',
    status:       'open',
  }),

  // ════════════════════════════════════════════════════════════
  // PC BULLETIN — Campus Engagements
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'Airtel | iCreate 2026 Campus Launch',
    organization: 'Airtel',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-07-15',
    process_mode: 'Offline',
    location:     'Auditorium',
    description:  'Airtel iCreate 2026 Campus Launch with senior business leaders. Mandatory for all BA, Section D, and selected students from A/B/C. Full formals, 11:15 AM.',
    status:       'closed',
  }),

  opp({
    title:        'Hollister | Guest Lecture',
    organization: 'Hollister',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-07-20',
    process_mode: 'Offline',
    location:     'Auditorium',
    description:  'Hollister guest lecture. Mandatory for all. Smart casuals. 4:15 PM. Focus on healthcare/medical device sector.',
    status:       'closed',
  }),

  opp({
    title:        'JP Morgan Chase | Workshop — Private Banking Credit Risk',
    organization: 'JP Morgan Chase',
    type:         'Campus Engagement',
    subtype:      'Workshop',
    applicability:'both',
    process_date: '2026-07-22',
    process_mode: 'Offline',
    location:     'Auditorium',
    description:  'JPMC workshop on Wealth Management Private Banking Credit Risk. Speakers: Palash Gaunekar (VP), Valeska Faleiro (VP), Kartik (alum B26). Full formals, 3 PM.',
    status:       'closed',
  }),

  opp({
    title:        'JP Morgan Chase | Workshop — Investment Banking Credit Risk',
    organization: 'JP Morgan Chase',
    type:         'Campus Engagement',
    subtype:      'Workshop',
    applicability:'both',
    process_date: '2026-07-23',
    process_mode: 'Offline',
    location:     'Auditorium',
    description:  'JPMC workshop on Investment Banking Credit Risk. Speakers: Lokesh Sanduja (ED), Aditya Aman (VP), Shruti Kamat, Anushka Tiwari. Full formals, 10 AM.',
    status:       'closed',
  }),

  opp({
    title:        'JP Morgan Chase | Pre-Placement Talk',
    organization: 'JP Morgan Chase',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'both',
    process_date: '2026-07-24',
    process_mode: 'Online',
    description:  'JPMC PPT via Zoom. Full formals, cameras on. Zoom ID: 2232420000. Naming: Full name_Roll number_IIFT Delhi.',
    status:       'closed',
  }),

  opp({
    title:        'Goldman Sachs | Pre-Placement Talk',
    organization: 'Goldman Sachs',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-07-28',
    process_mode: 'Online',
    description:  'Goldman Sachs PPT via Zoom. Operational Risk and Credit Risk roles. Full formals, cameras on. Zoom ID: 975 2523 6767, Passcode: 398176.',
    status:       'closed',
  }),

  opp({
    title:        'D.E. Shaw | Pre-Placement Talk',
    organization: 'D.E. Shaw',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-07-30',
    process_mode: 'Online',
    description:  'D.E. Shaw virtual PPT for SIP. Session covers company introduction, culture, internship program, hiring process, Q&A. Mandatory — come prepared with a question. Full formals.',
    notes:        'Meeting link: https://deshaw.webex.com/deshaw/j.php?MTID=mea1e1357c47f27bf5e3b4e38d7827797',
    status:       'closed',
  }),

  opp({
    title:        'Synergy Consulting | Pre-Placement Talk',
    organization: 'Synergy Consulting',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_mode: 'Online',
    description:  'Synergy Consulting PPT for summer internship hiring.',
    status:       'closed',
  }),

  opp({
    title:        'McKinsey & Company | ASCEND Leadership Talk',
    organization: 'McKinsey & Company',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-08-01',
    process_mode: 'Offline',
    location:     'NCH (Academic Block)',
    description:  'McKinsey ASCEND leadership talk by Soumyadeep Ganguly. Selective attendance. Full preparation on consulting case structures, McKinsey sectors expected. Mandatory to submit a question beforehand. Smart casuals, 3:45 PM.',
    status:       'closed',
  }),

  opp({
    title:        'Blinkit | ASCEND Leadership Talk',
    organization: 'Blinkit',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-08-02',
    process_mode: 'Offline',
    location:     'Auditorium',
    description:  'Blinkit ASCEND leadership talk by Sulabh Vij (VP – Foods, Beverages, General Merchandise). Mandatory for Sections A, B, C, D. Read Quick Commerce, e-commerce landscape, Blinkit strategy. Smart casuals, 4:30 PM.',
    status:       'closed',
  }),

  opp({
    title:        'Zee Entertainment | Guest Lecture',
    organization: 'Zee Entertainment',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-07-30',
    process_mode: 'Offline',
    location:     'Auditorium',
    description:  'Guest lecture by Rajiv Bakshi — strategy, media/OTT transformation, sports rights, growth consulting. Sections A, B, C, BA mandatory. Full formals, 4:20 PM.',
    status:       'closed',
  }),

  opp({
    title:        'Intertek | Leadership Connect — Global CEO',
    organization: 'Intertek',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-08-11',
    process_mode: 'Offline',
    description:  'Intertek Global CEO André Lacroix on campus with global leadership + campus hiring team. 100+ countries, Total Quality Assurance. High-stakes global engagement. Full formals. Read "Leadership with Soul" (10 principles). Submit 1 question via form.',
    notes:        'Question form: https://forms.gle/enHpruJCrqgAeJFZ6. Deadline: 7 PM, 2 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Aequitas | Campus CEO Program Launch',
    organization: 'Aequitas',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-07-29',
    process_mode: 'Offline',
    location:     'OCH, 2nd Floor, Admin Block',
    description:  'Aequitas Campus CEO Program launch. Selects 2 first-year students as Campus CEOs. Offers live projects, mentorship, cross-campus networking, investing/financial markets exposure, PPI opportunity. Smart casuals, 10:30 AM.',
    notes:        'Attendance mandatory for shortlisted students. Others attend class.',
    status:       'closed',
  }),

  // ════════════════════════════════════════════════════════════
  // PC BULLETIN — Case Competitions
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'TVS Credit | E.P.I.C 8.0',
    organization: 'TVS Credit',
    type:         'Case Comp',
    applicability:'both',
    tracks:       ['Strategy', 'Finance', 'Analytics', 'IT'],
    eoi_link:     'https://forms.gle/vbeN73ZHEKn1WmjAA',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?usp=sharing',
    deadline:     '2026-07-15',
    description:  'TVS Credit E.P.I.C 8.0 — 4 tracks: Strategy (2-3 members), Finance (1-2 members), Analytics (1-2 members), IT (1-2 members). Gender & academic diversity preferred. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'L\'Oréal | Edge',
    organization: 'L\'Oréal',
    type:         'Case Comp',
    applicability:'summer',
    team_size:    '3 members',
    prize:        'PPI on campus round win',
    apply_link:   'https://unstop.com/o/kqfA1De?lb=zd1TH6pA',
    eoi_link:     'https://docs.google.com/forms/d/e/1FAIpQLSfENB4kxcWCGreRw9z6gm_h8SH1pqTd6uVNrPbFW9BqkQKTvA/viewform?usp=sharing',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=366181462#gid=366181462',
    deadline:     '2026-07-14',
    description:  'L\'Oréal Edge case competition. The ONLY way L\'Oréal recruits summer interns. Campus round winner gets PPI same day. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Axis Bank | MOVES 2026',
    organization: 'Axis Bank',
    type:         'Case Comp',
    applicability:'both',
    apply_link:   'https://insidekampus.com/competition/axis-moves-2026/',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1356006831#gid=1356006831',
    deadline:     '2026-07-24',
    description:  'Axis Bank MOVES 2026 case competition. Multi-round: Simulation (R2), Deck submission (R3), Campus presentation before jury (R4). 45-minute simulation, single sitting.',
    notes:        'R3 shortlist released 1 Aug 2026.',
    status:       'open',
  }),

  opp({
    title:        'Bajaj Finserv | ATOM CEO\'s Challenge Season 9',
    organization: 'Bajaj Finserv',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '4 members',
    apply_link:   'https://gradpartners.in/festival/bajaj-finserv-atom-ceos-challenge-season-9',
    eoi_link:     'https://forms.gle/3XnCfVbnoV6nt9',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1355799655#gid=1355799655',
    deadline:     '2026-07-16',
    description:  'Bajaj Finserv ATOM CEO\'s Challenge Season 9. Teams of 4. Choose 1 of 6 problem statements, submit 4-slide solution via ATOM Microsite. Gender diverse teams required.',
    status:       'open',
  }),

  opp({
    title:        'Accenture | B-School Challenge Season 10',
    organization: 'Accenture',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '4 members',
    prize:        'PPI with Accenture for campus round winner',
    apply_link:   'https://unstop.com/competitions/crp-accenture-b-school-challenge-season-10-accenture-1711811',
    eoi_link:     'https://forms.gle/g3yodqddLj1gZ68T9',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1097555442#gid=1097555442',
    deadline:     '2026-07-14',
    description:  'Accenture B-School Challenge Season 10. Teams of 4 (same year only). Campus round winner gets PPI. Preliminary quiz then deck submission.',
    notes:        'Mandatory for all yet-to-be-placed.',
    status:       'open',
  }),

  opp({
    title:        'Flipkart | WiRED X 10.0',
    organization: 'Flipkart',
    type:         'Case Comp',
    applicability:'summer',
    team_size:    '2 teams per person (SCM + Business mandatory, HR optional)',
    apply_link:   'https://mycareernet.co/events/flipkart-earlycareers-wired-10-0/?cHash=90602199',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1854456131#gid=1854456131',
    deadline:     '2026-07-23',
    description:  'Flipkart WiRED X 10.0 case competition. Campus launch 23 Jul. Mandatory to register for SCM and Business tracks. HR track optional.',
    status:       'open',
  }),

  opp({
    title:        'Flipkart | Vidyarthini 4.0',
    organization: 'Flipkart',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Summer Intern – SCM', 'Management Trainee – SCM'],
    apply_link:   'https://mycareernet.co/events/flipkart-earlycareers-vidyarthini-4-0/',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=530195508#gid=530195508',
    deadline:     '2026-07-19',
    eligibility:  'Female students only. Approved CVs required.',
    description:  'Flipkart Vidyarthini 4.0 — Women in Supply Chain Campus Program. Mentorship, networking, fast-track to summer internships with PPO for Management Trainee SCM roles.',
    notes:        'Exclusive and mandatory for all female students.',
    status:       'open',
  }),

  opp({
    title:        'Saregama | Campfluencer Program',
    organization: 'Saregama',
    type:         'Live Project',
    applicability:'summer',
    apply_link:   'https://forms.office.com/Pages/ResponsePage.aspx?id=oMqE5wiiXUuc2Iuj1kW6_pZ8T6q_57hKlYXzcCFYEOFUOEZUTE1GNkVaQ1pNUks0V1I4TEZVNkwzVi4u',
    eoi_link:     'https://forms.gle/8LJxVqsCGVf2mqX27',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1273281996#gid=1273281996',
    deadline:     '2026-07-19',
    description:  'Saregama Campfluencer Program — represent India\'s most iconic music label (120+ year legacy) on campus. PPI for Summer Internship, mentorship from leadership, live projects, certificate & LOR, artist access, exclusive merchandise.',
    notes:        'Mandatory for all. Microsoft form + EOI must have identical responses.',
    status:       'open',
  }),

  opp({
    title:        'Amazon | ACE Challenge 2026',
    organization: 'Amazon',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '4 members',
    prize:        '₹4,00,000 Prize Pool',
    apply_link:   'https://unstop.com/p/amazon-customer-excellence-ace-challenge-2026-launch-event-amazon-1709457',
    eoi_link:     'https://docs.google.com/forms/d/1fZWBPZCE6wouoTdpmyZEKsPF3cgHEX9wYsaAQL7s6IA/edit',
    tracker_link: 'https://docs.google.com/spreadsheets/d/18sAgU4U50AYklkj4Id7IxydZe5nSBSqzZI3pqPjx22s/edit?usp=sharing',
    deadline:     '2026-07-23',
    description:  'Amazon Customer Excellence (ACE) Challenge 2026. ₹4L prize pool. Teams of 4. Gender and academic diversity required. Campus launch 21 Jul 2026 via Twitch.',
    status:       'open',
  }),

  opp({
    title:        'Aditya Birla Group | Stratos 2026',
    organization: 'Aditya Birla Group',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '3 members',
    prize:        '₹5,00,000 Prize Pool',
    apply_link:   'https://unstop.com/competitions/crp-aditya-birla-group-stratos-2026-aditya-birla-group-1703062',
    eoi_link:     'https://forms.gle/eLjwkgEMEuzP1y6w5',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=573821349#gid=573821349',
    deadline:     '2026-07-22',
    description:  'Aditya Birla Group Stratos 2026 case competition. ₹5L prize pool. Teams of 3. Rounds include quiz, business simulation (5 rounds, 2 hrs), final presentation.',
    status:       'open',
  }),

  opp({
    title:        'EPOCH 2026',
    organization: 'EPOCH',
    type:         'Case Comp',
    applicability:'both',
    prize:        '₹10,00,000 Prize Pool',
    apply_link:   'https://www.iimjobs.com/epoch',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=65121007#gid=65121007',
    deadline:     '2026-07-31',
    description:  'EPOCH 2026 — individual case competition. ₹10L prize pool. Quiz round 17–25 Aug, Case round 3–13 Sep. 1st & 2nd year MBA/PGP eligible.',
    status:       'open',
  }),

  opp({
    title:        'The Coca-Cola Company | Mantra Challenge 2026',
    organization: 'The Coca-Cola Company',
    type:         'Case Comp',
    applicability:'both',
    apply_link:   'https://unstop.com/competitions/crp-the-coca-cola-mantra-challenge-2026-coca-cola-india-and-southwest-asia-1684185',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1900886279#gid=1900886279',
    description:  'Coca-Cola Mantra Challenge 2026. Simulation round (2 hrs). Mandatory for all eligible students.',
    status:       'open',
  }),

  opp({
    title:        'RPG Group | Outperform 2026',
    organization: 'RPG Group',
    type:         'Case Comp',
    applicability:'both',
    tracks:       ['General Management'],
    apply_link:   'https://unstop.com/competitions/crp-outperform-general-management-track-outperform-2026-rpg-group-1700829',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1869331803#gid=1869331803',
    description:  'RPG Outperform 2026 — General Management Track. Final deck submission 26 Jul 2026.',
    status:       'open',
  }),

  opp({
    title:        'PwC | AC India Challenge Season 8',
    organization: 'PwC',
    type:         'Case Comp',
    applicability:'both',
    apply_link:   'https://forms.office.com/pages/responsepage.aspx?id=oJQyUSA-skGpcG0wvxVG-pjSNz62db5AgLb2jwoZ-1xUQ1daQUkzRklUSUs4SzFCR0VGS05SOElWNC4u&route=shorturl',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=704859857#gid=704859857',
    deadline:     '2026-07-29',
    description:  'PwC Acceleration Center India Challenge — 8th edition. Team-based case study competition. Real business problems and consulting-style challenges. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'HUL | FinAce Season 10',
    organization: 'HUL',
    type:         'Case Comp',
    applicability:'summer',
    prize:        '₹5,00,000 Prize Pool + ₹2.2 Lakh/month PPIs (ULIP 2027)',
    tracks:       ['Finance'],
    apply_link:   'https://unstop.com/o/tvWRbZw/?ref=TPOtNmQz',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1561987369#gid=1561987369',
    deadline:     '2026-07-24',
    description:  'HUL FinAce Season 10. ₹5L prize pool + PPI worth ₹2.2L/month for ULIP 2027 summer internships. Eligibility: 1st Year MBA. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Galderma | GRAD 3.0',
    organization: 'Galderma',
    type:         'Case Comp',
    applicability:'both',
    prize:        '₹6,00,000 Prize Pool',
    team_size:    '1-3 members',
    tracks:       ['Marketing', 'Strategy'],
    apply_link:   'https://unstop.com/competitions/crp-grad-30-galderma-rising-achievers-in-dermatology-galderma-1698634',
    eoi_link:     'https://docs.google.com/forms/d/e/1FAIpQLScW6QfAw-Cc39aP2meKYVOE2m-Oz_LyPaU63DTAW8c90Zwgpg/viewform',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=246278213#gid=246278213',
    deadline:     '2026-07-24',
    description:  'Galderma GRAD 3.0 — Rising Achievers in Dermatology. ₹6L prize pool. World\'s largest pure-play dermatology company (Cetaphil, Restylane). Includes "Ask the Derm" session.',
    status:       'open',
  }),

  opp({
    title:        'V-Guard | Big Idea Plan 2026',
    organization: 'V-Guard',
    type:         'Case Comp',
    applicability:'both',
    prize:        '₹6,50,000 Prize Pool',
    team_size:    '1-3 members',
    apply_link:   'https://www.vguard.in/contest/index',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=1099498352#gid=1099498352',
    deadline:     '2026-07-25',
    description:  'V-Guard Big Idea Plan 2026, 16th edition. Business plan competition. ₹6.5L prize pool. Registration fee ₹1,000 per team. Gender and academic diversity preferred.',
    notes:        'Strong opportunity with less competition.',
    status:       'open',
  }),

  opp({
    title:        'Cipla | Ascend Season 4',
    organization: 'Cipla',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '2 members',
    apply_link:   'https://gradpartners.in/e/Cipla-Ascend-Season-4-277',
    eoi_link:     'https://docs.google.com/forms/d/19kDL3eKZqFnVfAfGp9P10d6RSMX_rzkqlvWHepsjQGE/edit',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=592067079#gid=592067079',
    deadline:     '2026-07-30',
    description:  'Cipla Ascend Season 4 case competition. Teams of 2. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Suzuki SRDI | Igniters Innovation Challenge 2026',
    organization: 'Suzuki SRDI',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '3 members',
    apply_link:   'https://gradpartners.in/e/igniters-innovation-challenge-2026-management-track-317',
    eoi_link:     'https://docs.google.com/forms/d/1fssTLKhi1nI3qVrvvQS49mg_E35y71BQPTZAJYYfKWY/edit',
    tracker_link: 'https://docs.google.com/spreadsheets/d/1ug4ErAePW5jQg9ikRaGzMQy6BNkslxbu3IGHH4COEgs/edit?gid=108526655#gid=108526655',
    deadline:     '2026-07-30',
    description:  'Suzuki R&D Center India (SRDI) Igniters Innovation Challenge 2026 — Management Track. Teams of 3. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Dr. Reddy\'s | Destination Case Competition 2026',
    organization: 'Dr. Reddy\'s',
    type:         'Case Comp',
    applicability:'both',
    apply_link:   'https://gradpartners.in/festival/destination-dr-reddys-2026',
    tracker_link: 'https://docs.google.com/spreadsheets/d/14KX-Lnjq7BsZk6O4u8rVZFRg7NBCBqRPOrWvV8WeqAc/edit?usp=sharing',
    deadline:     '2026-08-01',
    description:  'Dr. Reddy\'s Destination Case Competition 2026. Registration + LinkedIn quiz mandatory. 5 lucky quiz winners get gift hampers.',
    notes:        'LinkedIn quiz: https://www.linkedin.com/feed/update/urn:li:activity:7489235997592059904',
    status:       'open',
  }),

  opp({
    title:        'Mastercard | Inclusive Impact Series',
    organization: 'Mastercard',
    type:         'Case Comp',
    applicability:'both',
    description:  'Mastercard Inclusive Impact Series case competition.',
    status:       'open',
  }),

  opp({
    title:        'American Express | Campus Challenge',
    organization: 'American Express',
    type:         'Case Comp',
    applicability:'both',
    description:  'American Express Campus Challenge case competition.',
    status:       'open',
  }),

  opp({
    title:        'HUL | Foundation School',
    organization: 'HUL',
    type:         'Campus Engagement',
    subtype:      'Workshop',
    applicability:'both',
    description:  'HUL Foundation School campus engagement.',
    status:       'open',
  }),

  // ════════════════════════════════════════════════════════════
  // PC BULLETIN — Live Projects
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'AFL | Live Project',
    organization: 'AFL',
    type:         'Live Project',
    applicability:'both',
    description:  'AFL live project opportunity.',
    status:       'open',
  }),

  opp({
    title:        'Hyphen SCS | Live Project — Warehousing ROI',
    organization: 'Hyphen SCS',
    type:         'Live Project',
    applicability:'both',
    description:  'Live project on Warehousing ROI for Hyphen SCS.',
    status:       'open',
  }),

  opp({
    title:        'International Materials | Live Project — Commodity Trading',
    organization: 'International Materials',
    type:         'Live Project',
    applicability:'both',
    description:  'Live project on Commodity Trading (inorganic fluorochemicals) for International Materials.',
    status:       'open',
  }),

  // ════════════════════════════════════════════════════════════
  // PC BULLETIN FILE 2 (Aug–Sep 2026) — Hiring (SIP)
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'Tata Consumer Products | Summer Trainee Programme',
    organization: 'Tata Consumer Products',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    deadline:     '2026-08-06',
    description:  'Tata Consumer Products (TCPL) Summer Trainee Programme. Application window 5–6 Aug 2026.',
    status:       'open',
  }),

  opp({
    title:        'Aditya Birla Capital | Summer Internship',
    organization: 'Aditya Birla Capital',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    process_date: '2026-08-14',
    process_mode: 'Online',
    deadline:     '2026-08-13',
    description:  'Aditya Birla Capital SIP. PPT 14 Aug 2026, application deadline 13 Aug. Shortlist released 17 Aug.',
    status:       'open',
  }),

  opp({
    title:        'BNY Mellon | Summer Internship',
    organization: 'BNY Mellon',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Finance', 'Risk & Compliance'],
    process_date: '2026-08-13',
    process_mode: 'Offline',
    deadline:     '2026-08-18',
    description:  'BNY Mellon SIP — Finance and Risk & Compliance tracks. PPT + fireside chat on campus 13 Aug. Application deadline 18 Aug.',
    status:       'open',
  }),

  opp({
    title:        'Nomura | Summer Internship',
    organization: 'Nomura',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Investment Banking'],
    process_date: '2026-08-10',
    process_mode: 'Online',
    deadline:     '2026-08-11',
    description:  'Nomura Investment Banking SIP. Virtual PPT 10 Aug, application deadline 11 Aug.',
    status:       'open',
  }),

  opp({
    title:        'Lighthouse Canton | Summer Internship',
    organization: 'Lighthouse Canton',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Investment Banking', 'Marketing'],
    process_date: '2026-08-17',
    process_mode: 'Offline',
    deadline:     '2026-08-20',
    description:  'Lighthouse Canton SIP — IB and Marketing functions. PPT (Wealth Management + Marketing) on campus 17 Aug. Applications close 20 Aug. SIP IB shortlist 28 Aug, SIP Marketing shortlist 31 Aug.',
    status:       'open',
  }),

  opp({
    title:        'ABFRL | Stride BMT Summer Internship',
    organization: 'ABFRL',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Business Management Trainee'],
    process_date: '2026-08-19',
    process_mode: 'Offline',
    deadline:     '2026-08-22',
    description:  'ABFRL Stride BMT (Business Management Trainee) Summer Internship. PPT on campus 19 Aug, application deadline 22 Aug.',
    status:       'open',
  }),

  opp({
    title:        'JioStar | Summer Internship',
    organization: 'JioStar',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['International Growth', 'International Business Strategy', 'Marketing Analytics'],
    process_date: '2026-08-22',
    process_mode: 'Online',
    deadline:     '2026-08-22',
    description:  'JioStar SIP — 3 roles: International Growth, International Business Strategy, Marketing Analytics. Virtual PPT 22–23 Aug.',
    status:       'open',
  }),

  opp({
    title:        'Alvarez & Marsal | Summer Internship',
    organization: 'Alvarez & Marsal',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['BTS Global Capability Center'],
    deadline:     '2026-08-21',
    description:  'A&M (Alvarez & Marsal) SIP — BTS Global Capability Center. Application deadline 21 Aug.',
    status:       'open',
  }),

  opp({
    title:        'Wipro Consulting | Summer Internship',
    organization: 'Wipro Consulting',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Agentic AI', 'AI Venture Builder'],
    process_date: '2026-08-29',
    process_mode: 'Offline',
    deadline:     '2026-08-29',
    description:  'Wipro Consulting SIP — Agentic AI and AI Venture Builder roles. PPT on campus 29 Aug.',
    status:       'open',
  }),

  opp({
    title:        'Maersk | Summer Internship',
    organization: 'Maersk',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    deadline:     '2026-08-31',
    description:  'Maersk SIP application. Deadline 30–31 Aug 2026.',
    status:       'open',
  }),

  opp({
    title:        'EY | Summer Internship',
    organization: 'EY',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    deadline:     '2026-09-01',
    description:  'EY SIP application. Deadline 1 Sep 2026.',
    status:       'open',
  }),

  opp({
    title:        'PwC Acceleration Centre | Summer Internship',
    organization: 'PwC',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    process_date: '2026-08-27',
    process_mode: 'Online',
    deadline:     '2026-08-28',
    description:  'PwC Acceleration Centre India SIP. PPT/Career Forum virtual 27 Aug, application deadline 28 Aug.',
    status:       'open',
  }),

  opp({
    title:        'HSBC | Summer Internship',
    organization: 'HSBC',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    description:  'HSBC SIP. Shortlist released 3 Sep 2026.',
    status:       'shortlisted',
  }),

  opp({
    title:        'Britannia | Summer Internship',
    organization: 'Britannia',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    process_date: '2026-08-18',
    process_mode: 'Offline',
    description:  'Britannia SIP. PPT on campus 18 Aug.',
    status:       'open',
  }),

  opp({
    title:        'BMW | Summer Internship',
    organization: 'BMW',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    deadline:     '2026-09-08',
    description:  'BMW SIP EOI. Application deadline 8 Sep 2026.',
    status:       'open',
  }),

  opp({
    title:        'Valorant Consulting | Summer Internship',
    organization: 'Valorant Consulting',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    process_date: '2026-09-09',
    process_mode: 'Online',
    description:  'Valorant Consulting SIP. PPT virtual 9 Sep 2026.',
    status:       'open',
  }),

  opp({
    title:        'Cranmore Partners | Summer Internship',
    organization: 'Cranmore Partners',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    deadline:     '2026-09-09',
    description:  'Cranmore Partners SIP EOI. Application deadline 9 Sep 2026.',
    status:       'open',
  }),

  opp({
    title:        'UltraTech | Young Leaders Program',
    organization: 'UltraTech',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['General Management'],
    deadline:     '2026-09-10',
    description:  'UltraTech Young Leaders Program (UYLP) EOI. General Management track. Deadline 10 Sep 2026.',
    status:       'open',
  }),

  // ════════════════════════════════════════════════════════════
  // PC BULLETIN FILE 2 — Case Competitions (Aug–Sep 2026)
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'Saregama | Talentwood Season 5',
    organization: 'Saregama',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '3-4 members',
    prize:        'PPI opportunity for summer internship',
    deadline:     '2026-08-07',
    description:  'Saregama Talentwood Season 5 — flagship case competition. Teams of 3–4. PPI opportunity for SIP. Mentorship from leadership, live projects, LOR, artist access.',
    status:       'open',
  }),

  opp({
    title:        'Samagra | The Governance Challenge (TGC) 2026',
    organization: 'Samagra',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '3 members',
    prize:        '₹9,00,000 Prize Pool + PPI',
    deadline:     '2026-08-06',
    description:  'Samagra The Governance Challenge (TGC) 2026. ₹9L prize pool + PPI. Teams of 3. Hosted in partnership with Maharashtra Government. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Marico | Over The Wall Season 14',
    organization: 'Marico',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '2-3 members',
    prize:        'PPI opportunity',
    deadline:     '2026-08-08',
    description:  'Marico Over The Wall Season 14 case competition. Teams of 2–3. PPI opportunity. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Dabur | Verve Season 5',
    organization: 'Dabur',
    type:         'Case Comp',
    applicability:'summer',
    team_size:    '2-3 members',
    deadline:     '2026-08-13',
    description:  'Dabur Verve Season 5 case competition. Teams of 2–3. Mandatory for all first-year students.',
    status:       'open',
  }),

  opp({
    title:        'The Ken | Case Competition 2026',
    organization: 'The Ken',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '1-3 members',
    deadline:     '2026-08-15',
    description:  'The Ken Case Competition 2026. Individual or teams of 2–3. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Britannia | Creatovate 2.0 — Purchase Track',
    organization: 'Britannia',
    type:         'Case Comp',
    applicability:'summer',
    team_size:    '2 members',
    tracks:       ['Purchase'],
    deadline:     '2026-08-15',
    description:  'Britannia Creatovate 2.0 — Purchase Track. Teams of 2. For yet-to-be-placed students only.',
    status:       'open',
  }),

  opp({
    title:        'Dr. Reddy\'s | Destination 3.0 — Management Track',
    organization: 'Dr. Reddy\'s',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '1 member (individual)',
    deadline:     '2026-08-15',
    description:  'Destination Dr. Reddy\'s 3.0 — Management Track. Individual competition. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Zydus Wellness | WellNXT 2.0',
    organization: 'Zydus Wellness',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '2 members',
    deadline:     '2026-08-18',
    description:  'Zydus Wellness WellNXT 2.0 case competition. Teams of 2. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Prayagh Consumer Care | INDULGE \'26',
    organization: 'Prayagh Consumer Care',
    type:         'Case Comp',
    applicability:'summer',
    team_size:    '2 members',
    tracks:       ['Marketing & Sales'],
    deadline:     '2026-08-29',
    description:  'Prayagh Consumer Care INDULGE \'26 — Marketing & Sales track. Teams of 2. Mandatory for all.',
    status:       'open',
  }),

  opp({
    title:        'Schneider Electric | Yuva Yodha',
    organization: 'Schneider Electric',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '1-4 members',
    deadline:     '2026-09-12',
    description:  'Schneider Electric Yuva Yodha. Individual or teams of 1–4. Mandatory for all. Deadline extended from 26 Aug to 12 Sep.',
    status:       'open',
  }),

  opp({
    title:        'Kotak Life | Growth Manager Hiring Challenge Season 5',
    organization: 'Kotak Life',
    type:         'Case Comp',
    applicability:'summer',
    team_size:    '2 members',
    prize:        'Direct hiring via case competition',
    process_date: '2026-09-02',
    deadline:     '2026-08-29',
    description:  'Kotak Life Growth Manager Hiring Challenge Season 5. Teams of 2. Direct hiring pathway — top performers get summer internship offers. Campus launch 2 Sep.',
    status:       'open',
  }),

  opp({
    title:        'Reliance | T.U.P XII',
    organization: 'Reliance',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '1-4 members',
    prize:        'PPI opportunity',
    process_date: '2026-09-10',
    deadline:     '2026-09-05',
    description:  'Reliance T.U.P XII case competition. Teams of 1–4. PPI opportunity. Campus launch 10 Sep.',
    status:       'open',
  }),

  opp({
    title:        'MakeMyTrip | Young Turks\' Business Challenge Season 4',
    organization: 'MakeMyTrip',
    type:         'Case Comp',
    applicability:'both',
    team_size:    '3 members (min 1 female)',
    deadline:     '2026-09-04',
    description:  'MakeMyTrip Young Turks\' Business Challenge Season 4. Teams of 3 with minimum 1 female member.',
    status:       'open',
  }),

  opp({
    title:        'HUL | LIME Season 18',
    organization: 'HUL',
    type:         'Case Comp',
    applicability:'both',
    deadline:     '2026-09-06',
    description:  'HUL LIME Season 18 case competition. Mandatory for all. Campus launch 1 Sep.',
    status:       'open',
  }),

  opp({
    title:        'Tata Group | Imagination Challenge 2026',
    organization: 'Tata Group',
    type:         'Case Comp',
    applicability:'both',
    deadline:     '2026-09-06',
    description:  'Tata Imagination Challenge 2026. Mandatory for all. Primary pathway into Tata Administrative Services (TAS).',
    status:       'open',
  }),

  opp({
    title:        'Asian Paints | Canvas',
    organization: 'Asian Paints',
    type:         'Case Comp',
    applicability:'both',
    process_date: '2026-09-04',
    description:  'Asian Paints Canvas case competition session. 4 Sep 2026.',
    status:       'open',
  }),

  // ════════════════════════════════════════════════════════════
  // PC BULLETIN FILE 2 — Campus Engagements (Aug–Sep 2026)
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'Samagra | Governance Masterclass',
    organization: 'Samagra',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'both',
    process_date: '2026-08-07',
    process_mode: 'Online',
    description:  'Samagra Governance Masterclass — virtual session on public policy and governance strategy. 7 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Nomura | Pre-Placement Talk',
    organization: 'Nomura',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-08-10',
    process_mode: 'Online',
    description:  'Nomura virtual PPT for SIP. 10 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'BNY Mellon | Pre-Placement Talk',
    organization: 'BNY Mellon',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-13',
    process_mode: 'Offline',
    description:  'BNY Mellon PPT + fireside chat on campus. 13 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Aditya Birla Capital | Pre-Placement Talk',
    organization: 'Aditya Birla Capital',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-08-14',
    process_mode: 'Online',
    description:  'Aditya Birla Capital virtual PPT for SIP. 14 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Lighthouse Canton | Pre-Placement Talk',
    organization: 'Lighthouse Canton',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-17',
    process_mode: 'Offline',
    description:  'Lighthouse Canton PPT — Wealth Management and Marketing functions. On campus 17 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Britannia | Pre-Placement Talk',
    organization: 'Britannia',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-18',
    process_mode: 'Offline',
    description:  'Britannia PPT on campus. 18 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'L\'Oréal | Pre-Placement Talk',
    organization: 'L\'Oréal',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-18',
    process_mode: 'Offline',
    description:  'L\'Oréal PPT on campus. 18 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'ABFRL | Pre-Placement Talk',
    organization: 'ABFRL',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-19',
    process_mode: 'Offline',
    description:  'ABFRL Stride Program PPT on campus. 19 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'JioStar | Pre-Placement Talk',
    organization: 'JioStar',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-08-22',
    process_mode: 'Online',
    description:  'JioStar virtual PPT for SIP. 22–23 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'PwC Acceleration Centre | Pre-Placement Talk',
    organization: 'PwC',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-08-27',
    process_mode: 'Online',
    description:  'PwC AC India Career Forum / PPT — virtual. 27 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Wipro Consulting | Pre-Placement Talk',
    organization: 'Wipro Consulting',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-29',
    process_mode: 'Offline',
    description:  'Wipro Consulting PPT on campus. 29 Aug 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Kotak Life | Campus Launch — Growth Manager Challenge',
    organization: 'Kotak Life',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-09-02',
    process_mode: 'Offline',
    description:  'Kotak Life Growth Manager Hiring Challenge Season 5 campus launch. 2 Sep 2026.',
    status:       'closed',
  }),

  opp({
    title:        'RJ Corp | ASCEND Leadership Talk',
    organization: 'RJ Corp',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-09-01',
    process_mode: 'Offline',
    description:  'RJ Corp ASCEND Leadership Talk. Originally scheduled 1 Sep 2026 — postponed, rescheduled date TBD.',
    notes:        'Postponed from original date.',
    status:       'closed',
  }),

  opp({
    title:        'IDFC FIRST Bank | ASCEND Leadership Talk',
    organization: 'IDFC FIRST Bank',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-09-04',
    process_mode: 'Offline',
    description:  'IDFC FIRST Bank ASCEND Leadership Talk on treasury and banking. 4 Sep 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Reliance | T.U.P XII Campus Launch',
    organization: 'Reliance',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-09-10',
    process_mode: 'Offline',
    description:  'Reliance T.U.P XII campus launch event. 10 Sep 2026.',
    status:       'closed',
  }),

  opp({
    title:        'Synergy Consulting | Guest Lecture',
    organization: 'Synergy Consulting',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'both',
    process_date: '2026-09-18',
    process_mode: 'Offline',
    description:  'Synergy Consulting guest lecture on campus. 18 Sep 2026.',
    status:       'open',
  }),

  opp({
    title:        'Valorant Consulting | Pre-Placement Talk',
    organization: 'Valorant Consulting',
    type:         'Campus Engagement',
    subtype:      'Webinar',
    applicability:'summer',
    process_date: '2026-09-09',
    process_mode: 'Online',
    description:  'Valorant Consulting virtual PPT for SIP. 9 Sep 2026.',
    status:       'closed',
  }),

  // ════════════════════════════════════════════════════════════
  // IB BULLETIN — Hiring (IB-specific, Aug–Sep 2026)
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'Samsung | Sales & Marketing Summer Internship',
    organization: 'Samsung',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Sales & Marketing'],
    process_date: '2026-08-27',
    process_mode: 'Online',
    deadline:     '2026-08-26',
    description:  'Samsung Sales & Marketing SIP. EOI deadline 26 Aug (extended). PPT 27 Aug online. Shortlist from EOI released same day. IB batch.',
    status:       'open',
  }),

  opp({
    title:        'Reliance Industries | Summer Internship',
    organization: 'Reliance Industries',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    process_date: '2026-08-27',
    process_mode: 'Offline',
    description:  'Reliance Industries SIP assessment — in-person 27 Aug. Shortlist released 28 Aug. IB batch.',
    status:       'open',
  }),

  opp({
    title:        'Dabur | Sales & Marketing Summer Internship',
    organization: 'Dabur',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Sales & Marketing'],
    deadline:     '2026-09-01',
    description:  'Dabur Sales & Marketing SIP. EOI and shortlist both 1 Sep. IB batch.',
    status:       'open',
  }),

  opp({
    title:        'Tata Steel | Marketing & Sales Summer Internship',
    organization: 'Tata Steel',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Marketing & Sales'],
    deadline:     '2026-09-03',
    description:  'Tata Steel Marketing & Sales track SIP. EOI 3 Sep, shortlist 4 Sep. IB batch.',
    status:       'open',
  }),

  opp({
    title:        'Tata Steel | Supply Chain & Procurement Summer Internship',
    organization: 'Tata Steel',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Supply Chain & Procurement'],
    deadline:     '2026-09-03',
    description:  'Tata Steel Supply Chain & Procurement track SIP. EOI 3 Sep, shortlist 4 Sep. IB batch.',
    status:       'open',
  }),

  opp({
    title:        'Reckitt | Sales & Marketing Summer Internship',
    organization: 'Reckitt',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    roles:        ['Sales & Marketing'],
    deadline:     '2026-09-05',
    description:  'Reckitt Sales & Marketing SIP — Dream Opportunity. EOI 5 Sep, shortlist 7 Sep. IB batch only.',
    notes:        'Dream category opportunity.',
    status:       'open',
  }),

  opp({
    title:        'Hero MotoCorp | Female Leadership Program Summer Internship',
    organization: 'Hero MotoCorp',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    process_date: '2026-09-07',
    process_mode: 'Online',
    eligibility:  'Female students only.',
    deadline:     '2026-09-08',
    description:  'Hero MotoCorp Female Leadership Program SIP. Online PPT 7 Sep, shortlist 8 Sep. Female students only. IB batch.',
    status:       'open',
  }),

  opp({
    title:        'Axis Bank | Pre-Placement Talk',
    organization: 'Axis Bank',
    type:         'Campus Engagement',
    subtype:      'Guest Lecture',
    applicability:'summer',
    process_date: '2026-08-24',
    process_mode: 'Offline',
    description:  'Axis Bank PPT on campus for SIP hiring process (separate from MOVES 2026 case comp). 24 Aug. EOI deadline 25 Aug.',
    status:       'closed',
  }),

  opp({
    title:        'Axis Bank | Summer Internship Program',
    organization: 'Axis Bank',
    type:         'Hiring',
    via:          'Direct',
    applicability:'summer',
    process_date: '2026-08-24',
    deadline:     '2026-08-25',
    description:  'Axis Bank SIP hiring process. PPT 24 Aug on campus, EOI 25 Aug. Separate from MOVES 2026 case competition. IB batch.',
    status:       'open',
  }),

  // ════════════════════════════════════════════════════════════
  // IB BULLETIN — Case Competitions
  // ════════════════════════════════════════════════════════════

  opp({
    title:        'ITC | Interrobang Season 16 — Campus Finals',
    organization: 'ITC',
    type:         'Case Comp',
    applicability:'both',
    process_date: '2026-09-11',
    process_mode: 'Offline',
    description:  'ITC Interrobang Season 16 — Campus Finals held on campus 11 Sep 2026. IB batch.',
    status:       'closed',
  }),

]

async function run() {
  console.log(`Inserting ${OPPS_TO_INSERT.length} opportunities...\n`)

  for (const data of OPPS_TO_INSERT) {
    const ref = db.collection('opportunities').doc()
    await ref.set(data)
    await ref.collection('stages').add({
      type: 'opportunity',
      message: "[Added from PC/IB Bulletin BO'28 WhatsApp chat]",
      createdAt: Timestamp.now(),
      createdBy: POSTED_BY,
    })
    if (data.status === 'shortlisted') {
      await ref.collection('stages').add({
        type: 'shortlist',
        message: '',
        createdAt: Timestamp.now(),
        createdBy: POSTED_BY,
      })
    }
    console.log(`✓ [${data.type}] ${data.organization} — ${data.title}`)
  }

  console.log(`\n✅ Done. ${OPPS_TO_INSERT.length} inserted into ${PROJECT_ID}.`)
}

run().catch(e => { console.error(e); process.exit(1) })
