/**
 * Backfill summer (SIP) placements — FULL linked flow.
 *
 * For each placed student:
 *   1. Sets _placed_summer + _placement_summer on /students/{id}
 *   2. Writes /opportunities/{oppId}/applicants/{roll} with status:'selected'
 *   3. Writes /opportunities/{oppId}/stages/ with type:'selected'
 *   4. Updates /opportunities/{oppId}.status = 'closed'
 *   5. Writes /auditLog entry
 *
 * Mirrors exactly what approve() does for place_from_activity in PendingChangesContext.
 *
 * Run:
 *   node scripts/backfill_summer_placements.mjs             # → staging (no-op, no students)
 *   node scripts/backfill_summer_placements.mjs --production # → production
 */

import { initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const isProd = process.argv.includes('--production')
const PROJECT_ID = isProd ? 'placement-management-6133f' : 'placement-mgmt-staging'
console.log(`\nTarget: ${isProd ? '🔴 PRODUCTION' : '🟡 STAGING'} (${PROJECT_ID})\n`)

initializeApp({ projectId: PROJECT_ID })
const db = getFirestore()

const DONE_BY = { uid: 'divyaanshmehta513@gmail.com', name: 'Divyaansh Mehta' }

// ─── Opportunity ID map (production doc IDs, keyed by canonical company slug) ─
// Duplicates in Firestore: use the most recently inserted (insert_missing_opps.mjs) ID.
// Older seeded duplicates are listed in comments.
const OPP = {
  // Hiring
  'jp_morgan':        'YFInZFXasehMgvjldhyf',  // 006ZjFBOgmUK9MrePGbs is older seed
  'goldman_sachs':    'BABmKQdnRh6PBdVduJYM',
  'morgan_stanley':   'D84gepuiBhENPgijazo1',
  'philips':          '0Kd45CTyOUXqU4p7GTAZ',
  'bny_mellon':       'Q39dSD85veOxDA9HBBpY',
  'accenture':        'TvaXD7pGV4Z8FE2KiO2V',
  'titan':            'PimSmGZIA6EqxHaZA00T',   // Titan & CaratLane
  'tas':              'x9jGbhVuHRavnCG1jJrW',   // Tata Administrative Services
  'godrej_properties':'g91mCUEtGNrXLtxLwWVD',
  'godrej_consumer':  'RFDQzCD1Bsv2yYj9Wzzp',
  'deloitte':         'L3b09AhBUMCGZuhB1m9Q',
  'snabbit':          'Sh2qjXjGrsYHgyzgX0vI',
  'synergy':          '0AyFYPiQL8QoxSBoHPMw',
  'nomura':           'VBXWxMM76DfoBelb4AYt',
  'flipkart':         'AIMI2yK6msUfcc8zSt8d',  // Vidyarthini's Flipkart SIP opp
  'wipro':            'CETLyNfqqW0dcN3GC2jr',
  'jiostar':          'GVVy7Fjkjgr9YMIVHiEq',
  'axis_bank':        'HOXeBtinrNXt9LNlaROz',
  'alvarez_marsal':   'urR8g8PcdR1JpOU7qxSt',
  'maersk':           'u0Cac34uPuMXikYZGRLP',
  'ey':               'dUrrfkIMEMhppPnSpUus',
  'pwc_ac':           'l7zrpQ0ppQ1YN1344W3B',
  'hsbc':             'u7yEnUQOgpoMRHHf7O8E',
  'samsung':          'in6S9uZC7OdFHdNO4qaA',
  'dabur':            'xlaSHpdFV3OXfvyivS0M',
  'tata_steel_mktg':  'tcwADfEQZnAkul3vdjIS',  // Marketing & Sales track
  'tata_steel_sc':    'vN6Q85oxi3LcTXAz6nBm',  // Supply Chain track
  'reliance':         'unW5id6xwXM3kaeDGkcE',   // Reliance Industries SIP
  'lighthouse':       'AGcUpsFHEdujtMTowtPd',
  'hero_moto':        'GIzrvTx2HPwgJrtlOK26',
  'aditya_birla_cap': 'kUho14iy2a47LF1LFipS',
  'valorant':         'osEdfGRTmmJazYhkLdCH',
  'britannia':        'zCaPyKROx9ULfWVkpmXU',
  // Case Comp used as SIP pathway
  'loreal_edge':      '5qfTzv2c0422s6xYDxWS',   // L'Oréal Edge (case comp → SIP)
  'galderma_grad':    '5Y86zMp15l1kt4wcSAXT',    // Galderma GRAD 3.0
  'amazon_ace':       'TVu1xXMut8O3uIu4fdOP',    // Amazon ACE → Kritika placed via Operations
  // Flipkart WiRED case comp — Ananya, Bobba, Shivam placed via business track
  'flipkart_wired':   'krOgKM8zuoQf0zcv6pix',    // WiRED Case Comp opp
  // HUL — placed before system via direct hire, no SIP hiring opp
  'hul_sip':          'DIRECT',
}

// ─── Placed students ──────────────────────────────────────────────────────────
// Format: [official_email, roll, name, company_slug, opp_id_override_or_null, role, sector, stipend_lakhs, dop, location]
// opp_id: if null, use OPP[company_slug]. If 'DIRECT', skip opp linkage (pre-system hire).

function p(email, roll, name, oppId, role, sector, stipendLakhs, dop, location = 'Domestic') {
  const date = parseDate(dop)
  return {
    email, roll, name, oppId,
    placement: {
      date,
      company: oppId === 'DIRECT' ? '' : '',  // filled per entry below
      role:    role  || '',
      sector:  sector || '',
      location,
      package: stipendLakhs ? `${stipendLakhs} Lakh/month` : '',
      via:     'Campus Placement',
      ctcNotes: '',
      placedAtIso: date ? new Date(`${date}T00:00:00`).toISOString() : new Date().toISOString(),
    },
  }
}

function parseDate(raw) {
  if (!raw) return ''
  raw = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  const cleaned = raw.replace(/(\d+)(st|nd|rd|th)/gi, '$1').replace(',', '')
  const d = new Date(cleaned)
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }
  return raw
}

// ─── Full placed list ─────────────────────────────────────────────────────────
// [email, roll, display_name, opp_id, company_display, role, sector, stipend_lakhs, DOP]
const PLACED = [
  // ── Section A IB ──
  ['adwait_d28@iift.edu',        '4A',  'Adwait Meethal',          OPP.lighthouse,       'Lighthouse Canton',        'Marketing',                               'Banking & Financial Services',             1.00, '2nd September,2026'],
  ['akanksha_d28@iift.edu',      '5A',  'Akanksha Pankaj',         OPP.flipkart_wired,   'Flipkart',                 'Supply Chain Management',                 'Retail, Lifestyle & E-Commerce',           1.20, '1st September,2026'],
  ['aniket_d28@iift.edu',        '6A',  'Aniket Pramod Sonare',    OPP.bny_mellon,       'BNY Mellon',               'Risk & Compliance',                       'Banking & Financial Services',             1.20, '24th August, 2026'],
  ['anmol_d28@iift.edu',         '7A',  'Anmol Sehgal',            'DIRECT',             'HUL',                      'Sales & Marketing',                       'FMCG & Consumer Products',                 2.20, '25th June, 2026'],
  ['anushka_d28@iift.edu',       '9A',  'Anushka Gupta',           OPP.philips,          'Philips',                  'Sales and Marketing',                     'Pharma, Healthcare & Life Sciences',       1.25, '14th August, 2026'],
  ['arush_d28@iift.edu',         '10A', 'Arush Jain',              OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['athipan_d28@iift.edu',       '11A', 'Athipan Raj P',           OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['devshree_d28@iift.edu',      '16A', 'Devshree Rajusingh Patil',OPP.titan,            'Titan',                    'Sales and Marketing',                     'Retail, Lifestyle & E-Commerce',           1.80, '21st August,2026'],
  ['jiya_d28@iift.edu',          '18A', 'Jiya Garg',               OPP.jp_morgan,        'JP Morgan Chase',          'CIB R&A - Banking',                       'Banking & Financial Services',             2.05, '5th August, 2026'],
  ['meghna_d28@iift.edu',        '21A', 'Meghna Chopra',           OPP.bny_mellon,       'BNY Mellon',               'Risk & Compliance',                       'Banking & Financial Services',             1.20, '24th August, 2026'],
  ['nishtha_d28@iift.edu',       '24A', 'Nishtha Garg',            OPP.reliance,         'Reliance',                 'General Management',                      'Leadership Programmes & Others',           1.50, '29 August, 2026'],
  ['pragati_d28@iift.edu',       '28A', 'Pragati Raj',             OPP.tata_steel_sc,    'Tata Steel',               'Supply Chain Management',                 'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['pranjal_d28@iift.edu',       '29A', 'Pranjal Dixit',           OPP.philips,          'Philips',                  'Sales and Marketing',                     'Pharma, Healthcare & Life Sciences',       1.25, '14th August, 2026'],
  ['prashant_d28@iift.edu',      '30A', 'Prashant Kumar',          OPP.tata_steel_mktg,  'Tata Steel',               'Sales & Marketing',                       'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['sanjanaishwar_d28@iift.edu', '36A', 'Sanjana Ishwar Prasad',   OPP.tas,              'TAS',                      'Leadership Program',                      'Leadership Programmes & Others',           1.80, '11th August, 2026'],
  ['sasrika_d28@iift.edu',       '37A', 'Sasrika Saxena',          OPP.samsung,          'Samsung',                  'Sales & Marketing',                       'Technology & Telecom',                     1.50, '27th August, 2026'],
  ['shreya_d28@iift.edu',        '38A', 'Shreya Gour',             OPP.pwc_ac,           'PwC AC',                   'Finance Solutions',                       'Consulting & Professional Services',       1.75, '3rd September, 2026'],
  ['sumit_d28@iift.edu',         '40A', 'Sumit Ramchandra More',   OPP.reliance,         'Reliance',                 'General Management',                      'Leadership Programmes & Others',           1.50, '29 August, 2026'],
  ['tarsna_d28@iift.edu',        '42A', 'Tarsna C T',              OPP.jp_morgan,        'JP Morgan Chase',          'CIB R&A - Banking',                       'Banking & Financial Services',             2.05, '5th August, 2026'],
  ['vedika_d28@iift.edu',        '45A', 'Vedika Dubey',            OPP.philips,          'Philips',                  'Sales and Marketing',                     'Pharma, Healthcare & Life Sciences',       1.25, '14th August, 2026'],
  ['vishwarni_d28@iift.edu',     '46A', 'Vishwarni T',             OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['vivek_d28@iift.edu',         '47A', 'Vivek Durgaprasad Maurya',OPP.maersk,           'Maersk',                   'Management Trainee',                      'Logistics, Trade & Supply Chain',          1.00, '4th September, 2026'],
  ['yashs_d28@iift.edu',         '48A', 'Yash Srivastava',         OPP.titan,            'Titan',                    'Sales and Marketing',                     'Retail, Lifestyle & E-Commerce',           1.80, '21st August,2026'],

  // ── Section B IB ──
  ['abhishekn_d28@iift.edu',     '1B',  'Abhishek Narayan',        OPP.snabbit,          'Snabbit',                  '',                                        'Retail, Lifestyle & E-Commerce',           1.25, '24th August, 2026'],
  ['akansha_d28@iift.edu',       '4B',  'Akansha Bansal',          OPP.wipro,            'Wipro Consulting',         'AI Venture Builder - Strategic AI Incubation','Consulting & Professional Services',    1.00, '31st August, 2026'],
  ['akshaj_d28@iift.edu',        '5B',  'Akshaj Mehrotra',         OPP.bny_mellon,       'BNY Mellon',               'Risk & Compliance',                       'Banking & Financial Services',             1.20, '24th August, 2026'],
  ['ananya_d28@iift.edu',        '6B',  'Ananya Verma',            OPP.flipkart_wired,   'Flipkart',                 'Business Strategy',                       'Retail, Lifestyle & E-Commerce',           1.20, '7th September, 2026'],
  ['ashutosh_d28@iift.edu',      '7B',  'Ashutosh Singh',          OPP.jp_morgan,        'JP Morgan Chase',          'CIB R&A - Banking',                       'Banking & Financial Services',             2.05, '5th August, 2026'],
  ['atishay_d28@iift.edu',       '8B',  'Atishay Jain',            'D84gepuiBhENPgijazo1','Morgan Stanley',          'Investment Banking / Global Capital Markets','Banking & Financial Services',            1.60, '28th July, 2026'],
  ['bobba_d28@iift.edu',         '9B',  'Bobba Devishwar Reddy',   OPP.flipkart_wired,   'Flipkart',                 'Business Track',                          'Retail, Lifestyle & E-Commerce',           1.20, '8th September, 2026'],
  ['chakshika_d28@iift.edu',     '10B', 'Chakshika Bhatt',         OPP.philips,          'Philips',                  'Sales and Marketing',                     'Pharma, Healthcare & Life Sciences',       1.25, '14th August, 2026'],
  ['gaya_d28@iift.edu',          '14B', 'Gaya Datt Shukla',        OPP.tata_steel_sc,    'Tata Steel',               'Supply Chain Management',                 'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['hardik_d28@iift.edu',        '15B', 'Hardik Bansal',           OPP.goldman_sachs,    'Goldman Sachs',            'Operational Risk',                        'Banking & Financial Services',             1.60, '4th August, 2026'],
  ['harsh_d28@iift.edu',         '16B', 'Harsh Sancheti Jain',     OPP.jp_morgan,        'JP Morgan Chase',          'AWM Risk Analytics',                      'Banking & Financial Services',             1.85, '8th August, 2026'],
  ['harshitkumar_d28@iift.edu',  '17B', 'Harshit Kumar',           OPP.alvarez_marsal,   'Alvarez & Marsal',         '',                                        'Consulting & Professional Services',       1.50, '25th August,2026'],
  ['ishant_d28@iift.edu',        '18B', 'Ishant Trivedi',          OPP.tas,              'TAS',                      'Leadership Program',                      'Leadership Programmes & Others',           1.80, '11th August, 2026'],
  ['jakka_d28@iift.edu',         '19B', 'Jakka Mukesh Kumar Reddy',OPP.hsbc,             'HSBC',                     'Analyst',                                 'Banking & Financial Services',             0.90, '4th September, 2026'],
  ['kandarp_d28@iift.edu',       '20B', 'Kandarp Joshi',           OPP.godrej_properties,'Godrej Properties',        'Sales and Marketing',                     'Real Estate & Infrastructure',             2.25, '27th July, 2026'],
  ['karthic_d28@iift.edu',       '21B', 'Karthic Elango',          OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['krish_d28@iift.edu',         '23B', 'Parekh Krish',            OPP.reliance,         'Reliance',                 'General Management',                      'Leadership Programmes & Others',           1.50, '29 August, 2026'],
  ['krishna_d28@iift.edu',       '24B', 'Krishna Lakhotia',        OPP.deloitte,         'Deloitte USI',             'Business Valuation Intern',               'Consulting & Professional Services',       1.20, '26th August,2026'],
  ['lokesh_d28@iift.edu',        '25B', 'Lokesh Agrawal',          OPP.axis_bank,        'Axis Bank',                'General Management',                      'Banking & Financial Services',             1.50, '27th August, 2026'],
  ['navya_d28@iift.edu',         '28B', 'Navya Sikka',             OPP.dabur,            'Dabur',                    'Sales and Marketing',                     'FMCG & Consumer Products',                 1.50, '2nd September,2026'],
  ['nishthas_d28@iift.edu',      '29B', 'Nishtha Sabnani',         OPP.godrej_properties,'Godrej Properties',        'Profit & Loss',                           'Real Estate & Infrastructure',             2.25, '27th July, 2026'],
  ['parvathy_d28@iift.edu',      '30B', 'Parvathy N K',            OPP.axis_bank,        'Axis Bank',                'General Management',                      'Banking & Financial Services',             1.50, '27th August, 2026'],
  ['peela_d28@iift.edu',         '31B', 'Peela Pavani Sai Aishwarya',OPP.titan,          'Titan',                    'Sales and Marketing',                     'Retail, Lifestyle & E-Commerce',           1.80, '21st August,2026'],
  ['prakritih_d28@iift.edu',     '33B', 'Prakriti Harith P',       OPP.titan,            'Titan',                    'Sales and Marketing',                     'Retail, Lifestyle & E-Commerce',           1.80, '21st August,2026'],
  ['rishabh_d28@iift.edu',       '34B', 'Rishabh Kumar',           OPP.jp_morgan,        'JP Morgan Chase',          'IB Credit Risk',                          'Banking & Financial Services',             1.85, '8th August, 2026'],
  ['ritwik_d28@iift.edu',        '35B', 'Ritwik Raushan',          OPP.jp_morgan,        'JP Morgan Chase',          'CIB R&A - Banking',                       'Banking & Financial Services',             2.05, '5th August, 2026'],
  ['sakshiyadav_d28@iift.edu',   '37B', 'Sakshi Yadav',            OPP.jiostar,          'JioStar',                  'International Strategy',                  'Technology & Telecom',                     1.80, '25th August,2026'],
  ['sanjana_d28@iift.edu',       '38B', 'Sanjana Doss',            OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['shantanu_d28@iift.edu',      '39B', 'Shantanu Mishra',         'D84gepuiBhENPgijazo1','Morgan Stanley',          'Investment Banking - Global Capital Markets','Banking & Financial Services',            1.60, '28th July, 2026'],
  ['shayoni_d28@iift.edu',       '40B', 'Shayoni Das',             OPP.godrej_consumer,  'Godrej Consumer Products', 'Sales and Marketing',                     'FMCG & Consumer Products',                 2.25, '27th July, 2026'],
  ['shivam_d28@iift.edu',        '41B', 'Shivam Pandey',           OPP.flipkart_wired,   'Flipkart',                 'Business Strategy',                       'Retail, Lifestyle & E-Commerce',           1.20, '7th September, 2026'],
  ['vidhi_d28@iift.edu',         '47B', 'Vidhi Narula',            OPP.nomura,           'Nomura',                   'Investment Banking',                      'Banking & Financial Services',             1.75, '12th August,2026'],
  ['vidushi_d28@iift.edu',       '48B', 'Vidushi',                 OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['vikalp_d28@iift.edu',        '49B', 'Garg Vikalp Raj',         OPP.loreal_edge,      "L'Oréal",                  'Sales and Marketing',                     'FMCG & Consumer Products',                 2.00, '18th August,2026'],

  // ── Section C IB ──
  ['aakashyadav_d28@iift.edu',   '1C',  'Aakash Yadav',            OPP.titan,            'Titan',                    'Sales and Marketing',                     'Retail, Lifestyle & E-Commerce',           1.80, '21st August,2026'],
  ['adityap_d28@iift.edu',       '4C',  'Aditya Raju Pawar',       OPP.godrej_properties,'Godrej Properties',        'Profit & Loss',                           'Real Estate & Infrastructure',             2.25, '27th July,2026'],
  ['akshay_d28@iift.edu',        '5C',  'Akshay Chitlangi',        OPP.jp_morgan,        'JP Morgan Chase',          'CIB R&A - Banking',                       'Banking & Financial Services',             2.05, '5th August, 2026'],
  ['akshita_d28@iift.edu',       '6C',  'Akshita Saxena',          OPP.bny_mellon,       'BNY Mellon',               'Risk & Compliance',                       'Banking & Financial Services',             1.20, '24th August, 2026'],
  ['alisha_d28@iift.edu',        '8C',  'Alisha Nitin Dhawde',     OPP.axis_bank,        'Axis Bank',                'General Management',                      'Banking & Financial Services',             1.50, '27th August, 2026'],
  ['arnav_d28@iift.edu',         '11C', 'Arnav Sanjay Khandekar',  OPP.samsung,          'Samsung',                  'Sales & Marketing',                       'Technology & Telecom',                     1.50, '27th August, 2026'],
  ['arpita_d28@iift.edu',        '12C', 'Arpita Choudhary',        OPP.snabbit,          'Snabbit',                  '',                                        'Retail, Lifestyle & E-Commerce',           1.25, '24th August, 2026'],
  ['devangi_d28@iift.edu',       '15C', 'Devangi Varshnay',        OPP.axis_bank,        'Axis Bank',                'General Management',                      'Banking & Financial Services',             1.50, '27th August, 2026'],
  ['devjit_d28@iift.edu',        '16C', 'Devjit A S',              OPP.samsung,          'Samsung',                  'Sales & Marketing',                       'Technology & Telecom',                     1.50, '27th August, 2026'],
  ['divyak_d28@iift.edu',        '17C', 'Divya Kavadiya',          OPP.tas,              'TAS',                      'Leadership Program',                      'Leadership Programmes & Others',           1.80, '11th August, 2026'],
  ['divyansh_d28@iift.edu',      '18C', 'Divyansh Kumar',          OPP.axis_bank,        'Axis Bank',                'General Management',                      'Banking & Financial Services',             1.50, '27th August, 2026'],
  ['dyuti_d28@iift.edu',         '19C', 'Dyuti Mitra',             OPP.jiostar,          'JioStar',                  'International Strategy',                  'Technology & Telecom',                     1.80, '25th August,2026'],
  ['govinda_d28@iift.edu',       '20C', 'Govinda Babulal Agrawal', OPP.loreal_edge,      "L'Oréal",                  'Sales and Marketing',                     'FMCG & Consumer Products',                 2.00, '18th August,2026'],
  ['khushi_d28@iift.edu',        '22C', 'Khushi Gupta',            OPP.philips,          'Philips',                  'Sales and Marketing',                     'Pharma, Healthcare & Life Sciences',       1.25, '14th August, 2026'],
  ['lilian_d28@iift.edu',        '23C', 'Lilian Jackson Mathews',  OPP.deloitte,         'Deloitte USI',             'Business Valuation Intern',               'Consulting & Professional Services',       1.20, '26th August,2026'],
  ['meemansa_d28@iift.edu',      '25C', 'Meemansa Bagaria',        OPP.titan,            'Titan',                    'Sales and Marketing',                     'Retail, Lifestyle & E-Commerce',           1.80, '21st August,2026'],
  ['muskan_d28@iift.edu',        '26C', 'Muskan Agrawal',          OPP.hero_moto,        'Hero MotoCorp',            'Sales and Marketing Intern',              'Automotive',                               1.25, '10th September, 2026'],
  ['pratha_d28@iift.edu',        '29C', 'Pratha Jamwal',           'D84gepuiBhENPgijazo1','Morgan Stanley',          'Investment Banking / Global Capital Markets','Banking & Financial Services',            1.60, '28th July, 2026'],
  ['raghav_d28@iift.edu',        '30C', 'Raghav Goyal',            OPP.synergy,          'Synergy Consulting',       'Corporate and Project Finance',           'Consulting & Professional Services',       1.50, '13th August, 2026'],
  ['rajat_d28@iift.edu',         '31C', 'Rajat Suresh Kurve',      OPP.alvarez_marsal,   'Alvarez & Marsal',         '',                                        'Consulting & Professional Services',       1.50, '25th August,2026'],
  ['sai_d28@iift.edu',           '35C', 'Sai Praneetha Bhrugubanda',OPP.jp_morgan,       'JP Morgan Chase',          'IB Credit Risk',                          'Banking & Financial Services',             1.85, '8th August, 2026'],
  ['siddharth_d28@iift.edu',     '40C', 'Siddharth Noah Joshi',    OPP.bny_mellon,       'BNY Mellon',               'Risk & Compliance',                       'Banking & Financial Services',             1.20, '24th August, 2026'],
  ['Sinjini_d28@iift.edu',       '41C', 'Sinjini Chakraborty',     OPP.philips,          'Philips',                  'Sales and Marketing',                     'Pharma, Healthcare & Life Sciences',       1.25, '14th August, 2026'],
  ['smiti_d28@iift.edu',         '42C', 'Smiti',                   'D84gepuiBhENPgijazo1','Morgan Stanley',          'Investment Banking / Global Capital Markets','Banking & Financial Services',            1.60, '28th July, 2026'],
  ['stuti_d28@iift.edu',         '43C', 'Stuti Garg',              OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['yugant_d28@iift.edu',        '50C', 'Yugant Rajesh Dhoble',    OPP.alvarez_marsal,   'Alvarez & Marsal',         '',                                        'Consulting & Professional Services',       1.50, '25th August,2026'],

  // ── Section D IB ──
  ['akankshya_d28@iift.edu',     '6D',  'Akankshya Panigrahi',     OPP.valorant,         'Valorant Consulting',      'Senior Consultant',                       'Consulting & Professional Services',       1.50, '10th September, 2026'],
  ['akshit_d28@iift.edu',        '7D',  'Akshit',                  OPP.tata_steel_mktg,  'Tata Steel',               'Sales & Marketing',                       'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['anamika_d28@iift.edu',       '9D',  'Anamika Vijayan',         OPP.reliance,         'Reliance',                 'General Management',                      'Leadership Programmes & Others',           1.50, '29 August, 2026'],
  ['arman_d28@iift.edu',         '12D', 'Arman Mahapatra',         OPP.goldman_sachs,    'Goldman Sachs',            'Operational Risk',                        'Banking & Financial Services',             1.60, '4th August, 2026'],
  ['banduchode_d28@iift.edu',    '14D', 'Banduchode Megha Shyam',  OPP.axis_bank,        'Axis Bank',                'General Management',                      'Banking & Financial Services',             1.50, '27th August, 2026'],
  ['chanderpal_d28@iift.edu',    '15D', 'Chanderpal Choudhary',    OPP.tata_steel_mktg,  'Tata Steel',               'Sales & Marketing',                       'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['diksha_d28@iift.edu',        '16D', 'Diksha Broota',           OPP.jp_morgan,        'JP Morgan Chase',          'AWM Risk Analytics',                      'Banking & Financial Services',             1.85, '8th August, 2026'],
  ['divyanshik_d28@iift.edu',    '17D', 'Divyanshi Kureel',        OPP.tata_steel_mktg,  'Tata Steel',               'Sales & Marketing',                       'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['gandhi_d28@iift.edu',        '18D', 'Aum Gandhi',              OPP.godrej_consumer,  'Godrej Consumer Products', 'Sales and Marketing',                     'FMCG & Consumer Products',                 2.25, '27th July, 2026'],
  ['gazal_d28@iift.edu',         '19D', 'Gazal Chhawri',           OPP.dabur,            'Dabur',                    'Sales and Marketing',                     'FMCG & Consumer Products',                 1.50, '2nd September,2026'],
  ['gitesh_d28@iift.edu',        '20D', 'Gitesh Pal',              OPP.godrej_consumer,  'Godrej Consumer Products', 'Sales and Marketing',                     'FMCG & Consumer Products',                 2.25, '27th July, 2026'],
  ['juvad_d28@iift.edu',         '21D', 'Juvad Jigna Laxmiben',    OPP.maersk,           'Maersk',                   'Management Trainee',                      'Logistics, Trade & Supply Chain',          1.00, '4th September, 2026'],
  ['kislay_d28@iift.edu',        '24D', 'Kislay Singh Panwar',     OPP.deloitte,         'Deloitte USI',             'Business Valuation Intern',               'Consulting & Professional Services',       1.20, '26th August,2026'],
  ['mahika_d28@iift.edu',        '25D', 'Mahika Kathuria',         OPP.titan,            'Titan',                    'Sales and Marketing',                     'Retail, Lifestyle & E-Commerce',           1.80, '21st August,2026'],
  ['marian_d28@iift.edu',        '26D', 'Marian Michael',          OPP.lighthouse,       'Lighthouse Canton',        'Investment Banking Client Advisory',       'Banking & Financial Services',             1.00, '1st September, 2026'],
  ['molly_d28@iift.edu',         '27D', 'Molly Rastogi',           OPP.godrej_properties,'Godrej Properties',        'Sales and Marketing',                     'Real Estate & Infrastructure',             2.25, '27th July, 2026'],
  ['mradul_d28@iift.edu',        '28D', 'Mradul Yadav',            OPP.wipro,            'Wipro Consulting',         'Use Case Solution Consultant - Agentic AI','Consulting & Professional Services',      1.00, '31st August, 2026'],
  ['parth_d28@iift.edu',         '30D', 'Parth Garg',              OPP.dabur,            'Dabur',                    'Sales and Marketing',                     'FMCG & Consumer Products',                 1.50, '2nd September,2026'],
  ['samikshaa_d28@iift.edu',     '35D', 'Samikshaa Bajaria',       OPP.snabbit,          'Snabbit',                  '',                                        'Retail, Lifestyle & E-Commerce',           1.25, '24th August, 2026'],
  ['samridh_d28@iift.edu',       '36D', 'Samridh Shakya',          OPP.alvarez_marsal,   'Alvarez & Marsal',         '',                                        'Consulting & Professional Services',       1.50, '25th August,2026'],
  ['shah_d28@iift.edu',          '37D', 'Pranshav Shah',           OPP.ey,               'EY',                       'Consulting',                              'Consulting & Professional Services',       1.00, '4th September, 2026'],
  ['shivamk_d28@iift.edu',       '38D', 'Shivam Prashant Kothare', OPP.tata_steel_sc,    'Tata Steel',               'Supply Chain Management',                 'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['shreyapandey_d28@iift.edu',  '40D', 'Shreya Pandey',           OPP.jp_morgan,        'JP Morgan Chase',          'IB Credit Risk',                          'Banking & Financial Services',             1.85, '8th August, 2026'],
  ['shristi_d28@iift.edu',       '42D', 'Shristi Agarwal',         OPP.goldman_sachs,    'Goldman Sachs',            'Credit Risk',                             'Banking & Financial Services',             1.60, '4th August, 2026'],
  ['tanisha_d28@iift.edu',       '44D', 'Tanisha Manoj Agarwal',   OPP.tata_steel_sc,    'Tata Steel',               'Supply Chain Management',                 'Industrial, Manufacturing & Conglomerates',1.00, '7th September, 2026'],
  ['tushank_d28@iift.edu',       '47D', 'Tushank Arora',           OPP.tas,              'TAS',                      'Leadership Program',                      'Leadership Programmes & Others',           1.80, '11th August, 2026'],
  ['vaani_d28@iift.edu',         '48D', 'Vaani Gunwant',           OPP.hero_moto,        'Hero MotoCorp',            'Sales and Marketing Intern',              'Automotive',                               1.25, '10th September, 2026'],
  ['vasu_d28@iift.edu',          '49D', 'Vasu Sustani',            OPP.reliance,         'Reliance',                 'General Management',                      'Leadership Programmes & Others',           1.50, '29 August, 2026'],

  // ── BA Section A ──
  ['Anubhav_ba28@iift.edu',      '3A',  'Anubhav Dutt Lakhera',    OPP.valorant,         'Valorant Consulting',      'Senior Consultant',                       'Consulting & Professional Services',       1.50, '10th September, 2026'],
  ['anurag_ba28@iift.edu',       '4A',  'Anurag R Mundle',         OPP.bny_mellon,       'BNY Mellon',               'Finance',                                 'Banking & Financial Services',             1.20, '25th August, 2026'],
  ['arjun_ba28@iift.edu',        '5A',  'Arjun Singh',             OPP.aditya_birla_cap, 'Aditya Birla Capital',     'Specialist',                              'Banking & Financial Services',             1.00, '18th August,2026'],
  ['ayushsoni_ba28@iift.edu',    '8A',  'Ayush Soni',              OPP.aditya_birla_cap, 'Aditya Birla Capital',     'Generalist',                              'Banking & Financial Services',             1.00, '18th August,2026'],
  ['chirayu_ba28@iift.edu',      '11A', 'Chirayu Aggarwal',        OPP.aditya_birla_cap, 'Aditya Birla Capital',     'Generalist',                              'Banking & Financial Services',             1.00, '18th August,2026'],
  ['chirayud_ba28@iift.edu',     '12A', 'Chirayu Dhuratkar',       OPP.accenture,        'Accenture Strategy',       'Strategy & Consulting',                   'Consulting & Professional Services',       2.00, '21st August,2026'],
  ['kriti_ba28@iift.edu',        '25A', 'Kriti Menon',             OPP.jp_morgan,        'JP Morgan Chase',          'AWM Risk Analytics',                      'Banking & Financial Services',             1.85, '8th August, 2026'],
  ['kritika_ba28@iift.edu',      '26A', 'Kritika Porwal',          OPP.amazon_ace,       'Amazon',                   'Operations',                              'Retail, Lifestyle & E-Commerce',           2.50, '4th September, 2026'],
  ['kshitij_ba28@iift.edu',      '27A', 'Kshitij Sharma',          OPP.jp_morgan,        'JP Morgan Chase',          'CIB R&A - Banking',                       'Banking & Financial Services',             2.05, '5th August, 2026'],
  ['mohith_ba28@iift.edu',       '28A', 'Mohith R',                OPP.jiostar,          'JioStar',                  'Marketing Analytics',                     'Technology & Telecom',                     1.80, '25th August, 2026'],
  ['poonam_ba28@iift.edu',       '31A', 'Poonam Sharma',           OPP.hsbc,             'HSBC',                     'Analyst',                                 'Banking & Financial Services',             0.90, '4th September, 2026'],
  ['prachi_ba28@iift.edu',       '32A', 'Prachi Thakur',           OPP.aditya_birla_cap, 'Aditya Birla Capital',     'Generalist',                              'Banking & Financial Services',             1.00, '18th August,2026'],
  ['ramandeep_ba28@iift.edu',    '35A', 'Ramandeep Singh',         OPP.galderma_grad,    'Galderma',                 'Marketing',                               'Pharma, Healthcare & Life Sciences',       1.80, '20th August,2026'],
  ['sameeksha_ba28@iift.edu',    '38A', 'Sameeksha P',             OPP.pwc_ac,           'PwC AC',                   'Finance Solutions',                       'Consulting & Professional Services',       1.75, '3rd September, 2026'],
  ['shweta_ba28@iift.edu',       '41A', 'Shweta Bahal',            OPP.jp_morgan,        'JP Morgan Chase',          'PB Credit Risk',                          'Banking & Financial Services',             1.85, '8th August, 2026'],
  ['spandan_ba28@iift.edu',      '42A', 'Spandan Sahu',            OPP.synergy,          'Synergy Consulting',       'Corporate and Project Finance',           'Consulting & Professional Services',       1.50, '13th August, 2026'],
  ['tanvi_ba28@iift.edu',        '46A', 'Tanvi Thakur',            OPP.aditya_birla_cap, 'Aditya Birla Capital',     'Specialist',                              'Banking & Financial Services',             1.00, '18th August,2026'],
  ['tisha_ba28@iift.edu',        '47A', 'Tisha',                   OPP.bny_mellon,       'BNY Mellon',               'Risk & Compliance',                       'Banking & Financial Services',             1.20, '24th August, 2026'],
  ['tridip_ba28@iift.edu',       '48A', 'Tridip Chetry',           OPP.britannia,        'Britannia',                'Supply Chain Management Intern (Procurement)','FMCG & Consumer Products',             1.00, '10th September, 2026'],
  ['vibhav_ba28@iift.edu',       '50A', 'Vibhav Harit',            OPP.jp_morgan,        'JP Morgan Chase',          'CIB R&A - Banking',                       'Banking & Financial Services',             2.05, '5th August, 2026'],
  ['yashonandani_ba28@iift.edu', '56A', 'Yashonandani Bhargava',   OPP.ey,               'EY',                       'Consulting',                              'Consulting & Professional Services',       1.00, '4th September, 2026'],
  ['utkarsh_ba28@iift.edu',      '57A', 'Utkarsh Aggarwal',        OPP.bny_mellon,       'BNY Mellon',               'Risk & Compliance',                       'Banking & Financial Services',             1.20, '24th August, 2026'],
]

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
  // Track which opp IDs had students placed → mark them closed at the end
  const oppIdsToClose = new Set()
  const auditEntries = []
  let matched = 0, skipped = 0, notFound = 0

  for (const row of PLACED) {
    const [email, roll, name, rawOppId, company, role, sector, stipendLakhs, dop] = row
    const oppId = rawOppId

    // 1. Find student doc
    const studentSnap = await db.collection('students')
      .where('Official Institute Email ID', '==', email)
      .limit(1).get()

    if (studentSnap.empty) {
      console.warn(`  ⚠️  NOT FOUND: ${email}`)
      notFound++
      continue
    }

    const studentDoc = studentSnap.docs[0]
    const existing = studentDoc.data()

    if (existing._placed_summer && existing._placement_summer?.company === company) {
      console.log(`  ⏭  already placed: ${roll} ${name} @ ${company}`)
      skipped++
      continue
    }

    const date = parseDate(dop)
    const placementData = {
      date,
      company,
      role:    role || '',
      sector:  sector || '',
      location: 'Domestic',
      package: stipendLakhs ? `${stipendLakhs} Lakh/month` : '',
      via:     oppId === 'DIRECT' ? 'Campus Placement' : `Activity — ${company} | Summer Internship`,
      ctcNotes: '',
      placedAtIso: date ? new Date(`${date}T00:00:00`).toISOString() : new Date().toISOString(),
    }

    // 2. Update student doc
    await studentDoc.ref.update({
      _placed_summer:    true,
      _placement_summer: placementData,
      updatedAt:         Timestamp.now(),
    })

    // 3. Write to opportunity applicants subcollection (skip for DIRECT hires)
    if (oppId !== 'DIRECT') {
      const applicantDocId = roll || email
      await db.collection('opportunities').doc(oppId)
        .collection('applicants').doc(applicantDocId)
        .set({
          roll,
          email,
          name,
          role:      role || '',
          status:    'selected',
          updatedAt: Timestamp.now(),
        }, { merge: true })

      oppIdsToClose.add(oppId)
    }

    auditEntries.push({
      type:       'place_summer_backfill',
      studentId:  studentDoc.id,
      studentRoll: roll,
      studentName: name,
      email,
      company,
      role,
      stipend:    stipendLakhs,
      dop:        date,
      oppId:      oppId === 'DIRECT' ? null : oppId,
      by:         DONE_BY,
      at:         Timestamp.now(),
    })

    console.log(`  ✓  ${roll} ${name} → ${company} | ${role} | ${date}`)
    matched++
  }

  // 4. Write a 'selected' stage + close each opportunity that had placements
  for (const oppId of oppIdsToClose) {
    await db.collection('opportunities').doc(oppId).collection('stages').add({
      type:      'selected',
      message:   'Summer placements backfilled from placement data (BO\'28)',
      createdAt: Timestamp.now(),
      createdBy: DONE_BY,
    })
    await db.collection('opportunities').doc(oppId).update({
      status:    'closed',
      updatedAt: Timestamp.now(),
    })
    console.log(`  📌 Closed opp ${oppId}`)
  }

  // 5. Audit log
  if (auditEntries.length > 0) {
    const CHUNK = 499
    for (let i = 0; i < auditEntries.length; i += CHUNK) {
      const batch = db.batch()
      for (const entry of auditEntries.slice(i, i + CHUNK)) {
        batch.set(db.collection('auditLog').doc(), entry)
      }
      await batch.commit()
    }
    console.log(`\n  📋 ${auditEntries.length} audit log entries written.`)
  }

  console.log(`
✅ Done.
   Students updated   : ${matched}
   Already placed     : ${skipped}
   Not found          : ${notFound}
   Opportunities closed: ${oppIdsToClose.size}
  `)
}

run().catch(e => { console.error(e); process.exit(1) })
