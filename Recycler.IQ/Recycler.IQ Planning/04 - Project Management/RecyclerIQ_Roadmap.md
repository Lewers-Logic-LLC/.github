# Recycler.IQ Product Roadmap

**Version 1.0 | Last Updated: 2026-04-12**

**Status:** Sprint 1 in progress (Day 14 of 22: RCORE substantially complete, RCLIENT 50% complete, RCLOUD/RLINK/RIQSIM in backlog)
**Jira Verification:** All 100 issues across 6 projects tracked (66 Done, 97 Ready, 2 Pending Dev Review, 1 Blocked)

---

## Executive Summary

| Metric | Count |
|--------|-------|
| **Total Epics** | 31 |
| **In Progress** | 6 |
| **Backlog** | 25 |
| **Completed** | 0 |
| **At Risk** | 0 |

**Projects Status Overview:**

| Project | Epics | In Progress | Backlog | Status |
|---------|-------|-------------|---------|--------|
| **RCORE** | 2 | 2 | 0 | ✅ Substantially Complete |
| **RCLIENT** | 9 | 4 | 5 | 🟡 50% Complete |
| **RCLOUD** | 10 | 0 | 10 | 🔴 Not Started |
| **RLINK** | 8 | 0 | 8 | 🔴 Not Started |
| **RIQSIM** | 2 | 0 | 2 | 🔴 Not Started |

---

## Sprint 1 Roadmap (Current: Mar 29 — Apr 19, 2026)

### RCORE — Repository & Domain Foundation
**Status: ✅ On Track (Substantially Complete)**

Core shared packages foundation for all projects.

| Epic Key | Epic Title | Status | Details |
|----------|-----------|--------|---------|
| RCORE-94 | RIQ-CORE-E01: Repository & Package Setup | 🟢 In Progress | Repo scaffolded, CI pipeline live, SemVer configured, GitHub Packages NuGet feed operational |
| RCORE-95 | RIQ-CORE-E02: Domain Model | 🟢 In Progress | Full domain model: 6 aggregates, 10 entities, 5 value objects, 6+ domain events, 7 enums, test coverage complete |

**Dependencies:** None (foundational)
**Blockers:** None
**Key Decisions:**
- NuGet feed: GitHub Packages (not Azure Artifacts)
- CI: GitHub Actions
- Solution format: .slnx (new XML format)
- Auth hashing: PBKDF2 (SHA256, 100K iterations)

---

### RCLIENT — Client Applications (MAUI + Blazor)
**Status: 🟡 On Track (50% Complete)**

MAUI Blazor Hybrid clients for TaxAuthority and Retail, plus Blazor Server web client.

| Epic Key | Epic Title | Status | Details |
|----------|-----------|--------|---------|
| RCLIENT-1 | RIQ-CLIENT-E01: Repository & Project Setup | 🟢 In Progress | Repo scaffolded, solution structure (UI.TaxAuthority, UI.RetailClient, UI.WebClient, UI.Shared), MudBlazor 9.2.0 integrated |
| RCLIENT-2 | RIQ-CLIENT-E02: Local Client Auth Architecture | 🟢 In Progress | LocalIdentityProvider (PIN + password), RiqAuthenticationStateProvider, DI wiring for demo mode complete, 4 unit tests |
| RCLIENT-4 | RIQ-CLIENT-E04: Demo Mode Features | 🟢 In Progress | DemoDataSeeder (30 days sample data), DemoResetService functional; AppModeOptions partial (class exists, not yet bound to appsettings) |
| RCLIENT-5 | RIQ-CLIENT-E05: WebClient (Blazor Server) | 🟢 In Progress | Blazor Server project scaffolded with MudBlazor, layout shell, template pages; AppModeOptions & UI.Shared wiring TBD |
| RCLIENT-3 | RIQ-CLIENT-E03: Tax Authority Local UI | 🔴 Backlog | Blocked on E01, E02 completion |
| RCLIENT-6 | RIQ-CLIENT-E06: Self-Serve Demo Provisioning | 🔴 Backlog | Blocked on E04, cloud integration |
| RCLIENT-7 | RIQ-CLIENT-E07: Retail Local UI | 🔴 Backlog | Blocked on E01, E02 completion |
| RCLIENT-8 | RIQ-CLIENT-E08: Installer & Client Distribution | 🔴 Backlog | Blocked on all client UI epics |
| RCLIENT-9 | RIQ-CLIENT-E09: Shared UI Component Library | 🔴 Backlog | Cross-cutting, needed by all clients |

**Key Risks:**
- AppModeOptions not yet wired to appsettings.json/CLI args (low risk, on track to fix)
- WebClient UI.Shared integration incomplete (expected in next sprint)

**Dependencies:** RCORE (domain/common packages), Link.Service (runtime), Cloud API (future integration)

---

### RCLOUD — Cloud API & Portal
**Status: 🔴 Not Started**

Central API, web portal analytics, admin, and reporting.

| Epic Key | Epic Title | Status |
|----------|-----------|--------|
| RCLOUD-1 | RIQ-CLOUD-E01: Repository & Infrastructure Setup | 🔴 Backlog |
| RCLOUD-2 | RIQ-CLOUD-E02: Authentication & Multi-Tenancy (Cloud) | 🔴 Backlog |
| RCLOUD-3 | RIQ-CLOUD-E03: Identity Provider & Auth Paths (Cloud) | 🔴 Backlog |
| RCLOUD-4 | RIQ-CLOUD-E04: Database Architecture & Tenant Routing | 🔴 Backlog |
| RCLOUD-5 | RIQ-CLOUD-E05: Cloud API Core | 🔴 Backlog |
| RCLOUD-6 | RIQ-CLOUD-E06: Edge Sync Engine | 🔴 Backlog |
| RCLOUD-7 | RIQ-CLOUD-E07: License & Billing System | 🔴 Backlog |
| RCLOUD-8 | RIQ-CLOUD-E08: Web Portal | 🔴 Backlog |
| RCLOUD-9 | RIQ-CLOUD-E09: CIT Management | 🔴 Backlog |
| RCLOUD-10 | RIQ-CLOUD-E10: ML & Forecasting Engine | 🔴 Backlog |

**Dependencies:** RCORE (domain packages), RCLIENT (API consumers)

**Start Date:** After RCLIENT E04 & E05 complete (projected: early May)

---

### RLINK — Edge Service & Hardware Abstraction
**Status: 🔴 Not Started**

Site-level agent for hardware comms, sync, license validation.

| Epic Key | Epic Title | Status |
|----------|-----------|--------|
| RLINK-1 | Link.Service Core | 🔴 Backlog |
| RLINK-2 | Hardware Abstraction Layer | 🔴 Backlog |
| RLINK-3 | Sync & Background Services | 🔴 Backlog |
| RLINK-4 | gRPC & .proto Contracts | 🔴 Backlog |
| RLINK-5 | Cloud SignalR Integration | 🔴 Backlog |
| RLINK-6 | API Key Authentication | 🔴 Backlog |
| RLINK-7 | Multi-Recycler State Management & Failover | 🔴 Backlog |
| RLINK-8 | Repository & Service Setup | 🔴 Backlog |

**Dependencies:** RCORE (domain packages), RCLIENT (gRPC contract), RCLOUD (signalr integration)

**Start Date:** After RCLIENT complete (projected: late May)

---

### RIQSIM — Standalone Hardware Simulator
**Status: 🔴 Not Started**

Blazor Server + REST API simulator for development and demo without hardware.

| Epic Key | Epic Title | Status |
|----------|-----------|--------|
| RIQSIM-1 | Repository & Project Setup | 🔴 Backlog |
| RIQSIM-2 | Simulator Engine & REST API | 🔴 Backlog |

**Dependencies:** RCORE (domain packages), RLINK (hardware abstraction interface)

**Start Date:** Parallel with RLINK (projected: late May)

---

## Release Timeline (Projected)

| Milestone | Target Date | Deliverables |
|-----------|-------------|--------------|
| **Sprint 1 Complete** | 2026-04-19 | RCORE done, RCLIENT 100% done, foundation ready for cloud |
| **Sprint 2-3 (Cloud Phase)** | 2026-05-31 | RCLOUD + RLINK 80% complete |
| **Beta Release** | 2026-06-30 | Tax Authority demo ready, Retail follow |
| **v1.0 Release** | 2026-07-31 | GA with all major epics complete |

---

## Key Assumptions & Risks

**Assumptions:**
- Team remains 3 full-time developers
- No major scope changes mid-sprint
- Azure infrastructure provisioned and access granted
- KISAN America partnership negotiations finalize by May 15

**Risks:**
- **Timeline Risk (Low):** Cloud phase (RCLOUD) is estimated at 4-6 weeks; delays here impact GA
- **Dependency Risk (Low):** RLINK depends on RCLIENT gRPC contracts; currently on track
- **Integration Risk (Medium):** Multi-system integration (cloud + edge + clients) begins in Sprint 2; recommend integration testing plan now
- **Resource Risk (Low):** Team is stable, but Link.Service work (RLINK) may require specialized hardware knowledge

---

## Capacity & Next Steps

**Current Sprint Capacity:** ~120 story points (RCORE ~25, RCLIENT ~95)
**Projected Sprint 2 Capacity:** ~140 story points (RCLOUD ~80, RLINK ~60, RIQSIM ~20)

**Next Actions:**
1. Complete RCLIENT E05 (WebClient) by Sprint 1 end
2. Finalize RCLOUD E01 & E04 (repo + database) design docs by Apr 26
3. Plan RLINK kickoff; identify hardware test environment needs
4. Schedule Compass component reviews (all 10 components need Compass setup)
5. Monitor gRPC contract evolution as RCLIENT E02 matures

---

## Document Status

**Source of Truth:** This markdown file (RecyclerIQ_Roadmap.md)
**Sync Rule:** When this file is updated, the corresponding .docx files must be regenerated:
- `Product_Roadmap.docx`
- `RecyclerIQ_Roadmap.docx`

**Last Synced:** 2026-04-06 (generating both .docx versions)
