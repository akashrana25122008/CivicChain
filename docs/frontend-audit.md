# CivicChain Frontend Audit (read-only)

**Scope:** `/Users/m4/civicchain/civicchain` — Next.js 16 App Router, React 19, Tailwind v4, framer-motion.
**Mode:** read-only research. No files were modified.
**Date:** 2026-08-30

---

## 1. Layout / Shell

### 1.1 Root layout — `src/app/layout.tsx`
- Loads three Google Fonts via `next/font`: `Playfair_Display` (display serif), `DM_Sans` (body), `JetBrains_Mono` (labels/IDs).
- Imports `src/app/globals.css`; defines `metadata`.
- Wrapped in `<SessionProvider>` (Cloudflare/`SessionProvider` + auth context used by the workspace shell).

### 1.2 Workspace shell — `src/components/layout/AppShell.tsx` (canonical, 420 lines)
- **`HEADER_META` map (lines 34–59):** maps every route prefix to a header title/description — covers `/report`, `/my-reports`, `/map`, `/dashboard/*`, `/department/*`, `/admin/*`.
- **`headerFor(pathname)` (61–69):** resolves the active page's header meta; falls back to a capitalized label from the last URL segment.
- **`isActive()` (71–77):** special-cases `/map` to also match `/dashboard/map`; otherwise exact prefix match.
- **`useUnreadCount()` (96–103):** polls `/api/notifications` every 60s for `unreadCount`.
- **Phone/desktop nav:** fixed left sidebar (`hidden lg:flex lg:w-64`, lines 254–260), mobile drawer via `AnimatePresence` + `motion.aside` slide-in (lines 263–297), sticky top header with `backdrop-blur` (302–403).
- **BrandMark (105–118):** SVG civic-building logo + "CivicChain" wordmark.
- **NavList (120–177):** unread badge on the notifications item.
- **UserBlock (179–211):** avatar + name + role label + Sign Out.
- **Header profile menu (337–400):** avatar, role pill, "Profile & Settings" link to `/dashboard/settings`, Sign Out.
- Accessibility details: `aria-expanded`/`aria-haspopup` on profile button, `role="menu"`, Escape-to-close + outside-click handlers (231–249), `useReducedMotion()` respected.
- Auth note (comment 20–27): role decided server-side; this component only renders the signed-in workspace.

### 1.3 Workspace nav source of truth — `src/components/layout/workspaceNav.ts` (130 lines)
- **`ROLE_LABELS` (38–42):** CITIZEN = "Citizen Reporter", AUTHORITY = "Civic Authority", ADMIN = "Administrator".
- **`homeFor(role)` (45–54):** ADMIN→`/admin/dashboard`, AUTHORITY→`/department/dashboard`, default→`/dashboard`.
- **`navForRole()` (56–129):**
  - AUTHORITY groups: "Operations" (Dashboard, Issues, Verification, Escalations, Performance), "Intelligence" (Map), "System" (Notifications, Profile).
  - ADMIN groups: "Control Center" (Dashboard, Users, Departments, Issues, Analytics), "Oversight" (Map, Audit Logs, System Health), "System" (Notifications, Profile).
  - CITIZEN groups: "My Workspace" (Dashboard, Report an Issue, My Reports, Map), "System" (Notifications, Profile).
- No stubs — every route listed is implemented (comment 19–23).

### 1.4 Legacy/unused nav — `src/components/layout/Navigation.tsx`
- Exports `SidebarShell` (line 345), `DashboardSidebar` (443–444), `DepartmentSidebar` (447–448), `AdminSidebar` (451–452).
- **Dead code findings:** a repo-wide grep for `SidebarShell|DashboardSidebar|DepartmentSidebar|AdminSidebar` finds **zero** importers outside the defining file. **Only the plain `Navigation` export is used**, and only by `src/app/login/page.tsx` (line 4) and `src/app/register/page.tsx` (line 4). The role-specific `<*>Sidebar` components are superseded by `workspaceNav.ts` + `AppShell`. This is the component that was *confused for* `AppShell` — they are separate; `AppShell` is the live shell.
- Final disclaimer "not present in conversation" checklist: **`Navigation.tsx`'s role sidebars are dead code — verified by grep.** The `AppShell` is the single canonical shell.

### 1.5 Footer — `src/components/layout/Footer.tsx`
- Landing footer; used on `src/app/page.tsx` (line 17).

---

## 2. Theme Tokens & Motion

### 2.1 CSS tokens — `src/app/globals.css`
- Uses `@theme inline`: `brand-*` (primary scale), `accent-*`, `status-*`, `neutral-*`, and `dark-*` (surface — `dark-bg`, `dark-bg-card`, `dark-bg-elevated`, `dark-border`) tokens.
- `dark:` variants and a `theme-tint` class on the landing `<main>` (page.tsx:21).
- `@keyframes` and reduced-motion handling present (landing hero / scroll).

### 2.2 Design tokens — `src/lib/design-tokens.ts`
- Central JS mirror of brand/accent/status/neutral/dark palettes (used to keep TS and CSS in sync).

### 2.3 Motion system — `src/lib/motion.ts` (105 lines)
- **`EASE` (13–20):** `out`, `outBack`, `standard` cubic-béziers.
- **`DUR` (23–29):** micro 0.15 / fast 0.25 / standard 0.35 / section 0.6 / story 0.85 s.
- **`SPRING` (36–43):** `soft`, `bounce`, `slow` spring profiles.
- **Variants (46–91):** `fadeUp`, `fade`, `scaleIn`, `listItem`, `staggerContainer`.
- **`reducedTransition()` (97–104):** collapses motion to ~0 when reduced-motion is on.
- Used by `PredictiveIntelligenceSection.tsx` (imports `DUR`, `EASE`) and landing sections.

### 2.4 Animation libraries
- **framer-motion:** used across the app (AppShell, landing sections, Reveal, AnimatedNumber).
- **gsap:** present in `package.json` but **not imported anywhere in `src/`** — dead dependency.
- **recharts:** used **only** in `src/app/admin/analytics/page.tsx` (`BarChart`, `PieChart`, `ResponsiveContainer`, etc., lines 4–16). No other consumer.
- **three / @react-three/fiber:** used only in landing 3D (`src/components/3d/CivicGlobe.tsx`, `CivicHero3D.tsx`).

---

## 3. Dashboard (Citizen)

### 3.1 Route dispatcher — `src/app/dashboard/page.tsx`
- Server component; fetches session and redirects by role (`homeFor`): ADMIN→`/admin/dashboard`, AUTHORITY→`/department/dashboard`, else renders `<CitizenDashboard name>`. Role enforced server-side in layout.

### 3.2 `src/components/dashboard/CitizenDashboard.tsx` (302 lines)
- **`fetcher`** (line 29); **`CitizenStats`** interface (31–41): total/active/resolved/rejected/awaitingVerification/evidenceTotal/evidencePending/karmaScore/notificationsUnread.
- **Data via SWR (56–71):**
  - `/api/citizen/summary` (30s refresh) → stats
  - `/api/my-reports` (30s refresh) → my issues
  - `/api/issues` (60s refresh) → all issues
  - `/api/notifications` (30s refresh) → notifications + unreadCount
  - `/api/my-reports/${latest.id}` (conditional) → latest issue detail (timeline)
- **Sections:** hero header w/ greeting + My Reports / Report Issue buttons (82–97); 6 KPI `StatCard`s (99–112); My Latest Reports list (118–163); Latest Report Timeline vertical list (165–201); Quick Actions (205–227); "Where Your Reports Are" map (229–239); Latest Updates notifications (241–270); Recent Civic Updates (272–297).
- **Karma note (line 111):** "reputation engine arrives later."

### 3.3 Dashboard sub-pages (`src/app/dashboard/*`)
- **`community/page.tsx`:** **static** `FEEDBACK` hardcoded array (lines 7–12); KPI cards (25–40). Not data-backed.
- **`promises/page.tsx`:** **static** `PROMISES` (lines 8–15); KPI cards (27–40). Not data-backed.
- **`verification/page.tsx`:** **static** `VERIFICATIONS` (lines 8–13); KPI cards (25–39). Not data-backed.
- **`escalations/page.tsx`:** **static** `ESCALATIONS` (lines 10–14); KPI cards (26–39). Not data-backed.
- **`risk/page.tsx`:** see §5.
- **`notifications/page.tsx`:** live list, `markRead`/`markAllRead` against `/api/notifications`.
- **`settings/page.tsx`:** static, non-persistent profile/settings form (no server write-back).
- **`issues/page.tsx` + `issues/[id]/page.tsx`:** live browse + detail; `issues/[id]` renders `IssueDetailView` with AI analysis status.

---

## 4. Map

### 4.1 No map API key required
- **Maplibre uses keyless CARTO raster tiles.** `CARTO_STYLE` (IssuesMapInner.tsx:33–48) sources `rastertiles/voyager/{z}/{x}/{y}{r}.png` from `a/b/c.basemaps.cartocdn.com` with OSM+CARTO attribution. No `MAPBOX_TOKEN` anywhere.
- **Landing map uses keyless Google Maps embed:** `mapEmbedUrl()` (CivicMapEmbed.tsx:28–36) builds `https://maps.google.com/maps?q=…&z=…&output=embed` — no key. `.env.example` (line 57) notes a key is only needed if geocoding is built.
- `.env` confirmed to have **no `AI_API_KEY` and no map token**.

### 4.2 Dashboard map panel — `src/components/dashboard/IssuesMap.tsx` + `IssuesMapInner.tsx`
- **`IssuesMap.tsx` (41 lines):** SSR-safe `dynamic(() => import('./IssuesMapInner'), { ssr: false })` wrapper (lines 9–11); renders an honest `EmptyState` when no points have coords (27–35); `aspect-[16/9]` frame (37).
- **`IssuesMapInner.tsx` (117 lines):** static/cinematic Maplibre:
  - `STATUS_COLORS` (16–27): resolved/rejected/brokenPromise/atRisk/verificationPending/promised/assigned/onTrack/active/partiallyResolved.
  - `CARTO_STYLE` (33–48) as above.
  - Map init (61–85): centers on the mean of coordinates, zoom 15 for single point / 11 otherwise, `NavigationControl`, offline error state (75–77).
  - Markers + popups (87–105). Reduced-motion safe by being static.

### 4.3 Interactive map page — `src/components/map/CivicMap.tsx` + `CivicMapInner.tsx` (page at `src/app/dashboard/map/page.tsx` and `src/app/map/page.tsx`)
- Fetches `/api/map` (fetcher ~line 32; `ApiMapResponse` ~34–38), filters category/status/priority, role-aware scope.

### 4.4 `/api/map` route — `src/app/api/map/route.ts` (78 lines)
- **Commented role scoping (9–17):**
  - CITIZEN → only own reports (`reporterId = user.id`), `scope: 'mine'` (23–38).
  - AUTHORITY → own authority's reports via `requireOwnAuthority`, `revealReporter`, `scope: 'department'` (40–57).
  - ADMIN → full feed, optional `?department=` slice, `scope: 'all'` (60–74).
- Endpoint-level auth enforced against DB (`requireUser`), independent of proxy. Returns up to 200 issues (`pageSize: 200`).

---

## 5. AI Risk UI

There are **two separate** AI-risk visualizations, both **static/hardcoded**:

### 5.1 Landing — `src/components/landing/PredictiveIntelligenceSection.tsx` (717 lines)
- Animated "scan lifecycle" (framer-motion + `AnimatedNumber`), hardcoded `RISKS` array (line 11+). Used on `src/app/page.tsx:36`.
- This is the **only** risk surface with the scan/persist animation.

### 5.2 Dashboard — `src/app/dashboard/risk/page.tsx` (70 lines)
- **Static, hardcoded `RISKS` array (lines 7–13)** — 5 risk cards (ward/type/level/icons/historical/signal/trend). No animation lifecycle, no `/api` fetch, no live data.
- Disclaimer banner (63–67): explicitly labels it "prototype intelligence — not real-time prediction."

### 5.3 AI backend (server-side, honest)
- **`src/lib/server/intelligence/config.ts` (76 lines):** central env config; `ai.apiKey = process.env.AI_API_KEY || null` (25); when absent, the analysis pipeline **FAILS** (never fakes) — comments lines 1–9 and 24. Also priority-engine weights (61–75) and duplicate-detection settings (39–59).
- **`ai/analysis.ts`:** calls an OpenAI-compatible `/v1/chat/completions` (vision when `AI_USE_VISION`), with real timeout/retry; returns `FAILED` status + explanatory error when no key.
- **`priority/engine.ts`:** spec formula Severity×0.30 + Reports×0.20 + Population×0.15 + Location×0.15 + Safety×0.10 + Evidence×0.10; factors that can't be measured are flagged "unavailable," never invented (mirrors `.env.example` 87–91).
- `.env` has **no AI key → any real AI analysis fails honestly.** All risk UIs shown to users are the hardcoded prototypes above.

### 5.4 AI status in issue detail — `src/components/issues/IssueDetailView.tsx`
- Displays `ai` / `aiStatus` (lines 53–54) from `IssueDetail.aiAnalysis`.

---

## 6. Reusable UI Components

### Primitives — `src/components/ui/`
- **Card.tsx** — `Card`/`CardContent`/`CardHeader`/`CardTitle`, `variant="elevated"`, dark tokens.
- **Button.tsx** — variants (default/outline/secondary/destructive), `size`, `loading`, `asChild`.
- **Badge.tsx** — `variant="status"` (vocabulary: active/assigned/verificationPending/resolved/rejected/etc. per `getStatusColor`), `size`.
- **Avatar.tsx** — initials fallback (`initialsOf` in AppShell:79–87).
- **Input.tsx** — styled input primitive.
- **AnimatedNumber.tsx** — count-up number (used in landing predictive section).
- **Reveal.tsx** — framer-motion entrance reveal.

### Dashboard composites — `src/components/dashboard/`
- **StatCard.tsx** — label/value/icon/tone/sub + loading.
- **PageHeader.tsx** — kicker/title/description + optional actions slot.
- **LoadingBlock.tsx** — skeleton rows.
- **EmptyState.tsx** — icon+title+description+children action.
- **ErrorState.tsx** — retry CTA (`onRetry`).
- **TableFrame.tsx** — columns/loading/error/empty/footer, exports `Pagination`.
- **IssueDrawer.tsx** — slide-over detail with `endpoint`, `canUpdateStatus`, `canVerify`, `canEscalate` flags.

---

## 7. API Dependencies (client-side data)

| Endpoint | Consumed by | Notes |
|---|---|---|
| `/api/citizen/summary` | `CitizenDashboard` (57) | stats → `{ stats }`; 30s SWR |
| `/api/my-reports` | `CitizenDashboard` (58), `my-reports/page.tsx` | `{ issues, total }` |
| `/api/my-reports/[id]` | `CitizenDashboard` (69), `my-reports/[id]` | issue detail |
| `/api/issues` | `CitizenDashboard` (59); `dashboard/issues`, admin/department | GET list + POST create |
| `/api/notifications` | `AppShell` unread (97), `CitizenDashboard` (60), notifications page | `{ notifications, unreadCount }` |
| `/api/map` | `CivicMapInner` | role-scoped issue catalogue |
| `/api/department/issues` | `department/issues/page.tsx` (41) | search/filter/sort/page |
| `/api/department/verification` | `department/verification/page.tsx` (25) | queue + POST decision |
| `/api/department/escalations` | `department/escalations/page.tsx` (20) | open/closed + PATCH |
| `/api/department/performance` | `department/performance/page.tsx` (51) | summary + byStatus/byDay |
| `/api/admin/users` | `admin/users/page.tsx` (45) | q/role/page |
| `/api/admin/issues` | `admin/issues/page.tsx` (33) | q/status/page |
| `/api/admin/departments` | `admin/departments/page.tsx` (38) | authority workload |
| `/api/admin/analytics` | `admin/analytics/page.tsx` | recharts data |
| `/api/admin/audit` | `admin/audit/page.tsx` (14) | immutable logs |
| `/api/admin/health` | `admin/health/page.tsx` (51) | checks + totals |

### Shared types — `src/lib/issues/types.ts` (202 lines)
- `IssueListItem` (7–40), `EvidenceQueueItem` (42–47), `TimelineItem`/`TimelineState` (49–55), `EvidenceVerification` (57–63), `EvidenceItem` (65–81), `AiAnalysisItem` (83–98), `IncidentSummary` (100–106), `PriorityComponentItem` (108–114), `PriorityBreakdown` (116–121), `DuplicateSignalsItem`/`DuplicateVerdictItem` (123–140), `IssueDetail extends IssueListItem` (142–155), `ApiIssueResponse` (157–159), `ApiIssueListResponse` (161–164), `NotificationItem` (166–176), `EscalationItem` (178–190), `AuditLogItem` (192–202).
- Mapping/serialization behind `/api`: `src/lib/issues/query.ts`, `src/lib/issues/serialize.ts`, `src/lib/issues/mapping.ts`, `src/lib/intelligence/mapping.ts`.

---

## 8. Admin & Department Dashboards

### 8.1 Admin — `src/app/admin/*`
- **dashboard/page.tsx:** "Control Center" overview.
- **users/page.tsx:** searchable/paginated user table (`AdminUser` 12–23, role filters 25–30, `ROLE_BADGE` 32–36).
- **departments/page.tsx:** authority workload table (`AuthorityRow` 11–26, `formatMinutes` 28–34).
- **issues/page.tsx:** all-report table + `IssueDrawer` (can verify/update/escalate).
- **analytics/page.tsx:** **recharts** bar/pie charts (importer 4–16; `AnalyticsData` 25–30) — the only recharts consumer.
- **audit/page.tsx:** immutable audit table (`AuditLogItem`, action/entity/actor).
- **health/page.tsx:** chec核 database/postgis/auth/email/storage + totals (`HealthData` 22–39, `CHECK_META` 41–47).

### 8.2 Department — `src/app/department/*`
- **dashboard/page.tsx:** `DepartmentSummary` interface (lines 28–44).
- **issues/page.tsx:** workbench table (status filters 15–24, sorts 26–30) + `IssueDrawer` with `canUpdateStatus`/`canVerify`/`canEscalate` (165–174).
- **verification/page.tsx:** evidence queue with Verify/Reject decisions (`VerificationQueue` 18–21, POST to `/api/department/verification` 40–61) + counts pills; poll 15s.
- **escalations/page.tsx:** open/start/close + history (`EscalationItem`, PATCH 39–43); poll 15s.
- **performance/page.tsx:** metric cards + byStatus bars + byDay bar chart (`PerformanceData` 14–34); poll 60s.

### 8.3 Static-vs-live contrast
- **Live/DB-backed:** department issues/verification/escalations/performance; admin users/departments/issues/analytics/audit/health; citizen dashboard; my-reports; issues browse; notifications; map.
- **Static/hardcoded (no fetch):** citizen `dashboard/community`, `dashboard/promises`, `dashboard/verification`, `dashboard/escalations`, `dashboard/risk`; landing `PredictiveIntelligenceSection`; landing map (keyless embed).

---

## 9. Profile & Notifications

- **AppShell header bell (327–334)** + `NotificationDot` (411–420) surface unread count.
- **`dashboard/notifications/page.tsx`:** live list, per-item `markRead` and `markAllRead`.
- **`dashboard/settings/page.tsx`:** static profile/settings form — **no persisting server write-back** (matches "profile not configured" note in work state).
- Avatar initials logic in `AppShell.initialsOf` (79–87).

---

## 10. Auth Enforcement (Proxy/Middleware)

`src/proxy.ts` (169 lines) — Next.js 16 Proxy:
- **Rate limiting** per route family: auth (18–26), report creation POST `/api/issues`|`/api/reports` (29–37), evidence upload (40–48), map (51–59), general `/api/` (62–70).
- **`needsAuth` set (78–93):** dashboard/department/my-reports/admin skeletons, `/report`, `/map`, and all `/api/*` namespaces.
- Auth via `getToken` (72–75); unauthenticated ⇒ 401 (API) or redirect to `/login?callbackUrl=` (105–117).
- **Role checks:** admin paths require `ADMIN` (125–129), department paths require `AUTHORITY` (131–136) — 403 JSON for APIs, `redirectHome` for pages.
- **Security headers (142–148):** map-specific CSP for `/map`, `/dashboard/map`, `/api/map`; standard headers elsewhere.
- Comments stress: this is **optimistic** protection; each route handler re-verifies against the DB.

---

## 11. Landing Page — `src/app/page.tsx` (54 lines)
Renders, in order: `CivicTheme`, `LandingNavigation`, `HeroSection` (suspense-loaded), `ProblemSection`, `StoryScroll`, `SolutionSection`, `FeaturesSection`, `PromiseLedgerSection`, `BrokenPromiseSection`, `AIVerificationSection`, `SectionWave`, `CivicIntelligenceMapSection`, `PredictiveIntelligenceSection`, `DashboardPreviewSection`, `SectionWave`, `CTASection`, `Footer`.
- 3D components (`CivicGlobe`, `CivicHero3D`) used only via `HeroSection`/`CivicIntelligenceMapSection` on landing, not in the workspace.

---

## 12. Key Findings / Notes

1. **Single canonical shell:** `AppShell` + `workspaceNav.ts`; `Navigation.tsx`'s role `<*>Sidebar`s (345–452) are **dead code** — zero importers (only plain `Navigation` used by login/register).
2. **No map API key needed** (CARTO Voyager raster + keyless Google embed). `.env` has no map token.
3. **AI is NOT configured:** `.env` has no `AI_API_KEY`; `intelligenceConfig` fails analysis honestly. All risk UIs (dashboard `risk/page.tsx`, landing `PredictiveIntelligenceSection`) are **hardcoded prototype** data.
4. **gsap is a dead dependency** (in package.json, unused in `src/`). **recharts** used only in admin analytics.
5. **Static (non-DB) citizen dashboard sub-pages:** community, promises, verification, escalations — all hardcoded arrays.
6. **Settings page is non-persistent** — no server write-back.
7. **Role auth enforced twice** (proxy + each route handler); map `/api` is role-scoped server-side.

---

## Appendix — File inventory (`src/`)
- Layout/shell: `app/layout.tsx`, `components/layout/{AppShell,Navigation,workspaceNav,Footer}.tsx`
- UI primitives: `components/ui/{Card,Button,Badge,Avatar,Input,AnimatedNumber,Reveal}.tsx`
- Dashboard composites: `components/dashboard/{StatCard,PageHeader,LoadingBlock,EmptyState,ErrorState,TableFrame,IssueDrawer,CitizenDashboard,IssuesMap,IssuesMapInner}.tsx`
- Map workspace: `components/map/{CivicMap,CivicMapInner}.tsx`
- Issues detail: `components/issues/IssueDetailView.tsx`
- 3D: `components/3d/{CivicGlobe,CivicHero3D}.tsx`
- Landing: `components/landing/*` (Nav, Theme, Hero, Problem, Story, Solution, Features, PromiseLedger, BrokenPromise, AIVerification, CivicIntelligenceMap, PredictiveIntelligence, DashboardPreview, CTA, SectionWave, CivicMapEmbed)
- Server libs: `lib/server/{intelligence/{ai/analysis.ts,priority/engine.ts,config.ts},session,dept,api,security/*}`; `lib/issues/{query,serialize,mapping,types}.ts`; `lib/intelligence/mapping.ts`; `lib/{utils,motion,design-tokens}.ts`
- Proxy/auth: `src/proxy.ts`
