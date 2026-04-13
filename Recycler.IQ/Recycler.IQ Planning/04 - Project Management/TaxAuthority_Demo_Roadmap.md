# Recycler.IQ — Tax Authority Demo Roadmap

**Target:** Tax Authority demo, 2nd week of May 2026  
**Current Sprint:** Sprint 1 (Mar 29 — Apr 19, 2026)  
**Last Updated:** April 10, 2026

---

## Executive Summary

This roadmap tracks the path to a working Tax Authority demo showcasing Recycler.IQ's core cash-flow optimization and transaction capture capabilities. The demo will run against the RIQSIM hardware simulator, driven by MAUI and Blazor clients, with domain logic in RCORE.

**Demo scenario:** Tax cashier logs in, captures incoming recycler cash transactions in real-time, views collection progress, and receives automated change dispensing recommendations.

---

## Sprint Status Overview

| Status | Count | Percentage |
|--------|-------|-----------|
| **Selected for Development** | 44 | 68% |
| **Done** | 17 | 26% |
| **In Progress** | 4 | 6% |
| **TOTAL** | 65 | 100% |

### By Project

| Project | Done | In Progress | Selected for Dev | Total |
|---------|------|-------------|-----------------|-------|
| **RCORE** | 11 | 4 | 0 | 15 |
| **RCLIENT** | 6 | 0 | 22 | 28 |
| **RLINK** | 0 | 0 | 17 | 17 |
| **RIQSIM** | 0 | 0 | 5 | 5 |
| **TOTAL** | 17 | 4 | 44 | 65 |

**Status:** After removing 14 non-demo RLINK stories, demo sprint now contains 65 stories. RCORE foundational work is 75% complete (11 Done, 4 In Progress). RCLIENT is 21% complete (6 Done). RLINK and RIQSIM scaffolding queued for Sprint 2.

---

## Now: Sprint 1 (Mar 29 — Apr 19, 2026)

**Focus:** Complete RCORE domain foundation; kickstart RCLIENT AppModeOptions; establish RLINK and RIQSIM scaffolds.

### RCORE — Domain Model Completion

4 stories **In Progress**; 11 stories **Done**. Domain entities are 75% complete.

| Key | Summary | Status |
|-----|---------|--------|
| RCORE-102 | User and UserRole entities with PinHash and PasswordHash fields | In Progress |
| RCORE-106 | Device entity with IsSimulator flag and SimulatorUrl for database | In Progress |
| RCORE-108 | SiteAuthMethod enum (Pin, Password, Badge future) on tenant/site | In Progress |
| RCORE-109 | AuthResult and UserClaims types for the IIdentityProvider contract | In Progress |

**Target by Apr 19:** Complete in-progress entity work; finalize identity/auth type contracts for RCLIENT integration.

### RCLIENT — Demo Client Bootstrap

6 stories **Done**; 2 stories **Selected for Development**; 20 stories in **Backlog**.

| Key | Summary | Status |
|-----|---------|--------|
| RCLIENT-25 | As a developer, I need AppModeOptions (IsDemoMode, IsAdminMode, LogLevel) | Selected for Dev |
| RCLIENT-27 | Deploy MAUI Blazor client to Windows emulator with live reload | Selected for Dev |
| RCLIENT-10 | Project scaffold with .NET 9, Blazor, Entity Framework | Done |
| RCLIENT-12 | Global state management (GovState) for auth, device, transaction context | Done |

**Target by Apr 19:** Complete AppModeOptions and emulator deployment; queue PIN login and transaction UI stories for Sprint 2.

### RLINK — Edge Service Scaffold

17 demo-critical stories in **Selected for Development**. Non-demo stories (sync, SignalR, failover, license, discovery, heartbeat) removed from this roadmap.

| Key | Summary | Status |
|-----|---------|--------|
| RLINK-9 | RIQ-LINK-001 — Phase 0 (Core service scaffold, DI, EF) | Selected for Dev |
| RLINK-10 | RIQ-LINK-002 — Phase 0 (In-memory device registry, hardware abstraction) | Selected for Dev |
| RLINK-16 | Observability: Structured logging and health check endpoints | Selected for Dev |

**Target by Apr 19:** Begin Phase 0 scaffolding; establish hardware abstraction interfaces for device communication; implement observability for demo debugging.

### RIQSIM — Hardware Simulator Scaffold

5 stories in **Backlog**. No active work yet.

| Key | Summary | Status |
|-----|---------|--------|
| RIQSIM-3 | As a developer, I need the recycleriq-simulator repo scaffolded | Backlog |
| RIQSIM-5 | As a developer, I need SimulatorEngine — in-memory state machine | Backlog |
| RIQSIM-6 | As a developer, I need REST API endpoints for normal IRecycler operations | Backlog |

**Target by Apr 19:** Repo scaffold complete; begin SimulatorEngine and Phase 0 REST API endpoints.

---

## Next: Sprint 2 (Apr 19 — May 3, 2026)

**Focus:** Complete login and transaction capture UI; finalize RLINK hardware abstraction; build out RIQSIM REST API.

### RCORE — Identity & Auth Completion

| Key | Summary | Target Status |
|-----|---------|----------------|
| RCORE-102–109 | User, UserRole, Device, AuthResult, SiteAuthMethod | Done |

**Target:** Domain model fully locked for RCLIENT integration.

### RCLIENT — Login & Transaction UI

| Key | Summary | Target Status |
|-----|---------|----------------|
| RCLIENT-16 | As an operator, I need the login screen to show PIN keypad or password form | In Progress |
| RCLIENT-18 | As a tax cashier, I need to log in with a 4-digit PIN | In Progress |
| RCLIENT-19 | As a tax cashier, I need to enter bill details (Invoice #, Bill #, Amount) | In Progress |
| RCLIENT-20 | As a tax cashier, I need real-time progress display showing collection status | In Progress |
| RCLIENT-21 | As a tax cashier, I need change dispensing recommendations | In Progress |
| RCLIENT-53 | As an operator, I need a PIN login keypad component | In Progress |

**Target:** Core transaction capture and login flow complete; demo-ready MAUI client.

### RLINK — Hardware Abstraction & Phase 0

| Key | Summary | Target Status |
|-----|---------|----------------|
| RLINK-9, RLINK-10 | Core service scaffold, DI, device registry, hardware abstraction | In Progress |

**Target:** Device abstraction interfaces finalized; simulator device registry operational.

### RIQSIM — REST API & State Machine

| Key | Summary | Target Status |
|-----|---------|----------------|
| RIQSIM-3 | Simulator repo scaffold | In Progress |
| RIQSIM-5 | SimulatorEngine — in-memory state machine | In Progress |
| RIQSIM-6 | REST API endpoints for normal operations (AcceptCash, DispenseChange, etc.) | In Progress |
| RIQSIM-7 | REST API endpoints for simulator control (AdvanceTime, etc.) | Selected for Dev |

**Target:** Simulator engine running; RCLIENT can drive simulator state via REST.

---

## Later: Final Push (May 3 — May 10, 2026)

**Focus:** Integration testing, polish, demo rehearsal, bug fixes.

### Integration & Testing

- **RCLIENT ↔ RLINK ↔ RIQSIM:** End-to-end transaction flow (login → accept cash → dispense change)
- **RCORE domain:** Verify all entities serialize/deserialize correctly across service boundaries
- **RIQSIM state consistency:** Validate simulator state remains consistent under concurrent requests

### Demo Readiness

- **AppModeOptions demo mode:** Ensure RCLIENT can toggle demo-specific UI (progress bars, hard-coded device IDs)
- **Receipt generation:** Basic receipt layout (invoice #, amount, change, timestamp)
- **Error handling:** Graceful fallback if simulator is unreachable; clear user messaging
- **Performance:** Login under 500ms; transaction capture under 1 second

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| RLINK hardware abstraction too complex | Start with simple in-memory device registry; defer real hardware integration |
| RIQSIM state machine race conditions | Use async/await and message queue pattern; unit test extensively |
| RCLIENT UI responsiveness under load | Profile with 100 concurrent transactions; optimize binding and rendering |
| Domain model schema lock-in too late | Finalize RCORE contracts by Apr 19; no breaking changes in Sprint 2 |

---

## Dependencies & Critical Path

```
RCORE domain completion (Apr 19)
  ↓
RCLIENT login UI (Apr 19—May 3)
  ├→ Requires RCORE identity/auth types
  └→ Drives RLINK demo device requirements
  
RLINK hardware abstraction (Apr 19—May 3)
  ├→ Requires RCORE Device entity
  └→ Unblocks RIQSIM REST API
  
RIQSIM state machine & REST API (Apr 19—May 3)
  ├→ Requires RLINK abstraction
  └→ Unblocks end-to-end integration

Integration & polish (May 3—May 10)
  └→ Requires all three above complete
```

---

## Success Criteria

By **May 10, 2026** (Tax Authority demo):

1. ✓ RCLIENT MAUI app deploys to Windows emulator
2. ✓ Tax cashier can log in with PIN
3. ✓ System accepts cash input via simulator device
4. ✓ Real-time transaction progress visible on screen
5. ✓ Change dispensing calculation runs and displays
6. ✓ No unhandled exceptions during demo scenario
7. ✓ Scenario completes in under 3 minutes end-to-end

---

## Notes

- **RIQSIM priority:** Simulator must be headless and REST-driven; avoid UI blocking
- **RCORE stability:** Entities locked after Apr 19; breaking changes trigger cascading delays
- **RCLIENT scope:** Demo requires MAUI only; Blazor Server backlog for post-GA phases
- **RLINK Phase 0:** Focuses on in-memory registry and basic request/response; defer Phase 1 (sync, observability) to post-demo
