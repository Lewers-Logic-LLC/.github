# Recycler.IQ --- Architecture Decision Records
## Simulator Architecture
**April 11, 2026**
**Company:** Lewers Logic LLC
**Copyright:** &copy; 2026 Lewers Logic LLC. All rights reserved.

**Status:** Final

> This document records architectural decisions for the Recycler.IQ Simulator (recycleriq-simulator repo). These decisions supplement the Master PRD v4 and Simulator PRD.

<!--
  Jira Project: RIQSIM (RecyclerIQ Simulator)
  Epics: RIQSIM-1 (Repo Setup), RIQSIM-2 (Simulator Core)
  Last Synced: 2026-04-11
-->

---

## ADR-001: Standalone Simulator Process with Independent Repository
<!-- Jira: RIQSIM-3 | Epic: RIQSIM-1 | Synced: 2026-04-11 | Cross-ref: Platform/repository-structure-decisions.md -->

| Field | Value |
|---|---|
| ADR ID | ADR-001 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

The simulator could be embedded within Link.Service (in-process), bundled in the same repo, or maintained as a completely standalone product. The simulator serves multiple purposes: trade show demos, cloud demos, dev/QA/training environments, and is potentially licensable to third-party integrators.

### Decision

The simulator is a **standalone process in its own repository** (`recycleriq-simulator`). It runs as a separate Blazor Server application and communicates with Link.Service over REST API. It has its own release cycle, versioning, and deployment pipeline.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **Embedded in Link.Service** | No network hop, simpler deployment | Tight coupling, can't license separately, bloats Link.Service |
| **Same repo as Link.Service** | Shared build pipeline | Coupled release cycles, harder to license independently |
| **Standalone repo + process** | Independent versioning, licensable, clean separation | Network hop (REST), separate deployment step |

### Consequences

- Simulator versions and deploys independently from Link.Service
- Potentially licensable as a standalone product for third-party integrators
- `SimulatorRecyclerClient` in Link.Service is a thin HTTP client calling the simulator REST API
- Simulator must be started separately (or by the bootstrapper installer) alongside Link.Service
- `Device.SimulatorUrl` in the database points to the simulator's REST API endpoint

---

## ADR-002: Blazor Server with Headless REST API Mode
<!-- Jira: RIQSIM-6,RIQSIM-8 | Epic: RIQSIM-2 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-002 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

The simulator needs two operating modes: an interactive UI mode for standalone testing and demos, and a headless mode where it runs as a pure REST API service (no UI) for cloud demos and automated testing. The technology choice must support both modes without separate codebases.

### Decision

Build the simulator as a **Blazor Server application** with an embedded REST API controller. When launched with the `--headless` flag, it starts without the Blazor Server UI --- REST API only. Both modes share the same `SimulatorEngine` backend.

### REST API Surface

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/simulator/inventory` | Current denomination inventory |
| POST | `/api/simulator/connect` | Connect recycler |
| POST | `/api/simulator/disconnect` | Disconnect recycler |
| POST | `/api/simulator/deposit/start` | Begin deposit session |
| POST | `/api/simulator/deposit/end` | End deposit, return result |
| POST | `/api/simulator/withdraw` | Dispense cash |
| POST | `/api/simulator/actions/insert-bills` | Simulate inserting bills |
| POST | `/api/simulator/actions/remove-cash` | Remove cash from pocket |
| POST | `/api/simulator/actions/jam` | Simulate hardware jam |
| POST | `/api/simulator/actions/clear-jam` | Clear jam |
| GET | `/api/simulator/status` | Current simulator state |
| POST | `/api/simulator/reset` | Reset to initial state |

### Consequences

- Single codebase serves both interactive and headless scenarios
- Blazor Server UI provides a visual control panel for interactive testing
- Headless mode is lightweight --- no browser or UI rendering overhead
- REST API is the integration contract for `SimulatorRecyclerClient` in Link.Service
- Cloud demos run headless simulators behind internal URLs

---

## ADR-003: In-Memory State Machine for Simulator Engine
<!-- Jira: RIQSIM-5 | Epic: RIQSIM-2 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-003 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

The simulator must emulate the Kisan KR10's behavior: idle state, depositing, dispensing, jammed, and error conditions. It needs to track denomination inventory and fire events when bills are inserted. The state management approach must be fast and predictable for real-time UI updates.

### Decision

Use an **in-memory state machine** (`SimulatorEngine` class) with a `SimulatorState` enum. Inventory is tracked as a `Dictionary<int, int>` (denomination to count). State transitions are synchronous and event-driven via `EventHandler<BillInsertedEventArgs>`.

### State Diagram

```
Idle ──(StartDeposit)──> Depositing ──(EndDeposit)──> Idle
Idle ──(Withdraw)──> Dispensing ──(Complete)──> Idle
Any  ──(SimulateJam)──> Jammed ──(ClearJam)──> Idle
Any  ──(Error)──> Error ──(Reset)──> Idle
```

### Consequences

- No persistence needed --- simulator state resets on restart (by design)
- Initial inventory is configurable via `appsettings.json`
- `BillInserted` events fire per-bill for realistic real-time UI updates
- State machine is deterministic --- easy to unit test
- No database dependency in the simulator process
- Open item: event delivery mechanism from simulator to `SimulatorRecyclerClient` (SSE vs. polling) is not yet defined

---

## ADR-004: Database-Driven Simulator Resolution (Not Config-Driven)
<!-- Jira: RCORE-106 | Epic: RCORE-95 | Synced: 2026-04-11 | Cross-ref: RLINK ADR-001 -->

| Field | Value |
|---|---|
| ADR ID | ADR-004 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

The system needs a way to determine whether a given device should use real hardware (`KisanRecycler`) or the simulator (`SimulatorRecyclerClient`). This could be driven by a config file toggle, an environment variable, or a database field on the `Device` entity.

### Decision

Simulator resolution is **database-driven via `Device.IsSimulator`**. When `IsSimulator = true`, `RecyclerFactory` resolves `SimulatorRecyclerClient` using `Device.SimulatorUrl`. This flag is independent of `IsDemoMode` --- a device can be a simulator in any mode (demo, production, dev, QA, training).

### Key Principle

**Simulator is not locked to demo mode.** The `Device.IsSimulator` flag and the `AppModeOptions.IsDemoMode` flag are orthogonal concerns:

| | IsDemoMode = true | IsDemoMode = false |
|---|---|---|
| **IsSimulator = true** | Demo with simulator (trade show) | Production/QA with simulator (testing) |
| **IsSimulator = false** | Demo with real hardware (trade show) | Production with real hardware (normal) |

### Consequences

- Switching between simulator and real hardware is a database change --- no code changes, no redeployment
- Simulator control panel visibility is driven by `ISimulatorControl.IsAvailable` (device capability), not by demo mode
- Only demo-specific UI (Reset Demo, Create New Demo) is hidden in production mode
- `Device.SimulatorUrl` is required when `IsSimulator = true`, null when false (enforced as a domain invariant)
- Multiple simulators can run simultaneously on different ports for multi-recycler testing

---

## ADR-005: REST for Link.Service-to-Simulator Communication
<!-- Jira: RIQSIM-6 | Epic: RIQSIM-2 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-005 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

`SimulatorRecyclerClient` in Link.Service needs to communicate with the headless simulator. Options were gRPC (matching client-to-Link.Service pattern), REST, or in-process calls.

### Decision

Use **REST (HTTP/JSON)** for Link.Service-to-Simulator communication. `SimulatorRecyclerClient` is a standard `HttpClient` calling the simulator's REST API endpoints.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **gRPC** | Typed contracts, streaming | Overkill for simulator, adds proto dependency to simulator repo |
| **REST** | Simple, debuggable (curl/Postman), no shared proto files | No streaming (event delivery TBD) |
| **In-process** | Zero latency, no serialization | Can't run standalone, can't license separately |

### Consequences

- Simple to debug and test --- any HTTP client can call the simulator
- No shared `.proto` files between simulator and Link.Service repos
- `SimulatorRecyclerClient` is a thin HTTP wrapper --- easy to maintain
- Event delivery (e.g., `BillInserted` during a deposit) requires a separate mechanism --- SSE or polling (open item)
- Simulator URL is stored per-device in `Device.SimulatorUrl`, supporting multiple simultaneous simulator instances

---

## Open Items

| Item | Priority | Status |
|------|----------|--------|
| BillInserted event delivery mechanism (SSE vs. polling) | High | Not defined --- `SimulatorRecyclerClient` needs to receive real-time events from simulator |
| Simulator licensing model and distribution | Future | Placeholder --- potentially licensable to third parties |
| Multi-instance simulator orchestration for cloud demos | Medium | Not defined --- how to spin up/down simulator instances for dealer demos |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-11 | Claude (generated from PRD) | Initial ADR set --- 5 decisions extracted from Simulator PRD |
