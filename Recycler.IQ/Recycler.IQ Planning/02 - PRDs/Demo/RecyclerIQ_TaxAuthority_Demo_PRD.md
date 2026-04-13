# Recycler.IQ — Tax Authority Demo System

**Company:** Lewers Logic LLC

## Product Requirements Document

**Version 1.0 | March 2026**
**Status:** Final

---

## Part 1: Overview & Goals

### 1.1 Purpose

This document defines the requirements for the Recycler.IQ Tax Authority Demo System — a fully self-contained, demonstrable version of the Tax Authority client that can be deployed both locally (trade show, on-site) and in the cloud (remote dealer demos). The demo system is built on the same codebase as production, controlled by a runtime mode flag.

### 1.2 Business Drivers

- Trade show demo needed by second week of May — hands-on demo with real Kisan KR10 hardware
- Post-show cloud-hosted demo for dealers to use at prospect sites without requiring hardware
- Self-serve demo provisioning via marketing website for inbound leads
- Protect IP while cloud API and production infrastructure are still being built

### 1.3 Success Metrics

| Metric | Target |
|---|---|
| Trade show demo ready | Second week of May 2026 |
| Cloud demo deployed | Same timeframe as trade show |
| Self-serve provisioning live | Post-trade show |
| Demo reset time | < 30 seconds |
| Demo session isolation | 100% — no cross-tenant data leakage |

---

## Part 2: Demo System Scope

### 2.1 What Is In Scope

- Tax Authority local client (MAUI Blazor Hybrid) running in demo mode
- Pre-seeded SQLite demo database with realistic tenant, user, and transaction data
- Headless simulator REST API (Kisan KR10 simulated) for hardware action triggers
- Simulator control panel embedded in the client UI (insert bills, jams, remove cash, etc.)
- Demo mode toggle — same codebase as production, controlled by config flag
- Reset Demo functionality — wipes and re-seeds to initial state
- Create New Demo wizard — provisions a new prospect demo environment
- Website form integration — self-serve demo request with email provisioning
- Local deployment (trade show) and cloud deployment (post-show) using same codebase

### 2.2 What Is Out of Scope

- Cloud API implementation (stubbed/mocked for demo)
- Production Azure SQL database (SQLite used for demo)
- Real license server (license validation stubbed in demo mode)
- Real sync to cloud (all data stays local in demo mode)
- Retail tenant type (Tax Authority only at this stage)

---

## Part 3: Demo Deployment Modes

### 3.1 Local Demo (Trade Show)

The MAUI Blazor Hybrid client runs as a Windows .exe on a laptop or terminal at the trade show. It connects to the physical Kisan KR10 hardware for a tactile, realistic demonstration. The SQLite demo database is pre-seeded on the local machine. A headless simulator is also available as fallback if hardware is unavailable.

| Parameter | Detail |
|---|---|
| Deployment | Windows .exe installed locally |
| Hardware | Physical Kisan KR10 recycler |
| Fallback | Headless simulator if hardware unavailable |
| Database | Local SQLite file, pre-seeded |
| Cloud API | Not required — fully offline capable |
| Reset | Reset Demo button available in UI |

### 3.2 Cloud Demo (Post-Show / Dealer Use)

For cloud demos, `RecyclerIQ.UI.WebClient` (Blazor Server) hosts the same UI components from `RecyclerIQ.UI.Shared` in a browser-accessible application. Dealers access it via browser URL — no installation required. It connects to the headless simulator. Each prospect gets their own isolated demo environment provisioned via the website form.

| Parameter | Detail |
|---|---|
| Deployment | Cloud-hosted (Azure App Service) — RecyclerIQ.UI.WebClient (Blazor Server) |
| Hardware | Headless simulator (no physical hardware required) |
| Database | SQLite file per demo session, isolated per prospect |
| Provisioning | Triggered by website form submission |
| Reset | Reset Demo available; Create New Demo also available |
| Session persistence | Data persists until manually reset or expiry |

> **Note:** The MAUI Blazor Hybrid client is a native desktop app and cannot run in a browser. The WebClient project is a thin Blazor Server wrapper that hosts the same `RecyclerIQ.UI.Shared` Razor components server-side, providing browser access over SignalR.

---

## Part 4: Feature Requirements

### 4.1 Demo Mode
<!-- Jira: RCLIENT-25,RCLIENT-29 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

| ID | Requirement | Priority |
|---|---|---|
| DM-01 | Single codebase — demo vs production controlled by IsDemoMode config flag | Must Have |
| DM-02 | Demo mode hides all sync, cloud API, and license enforcement UI elements | Must Have |
| DM-03 | Demo mode shows simulator control panel when simulator is configured | Must Have |
| DM-04 | Production mode requires successful cloud API handshake before allowing operations | Must Have |
| DM-05 | Config file obfuscated/encrypted to prevent easy tampering | Should Have |

### 4.2 Demo Database
<!-- Jira: RCLIENT-26 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

| ID | Requirement | Priority |
|---|---|---|
| DB-01 | SQLite used as demo database — same offline database already used by production client | Must Have |
| DB-02 | Demo database pre-seeded with demo tenant, users, recycler config, and sample transactions | Must Have |
| DB-03 | Seed data includes realistic transaction history for reporting demonstration | Must Have |
| DB-04 | Authentication validated locally against SQLite — no cloud API required in demo mode | Must Have |
| DB-05 | Each demo prospect gets an isolated SQLite database — no cross-tenant data | Must Have |

### 4.3 Reset Demo
<!-- Jira: RCLIENT-27 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

| ID | Requirement | Priority |
|---|---|---|
| RD-01 | Reset Demo button available in demo mode UI (operator mode — for when someone messes up demo data) | Must Have |
| RD-02 | Reset wipes all transaction data and re-seeds to initial state | Must Have |
| RD-03 | Reset completes in under 30 seconds | Must Have |
| RD-04 | Confirmation dialog before reset to prevent accidental wipes | Must Have |
| RD-05 | Reset available in both local and cloud deployments | Must Have |

### 4.4 Create New Demo
<!-- Jira: RCLIENT-28 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

| ID | Requirement | Priority |
|---|---|---|
| CN-01 | Wizard UI to create a new demo environment with prospect name/details | Must Have |
| CN-02 | Creates new demo tenant seeded with initial data customized to prospect | Must Have |
| CN-03 | Generates unique simulator hardware ID (GUID) for the new demo instance | Must Have |
| CN-04 | Available in both local (trade show) and cloud deployments | Must Have |

### 4.5 Self-Serve Demo Provisioning (Website)
<!-- Jira: RCLIENT-35,RCLIENT-36,RCLIENT-37,RCLIENT-38,RCLIENT-39 | Epic: RCLIENT-6 | Synced: 2026-04-09 -->

| ID | Requirement | Priority |
|---|---|---|
| SP-01 | Marketing website hosts demo request form collecting name, company, email | Must Have |
| SP-02 | Form submission triggers backend process to seed new demo tenant database | Must Have |
| SP-03 | System generates unique simulator hardware ID and demo user credentials | Must Have |
| SP-04 | Email sent to prospect with login credentials and cloud demo app URL | Must Have |
| SP-05 | Demo environment persists until manually reset or scheduled expiry | Should Have |
| SP-06 | Admin notification when new demo is provisioned | Nice to Have |

### 4.6 Simulator Control Panel & Hardware Toggle
<!-- Jira: RCLIENT-62 | Epic: RCLIENT-9 | Synced: 2026-04-09 -->

> **Moved to dedicated PRD:** Full simulator requirements (SC-01 through SC-06, HT-01 through HT-04), technical specs, REST API, state machine, and control panel design have been extracted to [PRD_Simulator.md](PRD_Simulator.md) (SIM project).
>
> Key integration points: the simulator is a standalone process; clients interact with it only through Link.Service via `ILinkClient` IPC; `Device.IsSimulator` in the database drives hardware vs simulator resolution; simulator is not locked to demo mode.

---

## Part 5: IP Protection

### 5.1 Demo Mode Safeguards
<!-- Jira: RCLIENT-30 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

- IsDemoMode flag hard-coded check prevents switching to production without valid cloud API
- Demo JWT license bound to demo hardware ID — cannot be used on production systems
- Production mode requires successful cloud API handshake — cannot operate production without server
- Config values obfuscated/encrypted to prevent easy reverse engineering

### 5.2 Limitations (Accepted Risk for Demo Phase)

> Full hardware-level license enforcement requires cloud API — deferred to production launch.

> A determined actor could reverse-engineer the local MAUI binary. This is an accepted risk at demo stage.

> Real enforcement (hardware binding, subscription checks, audit logging) implemented when cloud API goes live.

---

## Part 6: Open Items

| Item | Status | Owner |
|---|---|---|
| Cloud hosting platform for demo (Azure App Service for WebClient) | EVALUATING | Tommy |
| Website form platform and backend trigger mechanism | NOT STARTED | Tommy |
| Email provider for demo provisioning emails | NOT DECIDED | Tommy |
| Demo session expiry policy | NOT DEFINED | Tommy |
| Demo seed data content (transaction types, amounts, dates) | NOT DEFINED | Tommy |
