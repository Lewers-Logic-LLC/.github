# Recycler.IQ — Simulator

**Company:** Lewers Logic LLC
**Copyright:** © 2026 Lewers Logic LLC. All rights reserved.
**Product:** Recycler.IQ
**Jira Project:** SIM
**Repository:** recycleriq-simulator

## Product Requirements Document & Technical Specification

**Version 1.0 | March 2026**
**Status:** Final

---

## Table of Contents
1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Requirements](#3-requirements)
4. [Hardware Abstraction (IRecycler)](#4-hardware-abstraction-irecycler)
5. [ISimulatorControl Interface](#5-isimulatorcontrol-interface)
6. [SimulatorRecyclerClient](#6-simulatorrecyclerclient)
7. [Headless Mode & REST API](#7-headless-mode--rest-api)
8. [Simulator Engine (State Machine)](#8-simulator-engine-state-machine)
9. [Simulator Control Panel (In-App)](#9-simulator-control-panel-in-app)
10. [Hardware ID & Configuration](#10-hardware-id--configuration)
11. [Solution Structure](#11-solution-structure)
12. [Open Items](#12-open-items)

---

## 1. Overview

The Recycler.IQ Simulator is a standalone, general-purpose hardware simulator that emulates the Kisan KR10 cash recycler. It is a separate product in its own repository (`recycleriq-simulator`) and is potentially licensable to third parties.

The simulator serves multiple purposes:
- **Trade show fallback** — when real Kisan KR10 hardware is unavailable
- **Cloud demos** — headless mode powers remote dealer demos without physical hardware
- **Dev/QA/Training** — any `Device` with `IsSimulator = true` gets simulator behavior, regardless of demo or production mode
- **Future** — potentially licensable as a standalone product for third-party integrators

### 1.1 Design Principles

- **Simulator is not locked to demo mode** — any `Device` record with `IsSimulator = true` gets simulator behavior in any mode (demo, production, dev, QA, training). `Device.IsSimulator` is a database-driven flag, not a config toggle.
- `IRecycler` abstraction decouples hardware from business logic — simulator plugs in transparently
- Client never knows or cares whether it's talking to real hardware or the simulator
- Simulator control panel visibility is driven by device capability (`ISimulatorControl.IsAvailable`), not by `IsDemoMode`
- Only demo-specific UI (Reset Demo, Create New Demo) is hidden in production mode — simulator controls are always available when the connected device is a simulator

---

## 2. Architecture

The simulator runs as a **separate process** and communicates with Link.Service via REST API. The MAUI/WebClient never talks to the simulator directly — all interaction goes through Link.Service via `ILinkClient` IPC.

```
┌─────────────────────────────────────────────────┐
│  Tax Authority Client (MAUI or WebClient)        │
│  └── Simulator Control Panel                     │
│         └── calls ISimulatorControl via           │
│             ILinkClient IPC                       │
│                                                   │
│  RecyclerIQ.Link.Service                         │
│  ├── IRecycler → resolved per Device record      │
│  │   ├── Device.IsSimulator = false              │
│  │   │   └── KisanRecycler (real HW)             │
│  │   └── Device.IsSimulator = true               │
│  │       └── SimulatorRecyclerClient             │
│  │           └── implements ISimulatorControl     │
│  └── IPC endpoint for client                     │
│                                                   │
│  Headless Simulator (separate process)           │
│  ├── REST API endpoints                          │
│  │   ├── Normal recycler actions                 │
│  │   └── Simulator-control actions               │
│  └── SimulatorEngine (in-memory state machine)   │
└─────────────────────────────────────────────────┘
```

### Why standalone (not with Link.Service)?

- The Simulator is a general-purpose hardware simulator, not an internal-only tool.
- It has an independent release cycle — it versions and deploys separately.
- It is potentially licensable to third parties.
- See [repository-structure-decisions.md](../03%20-%20Architecture%20Decisions/repository-structure-decisions.md) for full rationale.

---

## 3. Requirements
<!-- Jira: RIQSIM-3,RIQSIM-4 | Epic: RIQSIM-1 | Synced: 2026-04-09 | Note: Repo scaffold + CI pipeline -->

### 3.1 Simulator Control Panel
<!-- Jira: RIQSIM-7,RCLIENT-62 | Epic: RIQSIM-2,RCLIENT-9 | Synced: 2026-04-09 -->

| ID | Requirement | Priority |
|---|---|---|
| SC-01 | Simulator control panel embedded in Tax Authority client UI — visible when Device.IsSimulator = true (any mode, not just demo) | Must Have |
| SC-02 | Controls include: Insert Bills (by denomination and count), Remove Cash, Simulate Jam, Clear Jam | Must Have |
| SC-03 | Panel only visible when connected device's IsSimulator flag is true in database | Must Have |
| SC-04 | Simulator runs in headless mode — no separate UI window required | Must Have |
| SC-05 | Client calls simulator control actions through Link.Service IPC (Link.Service forwards to simulator REST API) | Must Have |
| SC-06 | Simulator connection config (URL) stored in Device record in database (Device.SimulatorUrl) | Must Have |

### 3.2 Hardware / Simulator Toggle
<!-- Jira: RCORE-106 | Epic: RCORE-95 | Synced: 2026-04-09 | Note: Device.IsSimulator flag in Domain -->

| ID | Requirement | Priority |
|---|---|---|
| HT-01 | IRecycler abstraction used for all hardware calls — client never calls hardware directly. All communication goes through Link.Service via ILinkClient IPC. | Must Have |
| HT-02 | Device.IsSimulator flag in database determines which IRecycler implementation Link.Service resolves (SimulatorRecyclerClient vs KisanRecycler) | Must Have |
| HT-03 | Switching between simulator and real hardware requires only a database change (Device record) — no code changes | Must Have |
| HT-04 | Simulator is not locked to demo mode — any Device with IsSimulator = true gets simulator behavior in any mode (demo, production, dev, QA, training) | Must Have |

---

## 4. Hardware Abstraction (IRecycler)

The `IRecycler` interface lives in `RecyclerIQ.Domain` (recycleriq-core NuGet). Both real hardware and the simulator implement this interface.

```csharp
public interface IRecycler
{
    Task ConnectAsync();
    Task DisconnectAsync();
    Task<DenominationInventory> GetInventoryAsync();
    Task StartDepositAsync();
    Task<DepositResult> EndDepositAsync();
    Task<WithdrawResult> WithdrawAsync(decimal amount);
    event EventHandler<BillInsertedEventArgs> BillInserted;
}
```

> **Note:** `IRecycler` is defined here for context but lives in `RecyclerIQ.Domain` (RIQ-CORE). The implementations (`KisanRecycler`, `SimulatorRecyclerClient`, `RecyclerFactory`) live in `RecyclerIQ.Hardware` within the recycleriq-link repo (RIQ-LINK).

---

## 5. ISimulatorControl Interface

Simulator trigger actions (physical events that would happen in the real world) are exposed via a separate interface. `SimulatorRecyclerClient` implements both `IRecycler` and `ISimulatorControl`. Link.Service checks if the current `IRecycler` instance also implements `ISimulatorControl` and exposes those actions via IPC to the client.

```csharp
public interface ISimulatorControl
{
    bool IsAvailable { get; }  // true for simulator, false for real hardware
    Task InsertBillsAsync(Dictionary<int, int> bills);
    Task SimulateJamAsync();
    Task ClearJamAsync();
    Task RemoveCashAsync();
    Task ResetAsync();
    Task<SimulatorStatus> GetStatusAsync();
}
```

The client asks Link.Service via IPC: "Does this device support simulator controls?" If yes, it shows the simulator control panel. This keeps the client completely agnostic to what's behind Link.Service.

> **Note:** `ISimulatorControl` lives in `RecyclerIQ.Hardware` within the recycleriq-link repo (RIQ-LINK), not in this simulator repo.

---

## 6. SimulatorRecyclerClient

Implementation of both `IRecycler` and `ISimulatorControl` that calls the headless simulator REST API. This runs inside **Link.Service** — the client interacts with it via `ILinkClient` IPC, not directly.

```csharp
public class SimulatorRecyclerClient : IRecycler, ISimulatorControl
{
    private readonly HttpClient _http;
    private readonly string _baseUrl;

    public SimulatorRecyclerClient(string simulatorUrl)
    {
        _baseUrl = simulatorUrl;
        _http = new HttpClient { BaseAddress = new Uri(simulatorUrl) };
    }

    public async Task<DenominationInventory> GetInventoryAsync()
    {
        var response = await _http.GetFromJsonAsync<DenominationInventory>("/api/simulator/inventory");
        return response!;
    }

    public async Task<WithdrawResult> WithdrawAsync(decimal amount)
    {
        var response = await _http.PostAsJsonAsync("/api/simulator/withdraw", new { Amount = amount });
        return await response.Content.ReadFromJsonAsync<WithdrawResult>();
    }

    // ... other methods map to simulator REST endpoints
}
```

> **Note:** `SimulatorRecyclerClient` lives in `RecyclerIQ.Hardware` within the recycleriq-link repo (RIQ-LINK). It is the HTTP client that calls the simulator's REST API.

---

## 7. Headless Mode & REST API
<!-- Jira: RIQSIM-6,RIQSIM-8 | Epic: RIQSIM-2 | Synced: 2026-04-09 -->

### 7.1 Overview
The Blazor Server simulator is extended with a REST API controller. When called with `--headless` flag, it starts without the Blazor Server UI — REST API only.

### 7.2 REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/simulator/inventory` | Get current denomination inventory |
| POST | `/api/simulator/connect` | Connect recycler |
| POST | `/api/simulator/disconnect` | Disconnect recycler |
| POST | `/api/simulator/deposit/start` | Begin deposit session |
| POST | `/api/simulator/deposit/end` | End deposit session, return result |
| POST | `/api/simulator/withdraw` | Dispense cash (change or withdrawal) |
| POST | `/api/simulator/actions/insert-bills` | Simulate inserting bills |
| POST | `/api/simulator/actions/remove-cash` | Simulate removing cash from pocket |
| POST | `/api/simulator/actions/jam` | Simulate a hardware jam |
| POST | `/api/simulator/actions/clear-jam` | Clear simulated jam |
| GET | `/api/simulator/status` | Get current simulator state |
| POST | `/api/simulator/reset` | Reset simulator to initial state |

### 7.3 Insert Bills Request

```csharp
// POST /api/simulator/actions/insert-bills
public class InsertBillsRequest
{
    // Key = denomination (e.g., 1, 5, 10, 20, 50, 100)
    // Value = count
    public Dictionary<int, int> Bills { get; set; } = new();
}
```

---

## 8. Simulator Engine (State Machine)
<!-- Jira: RIQSIM-5 | Epic: RIQSIM-2 | Synced: 2026-04-09 -->

```csharp
public class SimulatorEngine
{
    public SimulatorState State { get; private set; } = SimulatorState.Idle;
    public Dictionary<int, int> Inventory { get; private set; }

    // Raises event consumed by SimulatorRecyclerClient via SSE or polling
    public event EventHandler<BillInsertedEventArgs>? BillInserted;

    public void InsertBills(Dictionary<int, int> bills)
    {
        foreach (var (denom, count) in bills)
        {
            Inventory[denom] = (Inventory.GetValueOrDefault(denom)) + count;
            for (int i = 0; i < count; i++)
                BillInserted?.Invoke(this, new BillInsertedEventArgs(denom));
        }
    }

    public void SimulateJam() => State = SimulatorState.Jammed;
    public void ClearJam() => State = SimulatorState.Idle;
}

public enum SimulatorState { Idle, Depositing, Dispensing, Jammed, Error }
```

---

## 9. Simulator Control Panel (In-App)
<!-- Jira: RCLIENT-62 | Epic: RCLIENT-9 | Synced: 2026-04-09 | Note: UI component in recycleriq-clients -->

### 9.1 Overview
When the connected device supports simulator controls (`ISimulatorControl.IsAvailable = true`), the Tax Authority client displays a collapsible simulator control panel on applicable pages. This works in both demo and production modes — the panel visibility is driven by the device's capabilities, not by `IsDemoMode`.

The client queries Link.Service via IPC to determine if simulator controls are available. All simulator trigger actions are routed through Link.Service → `ISimulatorControl` → Simulator REST API.

### 9.2 Component: SimulatorControlPanel.razor

```razor
@if (SimulatorControlAvailable)
{
    <div class="simulator-panel">
        <h4>Simulator Controls</h4>

        <section>
            <h5>Insert Bills</h5>
            @foreach (var denom in new[] { 1, 5, 10, 20, 50, 100 })
            {
                <div>
                    <label>$@denom</label>
                    <input type="number" min="0" @bind="insertCounts[denom]" />
                </div>
            }
            <button @onclick="InsertBills">Insert</button>
        </section>

        <section>
            <h5>Hardware Actions</h5>
            <button @onclick="SimulateJam">Simulate Jam</button>
            <button @onclick="ClearJam">Clear Jam</button>
            <button @onclick="RemoveCash">Remove Cash from Pocket</button>
        </section>

        <section>
            <h5>Status</h5>
            <p>State: @simulatorStatus?.State</p>
        </section>
    </div>
}
```

### 9.3 Panel Placement
The panel appears on the **Collector** page (primary demo page) as a collapsible side panel or bottom drawer. Visible whenever the device reports `ISimulatorControl.IsAvailable = true` — not limited to demo mode. All button actions call Link.Service via `ILinkClient` IPC, which forwards them to `ISimulatorControl` on the current `IRecycler` instance.

> **Note:** `SimulatorControlPanel.razor` lives in `RecyclerIQ.UI.Shared` within the recycleriq-clients repo (RIQ-CLIENT). It is documented here because it is the primary UI for interacting with the simulator.

---

## 10. Hardware ID & Configuration
<!-- Jira: RIQSIM-9 | Epic: RIQSIM-2 | Synced: 2026-04-09 | Note: Multi-instance support -->

Each simulator instance has a unique hardware ID (GUID) assigned at startup:

```json
// appsettings.json (simulator)
{
  "Simulator": {
    "HardwareId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "InitialInventory": {
      "1": 50, "5": 40, "10": 30, "20": 20, "50": 10, "100": 5
    }
  }
}
```

The `HardwareId` in the simulator config must match the `Device.HardwareId` in the database. The `Device.SimulatorUrl` field stores the URL where the simulator's REST API is reachable (e.g., `http://localhost:5100` for local, `https://simulator-internal.recycleriq.com` for cloud).

---

## 11. Solution Structure
<!-- Jira: RIQSIM-3 | Epic: RIQSIM-1 | Synced: 2026-04-09 -->

**recycleriq-simulator repo:**
```
RecyclerIQ.Simulator.sln
│
└── RecyclerIQ.Simulator/                      # Blazor Server — standalone process
    ├── SimulatorController.cs                 # REST API endpoints
    ├── SimulatorEngine.cs                     # In-memory recycler state machine
    ├── Program.cs                             # Blazor Server host + --headless flag
    └── appsettings.json                       # HardwareId, InitialInventory
```

### Cross-repo dependencies

Code that lives in **other repos** but is tightly coupled to the simulator:

| Component | Repo | Project | Notes |
|---|---|---|---|
| `IRecycler` | recycleriq-core | RecyclerIQ.Domain | Interface the simulator implements (via NuGet) |
| `ISimulatorControl` | recycleriq-link | RecyclerIQ.Hardware | Simulator trigger interface |
| `SimulatorRecyclerClient` | recycleriq-link | RecyclerIQ.Hardware | HTTP client that calls simulator REST API |
| `RecyclerFactory` | recycleriq-link | RecyclerIQ.Hardware | Resolves `IRecycler` from `Device.IsSimulator` |
| `SimulatorControlPanel.razor` | recycleriq-clients | RecyclerIQ.UI.Shared | In-app UI for simulator controls |

---

## 12. Open Items

| Item | Status | Notes |
|---|---|---|
| Simulator bill-inserted event delivery | NOT DEFINED | SSE vs polling from SimulatorRecyclerClient to receive BillInserted events |
| Simulator licensing model and distribution mechanism | Future | Placeholder — potentially licensable to third parties |

---

*Recycler.IQ — Simulator PRD & Technical Specification v1.0 | March 2026 | CONFIDENTIAL*
