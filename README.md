# CivicChain

**AI-Powered Civic Issue Intelligence & Resolution Platform**

[![Framework](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Language](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org/)
[![Database](https://img.shields.io/badge/PostgreSQL-17%20%2B%20PostGIS-336791)](https://www.postgresql.org/)
[![Status](https://img.shields.io/badge/status-active%20development-yellow)](#implementation-status)
[![License](https://img.shields.io/badge/license-TBD-lightgrey)](#license)

CivicChain is a civic technology platform that reimagines how public issues are reported, analyzed, prioritized, assigned, resolved, verified, and monitored. Rather than treating every complaint as an isolated support ticket, CivicChain builds an intelligent workflow around each civic issue — combining AI classification, duplicate detection, incident clustering, priority intelligence, geospatial analysis, department workflows, SLA tracking, resolution verification, notifications, analytics, and an auditable history.

**Report → Understand → Prioritize → Assign → Resolve → Verify → Improve**

---

## 📑 Table of Contents

- [Vision](#vision)
- [Core Concept](#core-concept)
- [Key Capabilities](#key-capabilities)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Security](#security)
- [Testing Strategy](#testing-strategy)
- [Getting Started](#getting-started)
- [Build](#build)
- [Implementation Status](#implementation-status)
- [Roadmap](#roadmap)
- [Definition of Done](#definition-of-done)
- [No Fake System Policy](#no-fake-system-policy)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Vision

Cities generate thousands of civic complaints every day — potholes, garbage, broken streetlights, water leakage, damaged roads, drainage problems, and more. The challenge is rarely collecting these reports; it is:

- Identifying what the issue actually is
- Detecting duplicate reports
- Understanding the true scale of an incident
- Determining urgency
- Routing the issue to the right authority
- Ensuring action happens within a defined timeframe
- Verifying whether the issue was genuinely resolved
- Keeping citizens informed
- Providing authorities with actionable intelligence

CivicChain is designed to address this complete lifecycle, end to end.

---

## 🧭 Core Concept

CivicChain treats a civic complaint as an **intelligent civic event**, not a simple support ticket. Each report moves through a structured pipeline:

Citizen Report → Location & Evidence → AI Analysis → Duplicate Detection → Incident Clustering → Priority Intelligence → Department Routing → SLA / Promise → Authority Action → Resolution Evidence → Verification → Citizen Confirmation → Closure → Analytics & Risk Intelligence → Auditable Civic Record

---

## ✨ Key Capabilities

### 📝 Citizen Reporting
Citizens can report civic problems — potholes, garbage accumulation, broken streetlights, water leakage, damaged roads, drainage issues, and other public infrastructure concerns — including title, description, location, GPS coordinates, address, and supporting evidence.

### 📍 Geospatial Intelligence
Built on GPS coordinates and PostGIS, CivicChain enables location-based issue discovery, spatial duplicate detection, map visualization, and ward/area-level intelligence — moving from *"a complaint was submitted"* to *"this incident is affecting this area and may be related to multiple reports."*

### 🤖 AI Issue Intelligence
The AI layer analyzes each report to determine category, severity, and confidence score. AI output is validated before being persisted, and if the AI service is unavailable, the system represents the analysis as unavailable rather than fabricating results.

### 🔎 Duplicate Detection
Potential duplicates are identified using geographic distance, textual similarity, category, time proximity, and image similarity — reducing noise and revealing the true scale of a civic problem.

### 🧩 Incident Clustering
Related reports are grouped into a unified incident, allowing the platform to distinguish between, for example, 100 unrelated complaints versus one major incident generating 100 reports.

### 🚨 Priority Intelligence
A priority engine calculates urgency (0–100, mapped to LOW / MEDIUM / HIGH / CRITICAL) from severity, location risk, duplicate count, public impact, urgency, and SLA signals — helping authorities work on what matters most first.

### 🏢 Department Workflow
Issues are routed to the appropriate department (e.g., potholes → Road Department, garbage → Sanitation, streetlights → Electrical) through a defined workflow: Receive → Accept → Assign Officer → Work → Update → Resolve → Verify.

### ⏱️ SLA & Civic Promise System
Moves the platform from *"the complaint has been received"* to *"the authority has a measurable commitment to act."* Each priority level carries acknowledgement, action, and resolution timeframes, tracked as ON TRACK, AT RISK, BREACHED, or RESOLVED.

### ⚠️ Automated Escalation
Issues that remain unresolved beyond defined thresholds escalate automatically through the authority hierarchy — Officer → Department Head → Municipal Authority → Admin.

### 🔧 Resolution & Verification
Resolution requires more than a status change. The workflow includes authority action, resolution evidence, AI/computer vision verification, and citizen verification before an issue is closed or reopened.

### 📸 Before/After Evidence & Computer Vision Verification
Applicable issues are supported with before/after evidence. The planned verification layer analyzes this evidence for change detection and confidence, producing a state of VERIFIED, LIKELY_VERIFIED, UNCERTAIN, or FAILED — assisting, not replacing, human judgment.

### 👤 Citizen Verification
After an authority submits a resolution, the citizen reviews the evidence and confirms whether the issue is genuinely resolved, closing or reopening it accordingly.

### ⭐ Community Intelligence & Civic Karma
Citizens can support issues, confirm problems, dispute resolutions, and flag duplicates. A reputation model (Civic Karma) measures accuracy, reliability, and community contribution over time.

### 📊 Risk & Hotspot Intelligence
Recurring or worsening problem areas are identified using issue frequency, severity, recurrence, unresolved duration, SLA breaches, and historical data — helping authorities shift from reactive handling to proactive civic management.

### 🗺️ Civic Intelligence Map
A geospatial map visualizes issues, incidents, priorities, risks, departments, wards, and statuses, with an architecture designed to support real-time updates.

### 🔔 Notifications
Event-driven notifications cover issue creation, assignment, SLA risk/breach, resolution, and verification requests, across in-app, email, and push channels.

### 📈 Admin Analytics
An administrative intelligence layer tracks metrics such as total/resolved/pending reports, resolution time, SLA compliance, escalation rate, duplicate rate, verification success, AI confidence, department performance, and citizen satisfaction — always sourced from the database, never hardcoded.

### 🔐 Audit & Trust
Critical actions produce an auditable record capturing who, what, when, entity, previous state, and new state. The planned tamper-evident mechanism uses chained cryptographic hashes, so unauthorized modification becomes detectable.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 |
| Frontend | React 19 |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 17 |
| Geospatial | PostGIS |
| ORM | Prisma 7 |
| Authentication | Auth.js v5 |
| Maps | MapLibre |
| Charts | Recharts |
| AI | OpenAI-compatible API |
| Object Storage | Local / S3-compatible storage |
| Background Jobs | Queue / Worker architecture |
| Cache & Queue | Redis |
| Testing | Vitest / Playwright |
| CI | GitHub Actions |

CivicChain is built as a single Next.js application (rather than separate frontend/backend apps), with citizen, department, and admin surfaces sharing a common API and server layer backed by PostgreSQL + PostGIS.

The current implementation already includes the core Next.js/PostgreSQL/PostGIS/Prisma/Auth.js foundation, along with real report, evidence, authentication, AI, duplicate detection, priority, dashboard, map, and notification functionality.

---

## 📁 Project Structure

```
civicchain/
├── src/
│   ├── app/
│   │   ├── dashboard/
│   │   ├── department/
│   │   ├── admin/
│   │   ├── map/
│   │   ├── report/
│   │   └── api/
│   ├── components/
│   │   ├── dashboard/
│   │   ├── landing/
│   │   ├── map/
│   │   └── ...
│   ├── lib/
│   │   ├── auth/
│   │   ├── issues/
│   │   ├── server/
│   │   │   ├── intelligence/
│   │   │   └── ...
│   │   ├── security/
│   │   ├── validation/
│   │   └── ...
│   └── proxy.ts
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── public/
├── .env.example
├── package.json
└── README.md
```

---

## 🔒 Security

Security is treated as a first-class part of the platform.

**Currently implemented:**
- Role-based access control (RBAC)
- Server-side authorization and database role verification
- Secure authentication flow
- Private evidence storage
- Magic-byte file validation, MIME/type validation, file size/structure validation
- Path traversal protection
- Request rate limiting
- Protected evidence serving
- Security-conscious response headers

The current audit specifically confirms private evidence handling, strong upload validation, RBAC, and server-side role verification.

**Still required for production:**
- Redis-based rate limiting
- Content Security Policy (CSP) and additional security headers
- Malware scanning
- Signed access URLs where appropriate
- Expanded security testing
- Observability and alerting

---

## 🧪 Testing Strategy

**Unit tests** cover AI output validation, priority calculations, duplicate scoring, location calculations, SLA calculations, escalation rules, karma calculations, and notification routing.

**Integration tests** cover authentication, RBAC, issue creation, evidence upload, issue updates, department access, citizen ownership, and SLA processing.

**End-to-end tests** validate the full journey: login → create issue → upload evidence → AI analysis → duplicate detection → priority → department assignment → SLA → resolution → verification → citizen confirmation → closure.

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <YOUR_REPOSITORY_URL>
cd civicchain
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file from `.env.example` and configure the required database, authentication, storage, and AI variables.

### 4. Set up the database
Ensure PostgreSQL with PostGIS is available, then run the Prisma migration workflow for your environment:
```bash
npx prisma migrate deploy
```
Seed the database if development demo data is required.

### 5. Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 🏗️ Build

```bash
npx tsc --noEmit     # TypeScript validation
npx next build       # Production build
npm run lint         # Linting
```

The current audited project has a clean TypeScript check and a successful Next.js production build. Lint still requires cleanup before it should be considered production-clean.

---

## 📌 Implementation Status

CivicChain is an active work in progress, currently at **~70% implementation maturity**, with the core business pipeline operational.

**Implemented**
Citizen authentication/RBAC · Issue reporting · Secure evidence storage · GPS coordinates · AI classification & severity analysis · Duplicate detection · Incident clustering · Priority engine · Department & admin dashboards · Department workflows · Real database-backed map · Evidence search · In-app notifications · Audit records · Production build/type checking

**Partially implemented**
Geocoding · Background processing · Authority auto-routing · Citizen intelligence dashboards · Notification channels beyond in-app · Production-grade rate limiting

**Planned**
Automated test suite · CI/CD · Real queue/worker infrastructure · SLA/Promise engine · Automated escalation rules · CV verification · Citizen verification · Community voting · Civic karma · Risk/hotspot intelligence · Real-time updates · Email/push notifications · Persistent settings · Tamper-evident audit hash chain · Production observability · Advanced analytics · Removal of remaining mock/static production surfaces

---

## 🗺️ Roadmap

| Phase | Focus |
|---|---|
| 0 — Stabilization | Git baseline, environment cleanup, migration verification, production config |
| 1 — Engineering Foundation | Automated tests, CI, security tests, E2E tests |
| 2 — Architecture Cleanup | API consolidation, issue state machine, remove dead/orphaned code |
| 3 — Automation | Queue, workers, retries, failure handling, idempotency |
| 4 — Civic Operations | SLA, promises, countdown, escalation, notifications |
| 5 — Verification | Before/after evidence, computer vision, authority & citizen verification, reopen workflow |
| 6 — Civic Intelligence | Community voting, karma, risk engine, hotspots, advanced analytics |
| 7 — Real-Time Platform | WebSocket, live map, live issue updates, live notifications |
| 8 — Trust & Production | Tamper-evident audit chain, observability, monitoring, performance, security hardening, deployment |

---

## ✅ Definition of Done

CivicChain is **not** considered complete simply because every screen exists. A feature is DONE only when its frontend, backend, database, business logic, required AI/automation, error handling, security, and testing are all implemented and connected.

---

## 🚫 No Fake System Policy

CivicChain follows a strict no-fake-system principle:

- **No fake dashboard data** — hardcoded metrics are not acceptable in production.
- **No fake AI** — if AI is unavailable, the system must represent it as `AI_UNAVAILABLE`, not fabricate results.
- **No fake real-time** — static polling or demo animation must never be presented as live real-time data.
- **No fake blockchain** — tamper-proof claims are made only when the underlying mechanism actually exists.
- **No dead buttons** — every action must be wired end-to-end: UI → Handler → API → Business Logic → Database → Result.
- **No misleading UI** — the interface must always represent the actual system state. If the backend doesn't do it, the UI must not claim that it does.

---

## 🤝 Contributing

Before submitting a change:

1. Understand the existing architecture.
2. Avoid introducing duplicate API surfaces.
3. Keep business logic server-side where appropriate.
4. Do not add hardcoded production data.
5. Add tests for critical logic.
6. Preserve authorization boundaries.
7. Do not introduce misleading UI claims.
8. Run type checking, linting, tests, and build checks before opening a PR.

---

## 📄 License

_Add the project's chosen license here (e.g., MIT License)._

---

**CivicChain** — Report. Understand. Prioritize. Resolve. Verify. Improve.
Building a more intelligent, transparent, and accountable civic ecosystem.
