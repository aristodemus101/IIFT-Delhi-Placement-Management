/**
 * Accessibility tests — WCAG 2.1 AA compliance via axe-core.
 *
 * Tests run in jsdom (not a real browser). Key constraints:
 *   - All snippets are wrapped in <main> to satisfy the landmark/region rule.
 *     Real pages satisfy this via Layout.jsx — we don't re-test that here.
 *   - Color contrast is partially checked: axe can verify inline hex values
 *     but marks computed styles as "incomplete" in jsdom (no layout engine).
 *     We test known design-system color pairs directly.
 *   - Focus management (modal trap, restore on close) is behavioural and
 *     covered by the E2E logic tests — not structural axe checks.
 *
 * Coverage: structural ARIA, form labels, button names, table headers,
 * image alt text, heading hierarchy, keyboard semantics, color contrast
 * on known pairs, landmark usage.
 */

// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import axe from 'axe-core'

axe.configure({ allowedOrigins: ['<unsafe_all_origins>'] })

const AXE_OPTIONS = {
  runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'best-practice'] },
}

// Wrap snippet in a full page skeleton so landmark rules are satisfied
// and axe focuses on the actual component semantics we care about.
function wrap(inner) {
  return `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><main>${inner}</main></body></html>`
}

async function audit(html) {
  document.documentElement.innerHTML = html
  const results = await axe.run(document.body, AXE_OPTIONS)
  return results.violations
}

function fmt(violations) {
  if (!violations.length) return ''
  return '\n' + violations.map(v =>
    `  [${v.id}] ${v.description} (${v.impact})\n  → ${v.nodes.map(n => n.html).join('\n  → ')}`
  ).join('\n')
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. Page structure — landmarks and headings
// ══════════════════════════════════════════════════════════════════════════════

describe('Page structure', () => {
  it('full page with nav + main + footer passes', async () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>PlacementOS</title></head><body>
      <header role="banner"><h1>PlacementOS</h1></header>
      <nav aria-label="Main navigation">
        <a href="/">Dashboard</a>
        <a href="/roster">Roster</a>
      </nav>
      <main id="main-content">
        <h2>Dashboard</h2>
        <p>Overview content</p>
      </main>
    </body></html>`
    const violations = await audit(html)
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('heading hierarchy h1 → h2 → h3 passes', async () => {
    const violations = await audit(wrap(`
      <h1>PlacementOS</h1>
      <h2>Student Roster</h2>
      <h3>Filters</h3>
      <p>Content</p>
    `))
    const headingViolations = violations.filter(v => v.id === 'heading-order')
    expect(headingViolations, fmt(headingViolations)).toHaveLength(0)
  })

  it('heading hierarchy skipping h2 is a violation', async () => {
    const violations = await audit(wrap(`<h1>Page</h1><h3>Section — skipped h2</h3><p>content</p>`))
    const headingViolation = violations.find(v => v.id === 'heading-order')
    expect(headingViolation).toBeDefined()
  })

  it('html element must have lang attribute', async () => {
    // Must audit document.documentElement so axe can evaluate the <html> element itself.
    // Our audit() helper only passes document.body — use axe.run directly here.
    document.documentElement.innerHTML = `<head><title>Test</title></head><body><main><p>Content</p></main></body>`
    document.documentElement.removeAttribute('lang')
    const results = await axe.run(document.documentElement, AXE_OPTIONS)
    const langViolation = results.violations.find(v => v.id === 'html-has-lang')
    expect(langViolation).toBeDefined()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. Navigation
// ══════════════════════════════════════════════════════════════════════════════

describe('Navigation accessibility', () => {
  it('nav with aria-label and text links passes', async () => {
    const violations = await audit(`<!DOCTYPE html><html lang="en"><head><title>T</title></head><body>
      <nav aria-label="Main navigation">
        <a href="/" aria-current="page">Dashboard</a>
        <a href="/roster">Roster</a>
        <a href="/placed">Placed</a>
        <a href="/intel">Intel</a>
      </nav>
      <main><h1>Content</h1></main>
    </body></html>`)
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('icon-only link without aria-label is a violation', async () => {
    const violations = await audit(wrap(`
      <nav aria-label="Main navigation">
        <a href="/roster">
          <svg aria-hidden="true" width="16" height="16"><rect width="16" height="16"/></svg>
        </a>
      </nav>
    `))
    const linkViolation = violations.find(v => v.id === 'link-name')
    expect(linkViolation).toBeDefined()
  })

  it('icon links with aria-label pass', async () => {
    const violations = await audit(wrap(`
      <nav aria-label="Main navigation">
        <a href="/roster" aria-label="Roster">
          <svg aria-hidden="true" width="16" height="16"><rect/></svg>
        </a>
        <a href="/placed" aria-label="Placed">
          <svg aria-hidden="true" width="16" height="16"><rect/></svg>
        </a>
      </nav>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. Forms — labels and inputs
// ══════════════════════════════════════════════════════════════════════════════

describe('Form accessibility', () => {
  it('input without any label association is a violation', async () => {
    // placeholder satisfies axe's label heuristic — use no placeholder and no label.
    const violations = await audit(wrap(`<form><input type="text" /></form>`))
    const labelViolation = violations.find(v => v.id === 'label')
    expect(labelViolation).toBeDefined()
  })

  it('input with aria-label passes', async () => {
    const violations = await audit(wrap(`
      <form>
        <input type="search" aria-label="Search students" placeholder="Search…" />
      </form>
    `))
    const labelViolations = violations.filter(v => v.id === 'label')
    expect(labelViolations, fmt(labelViolations)).toHaveLength(0)
  })

  it('input with associated for/id label passes', async () => {
    const violations = await audit(wrap(`
      <form>
        <label for="name">Full Name</label>
        <input id="name" type="text" />
      </form>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('select without label is a violation', async () => {
    // axe reports unlabelled <select> as 'select-name', not 'label'
    const violations = await audit(wrap(`<form><select><option>Option 1</option></select></form>`))
    const selectViolation = violations.find(v => v.id === 'select-name' || v.id === 'label')
    expect(selectViolation).toBeDefined()
  })

  it('select with aria-label passes', async () => {
    const violations = await audit(wrap(`
      <form>
        <select aria-label="Filter by cohort">
          <option value="">All cohorts</option>
          <option value="27-Delhi-IB">27 Delhi IB</option>
        </select>
      </form>
    `))
    const labelViolations = violations.filter(v => v.id === 'label')
    expect(labelViolations, fmt(labelViolations)).toHaveLength(0)
  })

  it('filter bar with multiple labelled controls passes', async () => {
    const violations = await audit(wrap(`
      <form role="search" aria-label="Filter roster">
        <input type="search" aria-label="Search students" />
        <select aria-label="Filter by sector"><option>All sectors</option></select>
        <select aria-label="Filter by year"><option>All years</option></select>
        <select aria-label="Filter by cycle"><option>All cycles</option></select>
      </form>
    `))
    const labelViolations = violations.filter(v => v.id === 'label')
    expect(labelViolations, fmt(labelViolations)).toHaveLength(0)
  })

  it('required field without aria-required still passes (aria-required is advisory)', async () => {
    const violations = await audit(wrap(`
      <form>
        <label for="company">Company <span aria-hidden="true">*</span></label>
        <input id="company" type="text" required aria-required="true" />
      </form>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. Buttons
// ══════════════════════════════════════════════════════════════════════════════

describe('Button accessibility', () => {
  it('button with no accessible name is a violation', async () => {
    const violations = await audit(wrap(`
      <button>
        <svg width="16" height="16"><path d="M1 1l14 14"/></svg>
      </button>
    `))
    const btnViolation = violations.find(v => v.id === 'button-name')
    expect(btnViolation).toBeDefined()
  })

  it('icon button with aria-label passes', async () => {
    const violations = await audit(wrap(`
      <button aria-label="Close modal">
        <svg width="16" height="16" aria-hidden="true"><path/></svg>
      </button>
    `))
    const btnViolations = violations.filter(v => v.id === 'button-name')
    expect(btnViolations, fmt(btnViolations)).toHaveLength(0)
  })

  it('icon button with visible text passes', async () => {
    const violations = await audit(wrap(`
      <button>
        <svg width="16" height="16" aria-hidden="true"><path/></svg>
        Add Record
      </button>
    `))
    const btnViolations = violations.filter(v => v.id === 'button-name')
    expect(btnViolations, fmt(btnViolations)).toHaveLength(0)
  })

  it('disabled button is accessible', async () => {
    const violations = await audit(wrap(`<button disabled>Save (disabled)</button>`))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('action toolbar with all icon buttons labelled passes', async () => {
    const violations = await audit(wrap(`
      <div role="toolbar" aria-label="Record actions">
        <button aria-label="Edit record">
          <svg aria-hidden="true" width="16" height="16"><path/></svg>
        </button>
        <button aria-label="Delete record">
          <svg aria-hidden="true" width="16" height="16"><path/></svg>
        </button>
        <button aria-label="Copy link">
          <svg aria-hidden="true" width="16" height="16"><path/></svg>
        </button>
      </div>
    `))
    const criticals = violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    expect(criticals, fmt(criticals)).toHaveLength(0)
  })

  it('context menu trigger with aria-haspopup passes', async () => {
    const violations = await audit(wrap(`
      <button aria-haspopup="menu" aria-expanded="false" aria-label="Record options">
        <svg aria-hidden="true" width="16" height="16"><circle cx="8" cy="8" r="1"/></svg>
      </button>
    `))
    const btnViolations = violations.filter(v => v.id === 'button-name')
    expect(btnViolations, fmt(btnViolations)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. Tables
// ══════════════════════════════════════════════════════════════════════════════

describe('Table accessibility', () => {
  it('table with caption and scope headers passes', async () => {
    const violations = await audit(wrap(`
      <table>
        <caption>Student Roster</caption>
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">Roll</th>
            <th scope="col">Cohort</th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Arjun Mehta</td>
            <td>D27-001</td>
            <td>27-Delhi-IB</td>
            <td>Placed</td>
          </tr>
        </tbody>
      </table>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('sortable column headers with aria-sort pass', async () => {
    const violations = await audit(wrap(`
      <table>
        <caption>Intel Records</caption>
        <thead>
          <tr>
            <th scope="col" aria-sort="ascending">
              <button>Company <span aria-hidden="true">↑</span></button>
            </th>
            <th scope="col" aria-sort="none">Year</th>
            <th scope="col" aria-sort="none">College</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>McKinsey</td><td>2025</td><td>IIM A</td></tr>
        </tbody>
      </table>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('table without any headers has no critical violations', async () => {
    const violations = await audit(wrap(`
      <table>
        <tbody>
          <tr><td>Name</td><td>Roll</td></tr>
          <tr><td>Arjun</td><td>D27-001</td></tr>
        </tbody>
      </table>
    `))
    const critical = violations.filter(v => v.impact === 'critical')
    expect(critical, fmt(critical)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. Modal dialogs
// ══════════════════════════════════════════════════════════════════════════════

describe('Modal accessibility', () => {
  it('dialog without accessible name is a violation', async () => {
    const violations = await audit(wrap(`
      <div role="dialog" aria-modal="true">
        <p>Modal content with no title</p>
        <button>Close</button>
      </div>
    `))
    const dialogViolation = violations.find(v => v.id === 'aria-dialog-name')
    expect(dialogViolation).toBeDefined()
  })

  it('well-formed modal with aria-labelledby passes', async () => {
    const violations = await audit(wrap(`
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title">Add Intel Record</h2>
        <form>
          <label for="company">Company Name</label>
          <input id="company" type="text" />
          <button type="submit">Save</button>
          <button type="button" aria-label="Close modal">×</button>
        </form>
      </div>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('place modal with full form passes', async () => {
    const violations = await audit(wrap(`
      <div role="dialog" aria-modal="true" aria-labelledby="place-title">
        <h2 id="place-title">Mark as Placed</h2>
        <form>
          <label for="place-company">Company</label>
          <input id="place-company" type="text" required aria-required="true" />
          <label for="place-role">Role</label>
          <input id="place-role" type="text" />
          <label for="place-via">Via</label>
          <select id="place-via">
            <option>Campus Drive</option>
            <option>PPO</option>
          </select>
          <button type="submit">Submit for Approval</button>
          <button type="button" aria-label="Cancel and close">Cancel</button>
        </form>
      </div>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. Status, alerts, live regions
// ══════════════════════════════════════════════════════════════════════════════

describe('Live regions and status', () => {
  it('polite live region for errors passes', async () => {
    const violations = await audit(wrap(`
      <div aria-live="polite" aria-atomic="true" role="alert">
        Could not save record. Please try again.
      </div>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('assertive alert for success toast passes', async () => {
    const violations = await audit(wrap(`
      <div role="alert" aria-live="assertive">
        Record saved successfully.
      </div>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('spinner with role=status and aria-label passes', async () => {
    const violations = await audit(wrap(`
      <div role="status" aria-label="Loading">
        <svg aria-hidden="true" width="24" height="24">
          <circle cx="12" cy="12" r="10" stroke="#ccc" fill="none"/>
        </svg>
      </div>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('progress bar with aria-valuenow passes', async () => {
    const violations = await audit(wrap(`
      <div role="progressbar"
           aria-valuenow="45"
           aria-valuemin="0"
           aria-valuemax="100"
           aria-label="Upload progress: 45%">
        45%
      </div>
    `))
    const criticals = violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    expect(criticals, fmt(criticals)).toHaveLength(0)
  })

  it('badge conveying status via text (not color alone) passes', async () => {
    const violations = await audit(wrap(`
      <span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:4px">At IIFT</span>
      <span style="background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:4px">IIFT Gap</span>
    `))
    const contrast = violations.filter(v => v.id === 'color-contrast')
    expect(contrast, fmt(contrast)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. Color contrast — design system pairs (inline hex values axe can verify)
// ══════════════════════════════════════════════════════════════════════════════

describe('Color contrast', () => {
  it('primary text #0f172a on white #ffffff passes 4.5:1', async () => {
    const violations = await audit(wrap(`
      <p style="background-color:#ffffff;color:#0f172a;font-size:14px">Arjun Mehta</p>
    `))
    expect(violations.filter(v => v.id === 'color-contrast'), fmt(violations)).toHaveLength(0)
  })

  it('secondary text #64748b on white passes 4.5:1', async () => {
    const violations = await audit(wrap(`
      <p style="background-color:#ffffff;color:#64748b;font-size:14px">D27-001</p>
    `))
    expect(violations.filter(v => v.id === 'color-contrast'), fmt(violations)).toHaveLength(0)
  })

  it('accent blue #3B5BDB on white passes for large text (18px bold)', async () => {
    const violations = await audit(wrap(`
      <h2 style="background-color:#ffffff;color:#3B5BDB;font-size:24px;font-weight:700">PlacementOS</h2>
    `))
    expect(violations.filter(v => v.id === 'color-contrast'), fmt(violations)).toHaveLength(0)
  })

  it('white on dark blue #1C3FAA passes 4.5:1', async () => {
    const violations = await audit(wrap(`
      <div style="background-color:#1C3FAA;color:#ffffff;font-size:14px;padding:16px">
        IIFT Delhi · Placement Cell
      </div>
    `))
    expect(violations.filter(v => v.id === 'color-contrast'), fmt(violations)).toHaveLength(0)
  })

  it('red error text #991b1b on red bg #fef2f2 passes', async () => {
    const violations = await audit(wrap(`
      <div style="background-color:#fef2f2;color:#991b1b;font-size:13px;padding:8px">
        Could not save. Please try again.
      </div>
    `))
    expect(violations.filter(v => v.id === 'color-contrast'), fmt(violations)).toHaveLength(0)
  })

  it('green success #166534 on green bg #dcfce7 passes', async () => {
    const violations = await audit(wrap(`
      <span style="background-color:#dcfce7;color:#166534;font-size:12px;padding:2px 8px">
        At IIFT
      </span>
    `))
    expect(violations.filter(v => v.id === 'color-contrast'), fmt(violations)).toHaveLength(0)
  })

  it('amber warning #854d0e on amber bg #fef9c3 passes', async () => {
    const violations = await audit(wrap(`
      <span style="background-color:#fef9c3;color:#854d0e;font-size:12px;padding:2px 8px">
        IIFT Gap
      </span>
    `))
    expect(violations.filter(v => v.id === 'color-contrast'), fmt(violations)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 9. Images and icons
// ══════════════════════════════════════════════════════════════════════════════

describe('Images and icons', () => {
  it('meaningful image with alt text passes', async () => {
    const violations = await audit(wrap(`<img src="/icons/icon-192.png" alt="PlacementOS app icon" />`))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('decorative image with empty alt passes', async () => {
    const violations = await audit(wrap(`<img src="/bg.png" alt="" role="presentation" />`))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('image without alt attribute is a violation', async () => {
    const violations = await audit(wrap(`<img src="/icons/icon-192.png" />`))
    const imgViolation = violations.find(v => v.id === 'image-alt')
    expect(imgViolation).toBeDefined()
  })

  it('decorative inline SVG with aria-hidden passes', async () => {
    const violations = await audit(wrap(`
      <button>
        <svg aria-hidden="true" width="16" height="16" focusable="false">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        Add Record
      </button>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 10. Keyboard / focus patterns
// ══════════════════════════════════════════════════════════════════════════════

describe('Keyboard accessibility', () => {
  it('standard interactive elements are natively focusable', async () => {
    const violations = await audit(wrap(`
      <button>Click</button>
      <a href="/roster">Roster</a>
      <input type="text" aria-label="Search" />
      <select aria-label="Filter"><option>All</option></select>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('positive tabindex is a best-practice violation', async () => {
    const violations = await audit(wrap(`
      <button tabindex="2">Disrupts tab order</button>
      <button>Normal button</button>
    `))
    const tabViolation = violations.find(v => v.id === 'tabindex')
    expect(tabViolation).toBeDefined()
  })

  it('tab panel structure with roles passes', async () => {
    const violations = await audit(wrap(`
      <div role="tablist" aria-label="Placement cycle">
        <button role="tab" aria-selected="true"  aria-controls="p-summer" id="t-summer">Summer</button>
        <button role="tab" aria-selected="false" aria-controls="p-final"  id="t-final">Final</button>
      </div>
      <div role="tabpanel" id="p-summer" aria-labelledby="t-summer">Summer placements</div>
      <div role="tabpanel" id="p-final"  aria-labelledby="t-final"  hidden>Final placements</div>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('div with tabindex=-1 (focus target for JS) has no critical issues', async () => {
    const violations = await audit(wrap(`
      <div tabindex="-1" id="modal-focus-target">
        <h2>Modal content</h2>
        <button>Close</button>
      </div>
    `))
    const critical = violations.filter(v => v.impact === 'critical')
    expect(critical, fmt(critical)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 11. Login page
// ══════════════════════════════════════════════════════════════════════════════

describe('Login page', () => {
  it('login page full structure passes', async () => {
    const violations = await audit(`<!DOCTYPE html><html lang="en"><head><title>Sign in — PlacementOS</title></head><body>
      <main>
        <section aria-label="Sign in">
          <h1>PlacementOS</h1>
          <h2>Sign in</h2>
          <p>Use your institute Google account to continue.</p>
          <button type="button">
            <svg aria-hidden="true" width="18" height="18"><path/></svg>
            Continue with Google
          </button>
          <p>Access is restricted to authorised placement team members only.</p>
        </section>
      </main>
    </body></html>`)
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('access denied page passes', async () => {
    const violations = await audit(`<!DOCTYPE html><html lang="en"><head><title>Access Denied — PlacementOS</title></head><body>
      <main>
        <div role="alert">
          <h1>Access Denied</h1>
          <p>Your email is not authorised to access this platform. Contact the placement team.</p>
        </div>
      </main>
    </body></html>`)
    expect(violations, fmt(violations)).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 12. Intel page patterns
// ══════════════════════════════════════════════════════════════════════════════

describe('Intel page patterns', () => {
  it('intel filter bar with all controls labelled passes', async () => {
    const violations = await audit(wrap(`
      <section aria-label="Intel filters">
        <input type="search" aria-label="Search companies, sectors, roles" />
        <select aria-label="Filter by college"><option>All colleges</option></select>
        <select aria-label="Filter by year"><option>All years</option></select>
        <select aria-label="Filter by cycle"><option>All cycles</option></select>
        <select aria-label="Filter by sector"><option>All sectors</option></select>
        <select aria-label="IIFT benchmark filter"><option>All</option></select>
      </section>
    `))
    const labelViolations = violations.filter(v => v.id === 'label')
    expect(labelViolations, fmt(labelViolations)).toHaveLength(0)
  })

  it('company drawer aside with tab structure passes', async () => {
    const violations = await audit(wrap(`
      <aside aria-label="McKinsey &amp; Company details">
        <h2>McKinsey &amp; Company</h2>
        <button aria-label="Close company details">×</button>
        <div role="tablist" aria-label="Company information tabs">
          <button role="tab" aria-selected="true"  id="t-ov"  aria-controls="p-ov">Overview</button>
          <button role="tab" aria-selected="false" id="t-hist" aria-controls="p-hist">History</button>
          <button role="tab" aria-selected="false" id="t-rec"  aria-controls="p-rec">Records</button>
          <button role="tab" aria-selected="false" id="t-poc"  aria-controls="p-poc">POC</button>
        </div>
        <div role="tabpanel" id="p-ov"   aria-labelledby="t-ov">
          <dl>
            <dt>Sector</dt><dd>Consulting</dd>
            <dt>IIFT Status</dt><dd>At IIFT</dd>
          </dl>
        </div>
        <div role="tabpanel" id="p-hist" aria-labelledby="t-hist" hidden>History content</div>
        <div role="tabpanel" id="p-rec"  aria-labelledby="t-rec"  hidden>Records content</div>
        <div role="tabpanel" id="p-poc"  aria-labelledby="t-poc"  hidden>POC content</div>
      </aside>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('intel edit modal with all fields labelled passes', async () => {
    const violations = await audit(wrap(`
      <div role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <h2 id="edit-title">Edit Intel Record</h2>
        <form>
          <label for="f-name">Company Name</label>
          <input id="f-name" type="text" required />
          <label for="f-year">Placement Year</label>
          <input id="f-year" type="number" min="2000" max="2030" />
          <label for="f-cycle">Cycle</label>
          <select id="f-cycle"><option>Finals</option><option>Summer</option></select>
          <label for="f-college">College</label>
          <input id="f-college" type="text" />
          <label for="f-sector">Sector</label>
          <select id="f-sector"><option>Consulting</option><option>BFSI</option></select>
          <button type="submit">Save Record</button>
          <button type="button" aria-label="Cancel and close">Cancel</button>
        </form>
      </div>
    `))
    expect(violations, fmt(violations)).toHaveLength(0)
  })

  it('upload modal progress state is accessible', async () => {
    const violations = await audit(wrap(`
      <div role="dialog" aria-modal="true" aria-labelledby="upload-title">
        <h2 id="upload-title">Upload Intel Report</h2>
        <div role="progressbar"
             aria-valuenow="60"
             aria-valuemin="0"
             aria-valuemax="100"
             aria-label="Uploading: 60 of 100 records">
          60%
        </div>
        <p aria-live="polite">Uploading 60 of 100 records…</p>
        <button type="button" aria-label="Cancel upload" disabled>Cancel</button>
      </div>
    `))
    const critical = violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    expect(critical, fmt(critical)).toHaveLength(0)
  })
})
