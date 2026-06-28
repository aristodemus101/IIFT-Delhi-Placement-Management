# Design System: PlacementOS

## 1. Visual Theme & Atmosphere

A data-dense, precision-engineered placement management interface. The atmosphere is clinical and information-forward — like a well-lit operations room. Nothing decorative earns a pixel unless it communicates hierarchy or state. Light mode defaults to cool blue-slate neutrals with a single assertive blue accent; dark mode becomes a deep purple-midnight canvas where data glows against near-black surfaces. Density is cockpit-high — tables, filters, stats, and controls share tight vertical rhythm with no wasted whitespace. Motion is restrained — transitions are CSS-only, used only to signal state change (focus rings, hover tints, backdrop blur on sticky headers). No spring physics, no staggered reveals, no perpetual animations.

- **Density:** 8/10 — Cockpit Dense
- **Variance:** 3/10 — Predictable Symmetric (dashboard-grade discipline)
- **Motion:** 2/10 — Static Restrained (CSS transitions only, purposeful)

---

## 2. Color Palette & Roles

### Light Mode (default)

- **Canvas** (`#ffffff`) — Page background and card fill
- **Muted Surface** (`#f5f5f5`) — Secondary surface: filter bars, table headers, input backgrounds
- **Whisper Border** (`#e0e0e0`) — Default 1px structural borders
- **Strong Border** (`#cbd5e1`) — Emphasized borders and dividers
- **Ink** (`#0f172a`) — Primary text (Slate-950)
- **Muted Ink** (`#64748b`) — Secondary text, descriptions, metadata labels
- **Ghost Ink** (`#94a3b8`) — Tertiary text, placeholders, empty state copy
- **Accent Blue** (`#2563eb`) — Single primary accent: CTA buttons, active nav, focus rings
- **Accent Deep** (`#1e3a8a`) — Accent pressed/hover, role chip text, sidebar icon bg
- **Accent Tint** (`#eff6ff`) — Active nav backgrounds, selected filter pills
- **Workspace Tint** (`#f8fafc`) — Main content area background (slightly cooler than white)
- **Workspace Border** (`#dbeafe`) — Main area top border stripe (summer/final cycle indicator)

### Semantic Status Colors

- **Emerald** (`#10b981`) / bg `rgba(16,185,129,0.12)` / text `#047857` / border `rgba(16,185,129,0.35)` — Placed, success, active states
- **Amber** (`#f59e0b`) / bg `rgba(245,158,11,0.12)` / text `#b45309` / border `rgba(245,158,11,0.35)` — Summer cycle, pending, warning
- **Red** (`#ef4444`) / bg `rgba(239,68,68,0.12)` / text `#dc2626` / border `rgba(239,68,68,0.35)` — Danger actions, rejected, unplaced
- **Indigo** (`#6366f1`) / bg `rgba(99,102,241,0.12)` / text `#4338ca` — Special status badges

### Dark Mode

- **Canvas Dark** (`#13131e`) — Page background
- **Surface Dark** (`#171724`) — Card and container fill
- **Border Dark** (`#1e1e2e`) — Default borders
- **Strong Border Dark** (`#2a2a3d`) — Emphasized borders
- **Text Light** (`#f1f1f3`) — Primary text
- **Muted Light** (`#8a8a9a`) — Secondary text
- **Ghost Light** (`#55556a`) — Tertiary text
- **Accent Blue Dark** (`#3b82f6`) — Primary accent (slightly lighter for contrast on dark)
- **Accent Dark Mode Deep** (`#1d4ed8`) — Hover/pressed accent
- **Accent Dark Mode Tint** (`rgba(59,130,246,0.14)`) — Active state backgrounds

---

## 3. Typography Rules

- **Font Stack:** `Inter, 'Segoe UI', Helvetica, Arial, sans-serif` — system-native fallback chain. Inter is the intentional choice for this cockpit-dense dashboard; no substitution.
- **Mono Font:** `'DM Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` — used for code values, IDs, roll numbers, timestamps
- **Page Titles (h1):** 22px / weight 800 / letter-spacing `-0.03em` / line-height tight — drives hierarchy through weight and tight tracking, not size
- **Section Labels / Table Headers:** 11px / weight 600 / `uppercase` / letter-spacing `0.04em` — uppercase small-caps pattern throughout all column headers and category labels
- **Body / Cell Text:** 13px / weight 400-500 — default for all table cells, descriptions, and metadata
- **Small Labels / Badges:** 11-12px / weight 500-600
- **Stat Values (StatCard):** 40px / weight 600 / letter-spacing `-0.02em` / line-height 1 — large numerics for dashboard KPIs
- **Max line length:** ~65ch for descriptive text. Never let body copy run full-width.

---

## 4. Component Stylings

### Buttons (`Btn`)
- **Shape:** 8px radius (`--radius-sm`) — compact, professional
- **Sizes:** `sm` → `6px 11px` padding / 12px text; `md` → `8px 14px` / 13px text
- **Primary:** Solid accent fill (`#2563eb`), white text, no border
- **Default:** White/surface background, `--border` 1px stroke, primary text
- **Ghost:** Transparent background, no border, muted text — used for secondary actions
- **Danger:** Red-tinted background, red text, red border — destructive actions only
- **Disabled:** `opacity: 0.5`, `cursor: not-allowed` — no alternative styling
- **No hover states in code** — buttons rely on OS/browser default cursor feedback only
- **No outer glow, no neon, no drop shadows on buttons**

### Badges (`Badge`)
- **Shape:** `border-radius: 20px` (pill), `2px 7px` padding, 11px text / weight 500
- **Semantic colors only:** gray / green / amber / red / blue / purple
- **Always paired with a 1px semantic border** — never borderless badges

### Inputs (`Input`)
- **Height:** 36px, `10px` horizontal padding, `border-radius: 12px`
- **Background:** `--surface2` (muted surface), 1px `--border` stroke
- **Focus state:** Border snaps to `--accent`, ring of `0 0 0 3px color-mix(in srgb, var(--accent) 18%, transparent)` — subtle glow, not neon
- **No floating labels** — all labels are above or inline, never floating/overlapping

### Select (`Select`)
- **Height:** 40px, `0 38px 0 12px` padding (room for custom arrow), `border-radius: 14px`
- **Custom arrow:** SVG chevron at `right 12px center`, no native appearance
- **Width:** `100%` by default — always pass `style={{ width: 'auto' }}` inside flex filter bars to prevent full-width stretch
- **Focus + hover:** Same ring pattern as Input; hover lightens background with `color-mix`
- **Transition:** `border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease`

### StatCard
- **Shape:** `16px` radius, `16px 20px` padding, `min-height: 132px`
- **Background:** `--surface` with `--shadow-sm` (`0 2px 6px rgba(15,23,42,0.06)`)
- **Label:** 11px uppercase, letter-spacing `0.04em`, `--text-3` color
- **Value:** 40px / weight 600 / letter-spacing `-0.02em` — large, number-dominant
- **Sub:** 12px `--text-3` — supporting context line

### Table (`Table`)
- **Header cells:** 11px / weight 600 / uppercase / letter-spacing `0.04em` / `--text-3` — matches StatCard labels
- **Header background:** `color-mix(in srgb, var(--surface2) 85%, transparent)` — semi-transparent frosted tint
- **Cell padding:** `9px 14px` — comfortable but tight
- **Row hover:** Cells individually get `color-mix(in srgb, var(--surface2) 75%, transparent)` tint on `mouseEnter` / cleared on `mouseLeave`
- **Row border:** 1px `--border` bottom only — no vertical cell borders
- **Context menu:** `onContextMenu` on rows for in-place actions (no inline action columns)
- **Empty state:** Centered text in `--text-3`, 40px vertical padding — no illustration

### Modal (`Modal`)
- **Shape:** `border-radius: 20px`, `border: 1px solid --border`
- **Shadow:** `--shadow` (`0 8px 24px rgba(15,23,42,0.08)`)
- **Backdrop:** `rgba(0,0,0,0.35)` full-screen overlay
- **Max height:** `85vh` with `overflow-y: auto`
- **Width:** Passed as prop, default 520px — always `maxWidth: 100%` for mobile
- **Close:** Click backdrop or explicit close button — `closeOnBackdropClick` prop controls this

### PageHeader
- **Position:** `sticky top: 0`, `z-index: 10`
- **Background:** `color-mix(in srgb, var(--surface) 88%, transparent)` + `backdropFilter: blur(20px)` — frosted glass over scrolling content
- **Padding:** `14px 28px 10px` with `1px solid --border` bottom
- **Title:** h1 at 22px / weight 800 / tracking `-0.03em`
- **Actions:** flex-end row of Btn components at right of header

### Filter Pills (sidebar cohort picker, roster filters)
- **Shape:** `border-radius: 20px` pill, `3px 10px` padding, 11px / weight 600
- **Active state:** Accent tint background + accent-dark text + accent-tinted border
- **Inactive state:** `--surface` background + `--text-2` text + `--border` border

### Navigation (sidebar)
- **Active link:** Accent tint background + accent-dark text + `35%` accent border — matches pill pattern
- **Inactive link:** Transparent background + `--text-2` — no underline, no left border accent strip
- **Sidebar header:** Accent-dark square icon (`34px`, `--radius-sm`) + "PlacementOS" bold wordmark
- **User row:** Avatar (28px circle) + name + role chip (10px uppercase, role-specific color)
- **Notification badges on nav:** Accent-dark fill, white text, `border-radius: 999`

### Loading States
- No generic spinners. Use text "Loading…" at `--text-3` in appropriate containers.
- Skeleton loaders not implemented — tables show empty state immediately then populate.

### Empty States
- Centered `--text-3` text only. Simple, no illustration.

---

## 5. Layout Principles

- **Sidebar + main content:** Horizontal flex at full height. Sidebar has `1px solid --border` right edge. Main content area has `2px solid --workspace-border` top edge (role/cycle-tinted).
- **Main area background:** `--workspace-bg` (`#f8fafc` light / `rgba(59,130,246,0.08)` dark) — visually distinct from sidebar
- **PageHeader sticky pattern:** Every page uses a sticky frosted header at top with title + actions, scrollable content below.
- **Filter bars:** Horizontal flex wrap with `--surface2` background, `--border` border, `--radius-sm` radius, `8px` gap padding. Filters wrap on narrow viewports.
- **Stat rows:** Horizontal flex wrap of `StatCard` components with `flex: 1, minWidth: 120px` — auto-wraps into columns on narrow screens.
- **Tables:** Full-width inside scroll containers with `overflow-x: auto`. No fixed column widths — `whiteSpace: nowrap` on cells.
- **Modals:** Portal-rendered, centered in viewport. Never full-screen.
- **No CSS calc() hacks.** No absolute-positioned stacking of content layers.
- **Max content width:** Not globally constrained — uses available viewport. Sidebar constrains left, content fills remainder.
- **Responsive:** Sidebar converts to horizontal top bar on narrow viewports (`isNarrowViewport`). Filter bars wrap. No horizontal scroll on page level.

---

## 6. Motion & Interaction

- **Transitions:** `0.16s ease` on interactive elements (border-color, box-shadow, background-color). No spring physics.
- **Input/Select focus:** Border + ring appear at 0.16s ease — only state transition with visual motion
- **Table row hover:** Immediate (no transition) — mouse feedback must be instant for dense tables
- **Sticky header backdrop blur:** CSS `backdrop-filter: blur(20px)` — hardware-accelerated, no JS
- **No staggered list reveals.** No cascade animations. No perpetual micro-loops.
- **No page transition animations** — route changes are instant.

---

## 7. Anti-Patterns (Banned)

- No `border-radius` larger than `20px` on interactive elements (modals may use up to `20px`; nothing uses `2.5rem+`)
- No drop shadows on buttons — only cards and modals get shadows
- No neon glow effects — focus rings use `color-mix` with `18%` opacity, never full-saturation
- No gradient backgrounds on any surface
- No gradient text on headers
- No emojis in UI copy
- No decorative illustrations or spot art in empty states
- No full-screen modals
- No infinite loading spinners — fail visibly with error messages
- No `h-screen` — use `min-h-[100dvh]` or explicit height on the root flex container
- No custom mouse cursors
- No overlapping elements — every element occupies its own spatial zone
- No `calc()` percentage hacks for layout
- No `Inter` replacement — the current font stack is intentional for this dashboard context
- No serif fonts anywhere
- No AI copywriting clichés in UI labels ("Elevate", "Seamless", "Unleash", "Next-Gen")
- No generic placeholder names in any admin-facing UI
- No pure black (`#000000`) — use `#0f172a` (Slate-950) as the darkest text value
- Do not add color accents beyond the defined semantic palette (green/amber/red/indigo/blue)
- Do not add motion where the current system has none — this is a deliberate, restrained choice for a data-dense tool
