# Recycler.IQ — Tax Authority Demo System
## Detailed Technical Specification
**Version 1.0 | March 2026 | CONFIDENTIAL**
**Company:** Lewers Logic LLC
**Status:** Final
**Copyright:** © 2026 Lewers Logic LLC. All rights reserved.

---

## Table of Contents
1. [Context & Goals](#1-context--goals)
2. [Architecture Overview](#2-architecture-overview)
3. [Demo Mode vs Production Mode](#3-demo-mode-vs-production-mode)
4. [Solution Structure](#4-solution-structure)
5. [Demo Database (SQLite)](#5-demo-database-sqlite)
6. [Authentication in Demo Mode](#6-authentication-in-demo-mode)
7. [Hardware Abstraction & Simulator](#7-hardware-abstraction--simulator) *(integration summary — full spec in [PRD_Simulator.md](PRD_Simulator.md))*
8. [Licensing in Demo Mode](#8-licensing-in-demo-mode)
9. [Reset Demo Functionality](#9-reset-demo-functionality)
10. [Create New Demo Wizard](#10-create-new-demo-wizard)
11. [Self-Serve Demo Provisioning (Website)](#11-self-serve-demo-provisioning-website)
12. [IP Protection](#12-ip-protection)
13. [Deployment Scenarios](#13-deployment-scenarios)
14. [Open Items](#14-open-items)

---

## 1. Context & Goals

### 1.1 Background
Recycler.IQ is a B2B SaaS cash management platform integrating with physical cash recyclers. The Tax Authority client is the first product going to market — a cashier-facing transaction terminal for municipal cash collection.

The cloud API and production Azure infrastructure are not yet built. A fully functional, demonstrable Tax Authority client is needed immediately for:
- **Trade show** (second week of May 2026) — local demo with real Kisan KR10 hardware
- **Post-show dealer demos** — cloud-hosted version with simulator, accessible without hardware

### 1.2 Design Principles
- Single codebase — demo and production are the same app, mode-switched by config
- SQLite is already part of the production architecture (offline capability) — demo reuses it
- `IRecycler` abstraction already decouples hardware from business logic — simulator plugs in transparently
- Client never knows or cares whether it's talking to real hardware or the simulator
- **Simulator is not locked to demo mode** — any `Device` record with `IsSimulator = true` gets simulator behavior in any mode (demo, production, dev, QA, training). `Device.IsSimulator` is a database-driven flag, not a config toggle.
- Simulator control panel visibility is driven by device capability (`ISimulatorControl.IsAvailable`), not by `IsDemoMode`
- Only demo-specific UI (Reset Demo, Create New Demo) is hidden in production mode — simulator controls are always available when the connected device is a simulator

---

## 2. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  DEMO SYSTEM (IsDemoMode = true)                                     │
│                                                                      │
│  Tax Authority MAUI Client                                          │
│  ├── Local SQLite (demo database, pre-seeded by DemoDataSeeder)     │
│  ├── IIdentityProvider → LocalIdentityProvider                      │
│  ├── ILinkClient → IPC to Link.Service                              │
│  └── Simulator Control Panel (visible when Device.IsSimulator)      │
│         └── calls ISimulatorControl via ILinkClient IPC             │
│                                                                      │
│  RecyclerIQ.Link.Service (IsDemoMode = true)                        │
│  ├── IRecycler → resolved per Device record in SQLite               │
│  │   ├── Device.IsSimulator = false → KisanRecycler (real HW)      │
│  │   └── Device.IsSimulator = true  → SimulatorRecyclerClient       │
│  │       └── also implements ISimulatorControl                      │
│  ├── ILicenseValidator → DemoLicenseValidator (stub)                │
│  ├── ISyncService → NoOpSyncService (no cloud sync)                │
│  └── IPC endpoint for MAUI client                                   │
│                                                                      │
│  Headless Simulator (separate process — only when Device.IsSimulator)│
│  ├── REST API endpoints for normal + simulator-control actions      │
│  └── Simulates Kisan KR10 behavior                                  │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│  PRODUCTION SYSTEM (IsDemoMode = false)                              │
│                                                                      │
│  Tax Authority MAUI Client                                          │
│  ├── Local SQLite (offline queue + cached data)                     │
│  ├── IIdentityProvider → ResilientIdentityProvider                  │
│  ├── ILinkClient → IPC to Link.Service                              │
│  └── Simulator Control Panel (visible when Device.IsSimulator)      │
│         └── Supports simulator in production for dev/QA/training    │
│                                                                      │
│  RecyclerIQ.Link.Service (IsDemoMode = false)                       │
│  ├── IRecycler → resolved per Device record in database             │
│  │   ├── Device.IsSimulator = false → KisanRecycler (real HW)      │
│  │   └── Device.IsSimulator = true  → SimulatorRecyclerClient       │
│  ├── ILicenseValidator → HardwareBoundLicenseValidator              │
│  ├── ISyncService → CloudSyncService → Cloud API                   │
│  └── IPC endpoint for MAUI client                                   │
│                                                                      │
│  Cloud API (Azure)                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

**Key architectural principles:**
- The MAUI client never talks to hardware or the simulator directly. All hardware interaction goes through Link.Service via `ILinkClient` (IPC).
- Link.Service resolves the `IRecycler` implementation from the `Device` record in the database — `Device.IsSimulator` determines whether `KisanRecycler` or `SimulatorRecyclerClient` is used. This is independent of demo/production mode.
- Simulator trigger actions (insert bills, jam, clear jam, etc.) are exposed via `ISimulatorControl` — the MAUI client calls them through Link.Service IPC. Link.Service forwards them to the simulator's REST API. For real hardware devices, these actions are not available.
- The MAUI client shows the simulator control panel when the connected device's `IsSimulator = true` — regardless of demo or production mode. This supports dev/QA/training scenarios in production environments.
- The only thing that changes between demo and production in Link.Service is sync behavior (`NoOpSyncService` vs `CloudSyncService`) and license validation (`DemoLicenseValidator` vs `HardwareBoundLicenseValidator`).

---

## 3. Demo Mode vs Production Mode

### 3.1 Mode Flag
<!-- Jira: RCLIENT-25 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

**MAUI Client (appsettings.json):**

```csharp
{
  "AppMode": {
    "IsDemoMode": true,
    "LinkServiceUrl": "http://localhost:5050"
  }
}

public class AppModeOptions
{
    public bool IsDemoMode { get; set; }
    public bool IsAdminMode { get; set; }  // --admin flag or separate shortcut
    public string LinkServiceUrl { get; set; }
}
```

**Link.Service (appsettings.json):**

```csharp
{
  "AppMode": {
    "IsDemoMode": true
  }
}
```

**Note:** `RecyclerBackend` is no longer a config enum. The `IRecycler` implementation is resolved at runtime from the `Device` record in the database:

```csharp
// Device entity — stored in SQLite (demo) or Azure SQL (production)
public class Device
{
    public Guid DeviceId { get; set; }
    public Guid TenantId { get; set; }
    public string SerialNumber { get; set; }
    public bool IsSimulator { get; set; }
    public string? SimulatorUrl { get; set; }  // populated when IsSimulator = true
    public Guid HardwareId { get; set; }
    public string? MACAddress { get; set; }
}
```

### 3.2 Behavior Differences

| Concern | Component | Demo Mode | Production Mode |
|---|---|---|---|
| Identity provider | MAUI Client | `LocalIdentityProvider` (SQLite only) | `ResilientIdentityProvider` (Cloud + local fallback) |
| Database | MAUI Client | Pre-seeded demo SQLite | Cloud-synced SQLite |
| Hardware communication | MAUI Client | Via `ILinkClient` IPC (same as prod) | Via `ILinkClient` IPC |
| Recycler backend | Link.Service | Resolved from `Device` record — real HW or simulator | Resolved from `Device` record — real HW or simulator |
| Simulator control panel | MAUI Client | Visible when `Device.IsSimulator = true` | Visible when `Device.IsSimulator = true` (dev/QA/training) |
| Simulator trigger actions | Link.Service | Via `ISimulatorControl` → Simulator REST API | Via `ISimulatorControl` → Simulator REST API |
| Sync to cloud | Link.Service | Disabled (`NoOpSyncService`) | Enabled (`CloudSyncService`) |
| License validation | Link.Service | Stub (`DemoLicenseValidator`) | Hardware-bound JWT via cloud API |
| Reset Demo button | MAUI Client | Visible (TenantAdmin role, operator mode) | Hidden |
| Create New Demo button | MAUI Client | Visible (TenantAdmin role, operator mode) | Hidden |
| Cloud API connectivity | Link.Service | Skipped | Required on startup |

### 3.3 DI Wiring at Startup
<!-- Jira: RCLIENT-15 | Epic: RCLIENT-2 | Synced: 2026-04-09 -->

The MAUI client and Link.Service are separate processes with separate DI containers. The MAUI client owns auth and UI concerns. Link.Service owns hardware, sync, and licensing.

**MAUI Client (MauiProgram.cs):**

```csharp
var appMode = builder.Configuration
    .GetSection("AppMode")
    .Get<AppModeOptions>();

// Identity provider — shared LocalIdentityProvider for demo AND production offline
// See Auth ADR Sections 1, 5 for full pattern (IIdentityProvider + AuthCredentials)
if (appMode.IsDemoMode)
{
    builder.Services.AddSingleton<IIdentityProvider, LocalIdentityProvider>();
}
else
{
    builder.Services.AddSingleton<IIdentityProvider, ResilientIdentityProvider>();
}

// Blazor auth state — same wrapper regardless of mode
builder.Services.AddScoped<AuthenticationStateProvider, RiqAuthenticationStateProvider>();

// IPC client to Link.Service — same in demo and production
builder.Services.AddSingleton<ILinkClient>(sp =>
    new LinkClient(appMode.LinkServiceUrl));
```

**RecyclerIQ.Link.Service (Program.cs):**

```csharp
var appMode = builder.Configuration
    .GetSection("AppMode")
    .Get<AppModeOptions>();

// Demo vs production — sync and license behavior
if (appMode.IsDemoMode)
{
    builder.Services.AddSingleton<ILicenseValidator, DemoLicenseValidator>();
    builder.Services.AddSingleton<ISyncService, NoOpSyncService>();
}
else
{
    builder.Services.AddSingleton<ILicenseValidator, HardwareBoundLicenseValidator>();
    builder.Services.AddSingleton<ISyncService, CloudSyncService>();
}

// IRecycler resolved from Device record in database — NOT from config
// RecyclerFactory reads Device.IsSimulator and Device.SimulatorUrl
// to determine which IRecycler implementation to instantiate
builder.Services.AddSingleton<IRecyclerFactory, RecyclerFactory>();

// IPC endpoint for MAUI client communication
builder.Services.AddHostedService<LinkIpcHost>();
```

**RecyclerFactory — database-driven device resolution:**

```csharp
public class RecyclerFactory : IRecyclerFactory
{
    public IRecycler CreateRecycler(Device device)
    {
        if (device.IsSimulator)
        {
            // SimulatorRecyclerClient also implements ISimulatorControl
            return new SimulatorRecyclerClient(device.SimulatorUrl!);
        }

        return device.Model switch
        {
            "KisanKR10" => new KisanRecycler(device.SerialNumber),
            // Future: other hardware implementations
            _ => throw new NotSupportedException($"Unknown device model: {device.Model}")
        };
    }
}
```

---

## 4. Solution Structure

> **Note:** These projects span multiple repositories. See the Repository Structure ADR for the full repo-to-project mapping.

**recycleriq-clients repo** (this is what you build for the demo):
```
RecyclerIQ.Clients.sln
│
├── RecyclerIQ.UI.Shared/                      # Razor Class Library — project reference (not NuGet)
│
├── RecyclerIQ.UI.TaxAuthority/                # MAUI Blazor Hybrid — main client
│   ├── Pages/
│   │   ├── Login.razor
│   │   ├── Collector.razor
│   │   ├── Inventory.razor
│   │   ├── DailySummary.razor
│   │   └── Demo/
│   │       ├── SimulatorControlPanel.razor    # Visible when Device.IsSimulator = true
│   │       ├── ResetDemo.razor                # Demo mode only
│   │       └── CreateNewDemo.razor            # Demo mode only
│   ├── Auth/
│   │   ├── LocalIdentityProvider.cs           # Shared — demo AND production offline
│   │   └── RiqAuthenticationStateProvider.cs  # Blazor wrapper — same in all modes
│   ├── Services/
│   │   ├── LinkClient.cs                      # ILinkClient — IPC to Link.Service
│   │   └── DemoDataSeeder.cs                  # Seeds demo SQLite database
│   └── MauiProgram.cs
│
├── RecyclerIQ.UI.RetailClient/                # MAUI Blazor Hybrid — retail (Phase 3)
│
└── RecyclerIQ.UI.WebClient/                   # Blazor Server — browser-accessible client
    ├── Program.cs                             # Blazor Server host (thin wrapper)
    └── Pages/                                 # Routing shell — all UI from UI.Shared RCL
```

**recycleriq-link repo:**
```
RecyclerIQ.Link.sln
│
├── RecyclerIQ.Hardware/                       # Project reference (not NuGet) — only Link.Service consumes this
│   ├── IRecycler.cs
│   ├── ISimulatorControl.cs
│   ├── IRecyclerFactory.cs
│   ├── SimulatorRecyclerClient.cs             # Implements IRecycler + ISimulatorControl
│   ├── KisanRecycler.cs                       # Real Kisan KR10 hardware
│   └── RecyclerFactory.cs                     # Factory — reads Device.IsSimulator
│
└── RecyclerIQ.Link.Service/                   # Worker Service — one per site
    ├── Program.cs                             # DI wiring + hosted services
    ├── LinkIpcHost.cs                         # IPC endpoint for MAUI client
    ├── Services/
    │   ├── DemoLicenseValidator.cs            # Demo mode — always valid
    │   └── NoOpSyncService.cs                 # Demo mode — no cloud sync
    └── appsettings.json                       # AppMode config (IsDemoMode only)
```

**recycleriq-simulator repo:**
```
RecyclerIQ.Simulator.sln
│
└── RecyclerIQ.Simulator/                      # Blazor Server — standalone process
    ├── SimulatorController.cs                 # REST API endpoints
    ├── SimulatorEngine.cs                     # In-memory recycler state machine
    └── Program.cs                             # Blazor Server host
```

**recycleriq-core repo** (NuGet packages — Domain and Common only):
```
RecyclerIQ.Core.sln
│
├── RecyclerIQ.Domain/                         # Entities, enums, domain events, ILinkClient interface
└── RecyclerIQ.Common/                         # Utilities, DTOs, extensions
```

> **Why Domain and Common only?** Hardware and UI.Shared each have a single consuming repo (Link.Service and clients respectively). Pushing them through NuGet would add a publish-update-restore cycle on every change with no benefit. `ILinkClient` (the IPC contract between clients and Link.Service) lives in Domain since both repos need it — that's the real cross-repo contract.

---

## 5. Demo Database (SQLite)
<!-- Jira: RCLIENT-26 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

### 5.1 Approach
The production client already uses SQLite for offline resilience. The demo database is the same SQLite schema, pre-seeded with demo data. No new database technology is introduced.

### 5.2 Seeded Data

```csharp
public class DemoDataSeeder
{
    public async Task SeedAsync(AppDbContext db, DemoSeedOptions options)
    {
        // Tenant
        var tenant = new Tenant
        {
            TenantId = Guid.NewGuid(),
            TenantType = TenantType.TaxAuthority,
            Name = options.ProspectName ?? "Demo County Tax Office",
            SubscriptionTier = "Demo"
        };

        // TaxAuthorityProfile
        var profile = new TaxAuthorityProfile
        {
            TenantId = tenant.TenantId,
            MunicipalityCode = "DEMO-001",
            TaxYearConfig = DateTime.UtcNow.Year.ToString()
        };

        // Demo Users
        var users = new[]
        {
            new User { Username = "admin", PinHash = Hash("1234"), Role = Role.TenantAdmin },
            new User { Username = "cashier1", PinHash = Hash("5678"), Role = Role.Operator }
        };

        // Device — IsSimulator flag drives IRecycler resolution in Link.Service
        var device = new Device
        {
            DeviceId = Guid.NewGuid(),
            TenantId = tenant.TenantId,
            SerialNumber = options.UseSimulator ? "DEMO-SIM-001" : "DEMO-HW-001",
            IsSimulator = options.UseSimulator,
            SimulatorUrl = options.UseSimulator ? options.SimulatorUrl : null,
            HardwareId = options.SimulatorHardwareId ?? Guid.NewGuid(),
            MACAddress = "00-00-00-00-00-00"
        };

        // Sample transactions (last 30 days)
        // ... seed realistic TaxCollection transactions

        await db.SaveChangesAsync();
    }
}
```

### 5.3 Demo Seed Options

```csharp
public class DemoSeedOptions
{
    public string? ProspectName { get; set; }
    public string? ProspectEmail { get; set; }
    public bool UseSimulator { get; set; } = true;
    public string? SimulatorUrl { get; set; } = "http://localhost:5100";
    public Guid? SimulatorHardwareId { get; set; }
    public int SampleTransactionDays { get; set; } = 30;
}
```

### 5.4 Database Location
- **Local demo:** SQLite file at `%APPDATA%\RecyclerIQ\demo.db` (or app directory)
- **Cloud demo:** SQLite file at writable path on cloud host, isolated per prospect

---

## 6. Authentication in Demo Mode
<!-- Jira: RCLIENT-12 | Epic: RCLIENT-2 | Synced: 2026-04-09 -->

> **Architecture Reference:** See Auth ADR Sections 1, 4, 5, 6, 7 for the full identity provider pattern, tenant-configurable auth methods, and local client launch modes.

### 6.1 Production Flow (future — `ResilientIdentityProvider`)
1. Try cloud API authentication via `CloudIdentityProvider`
2. On success, cache credentials in local SQLite
3. On failure (offline), fall back to `LocalIdentityProvider` against SQLite cache

### 6.2 Demo Flow (`LocalIdentityProvider`)
Skip cloud API entirely — validate directly against local SQLite. This is the **same** `LocalIdentityProvider` used for production offline fallback. In demo mode, the SQLite data was seeded by `DemoDataSeeder`; in production, it was cached from a prior cloud sync. The provider is agnostic to the data source.

```csharp
public class LocalIdentityProvider : IIdentityProvider
{
    private readonly AppDbContext _db;

    public async Task<AuthResult> AuthenticateAsync(AuthCredentials credentials)
    {
        var user = credentials switch
        {
            PinCredentials pin => await _db.Users
                .FirstOrDefaultAsync(u => u.Username == pin.Username),
            PasswordCredentials pwd => await _db.Users
                .FirstOrDefaultAsync(u => u.Username == pwd.Username),
            _ => null
        };

        if (user == null) return AuthResult.Failure("User not found");

        var isValid = credentials switch
        {
            PinCredentials pin => VerifyPin(pin.Pin, user.PinHash),
            PasswordCredentials pwd => VerifyPassword(pwd.Password, user.PasswordHash),
            _ => false
        };

        if (!isValid) return AuthResult.Failure("Invalid credentials");

        return AuthResult.Success(new UserClaims
        {
            UserId = user.UserId,
            Username = user.Username,
            Role = user.Role,
            TenantId = user.TenantId
        });
    }
}
```

### 6.3 Login UX in Demo Mode
- **Operator mode** (default launch): Login page renders the site's configured `SiteAuthMethod` (default: PIN pad). Demo users: `admin / 1234`, `cashier1 / 5678`.
- **Admin mode** (`--admin` flag): Login page always shows username/password form, regardless of site auth config.

---

## 7. Hardware Abstraction & Simulator

> **Moved to dedicated PRD:** Full simulator specifications (IRecycler, ISimulatorControl, SimulatorRecyclerClient, REST API, state machine, control panel, and hardware ID config) have been extracted to [PRD_Simulator.md](PRD_Simulator.md) (SIM project).
>
> This section retains only the integration points relevant to the Tax Authority demo system.

### 7.1 Integration Summary

- The MAUI client never talks to hardware or the simulator directly. All hardware interaction goes through Link.Service via `ILinkClient` (IPC).
- Link.Service resolves the `IRecycler` implementation from the `Device` record in the database — `Device.IsSimulator` determines whether `KisanRecycler` or `SimulatorRecyclerClient` is used. This is independent of demo/production mode.
- Simulator trigger actions (insert bills, jam, clear jam, etc.) are exposed via `ISimulatorControl` — the client calls them through Link.Service IPC. For real hardware devices, these actions are not available.
- The client shows the simulator control panel when the connected device's `IsSimulator = true` — regardless of demo or production mode.

### 7.2 Key Interfaces (defined in other repos)

| Interface | Location | Purpose |
|---|---|---|
| `IRecycler` | RecyclerIQ.Domain (recycleriq-core NuGet) | Hardware abstraction — same interface for real and simulated |
| `ISimulatorControl` | RecyclerIQ.Hardware (recycleriq-link) | Simulator trigger actions (insert bills, jam, etc.) |
| `ILinkClient` | RecyclerIQ.Domain (recycleriq-core NuGet) | IPC contract between client and Link.Service |

For full interface definitions, REST API endpoints, state machine, and control panel specs, see [PRD_Simulator.md](PRD_Simulator.md).

---

## 8. Licensing in Demo Mode
<!-- Jira: RCLIENT-30 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

### 8.1 Demo License Stub

```csharp
public class DemoLicenseValidator : ILicenseValidator
{
    public Task<LicenseValidationResult> ValidateAsync(string hardwareId)
    {
        // Always valid in demo mode — no cloud API needed
        return Task.FromResult(LicenseValidationResult.Valid("DEMO-LICENSE"));
    }
}
```

### 8.2 Simulator Hardware ID
Each demo environment has a unique GUID used as the `HardwareId` in the simulator config and in the demo database `Device` record. This ensures the demo license binding mirrors production behavior without requiring the cloud license server.

---

## 9. Reset Demo Functionality
<!-- Jira: RCLIENT-27 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

### 9.1 Behavior
1. Confirmation dialog: "This will reset all demo data to its initial state. Continue?"
2. Truncate all transaction data from SQLite
3. Re-run `DemoDataSeeder` with the original seed options
4. Reset simulator state via `POST /api/simulator/reset`
5. Show success notification

### 9.2 Implementation

```csharp
public class DemoResetService
{
    private readonly AppDbContext _db;
    private readonly DemoDataSeeder _seeder;
    private readonly ISimulatorApiClient _simulator;
    private readonly DemoSeedOptions _originalSeedOptions;

    public async Task ResetAsync()
    {
        // 1. Clear transaction data (preserve tenant, users, device)
        _db.Transactions.RemoveRange(_db.Transactions);
        _db.DenominationSnapshots.RemoveRange(_db.DenominationSnapshots);
        await _db.SaveChangesAsync();

        // 2. Re-seed transactions
        await _seeder.SeedTransactionsAsync(_db, _originalSeedOptions);

        // 3. Reset simulator
        await _simulator.ResetAsync();
    }
}
```

### 9.3 UI Access
- Accessible from a **Demo** menu in normal operator mode — visible only when `IsDemoMode = true`
- Requires `TenantAdmin` role (authenticated via the site's configured auth method — e.g., PIN)
- Does **not** require `--admin` launch mode — a trade show operator can reset the demo without relaunching the app
- Completes in under 30 seconds

---

## 10. Create New Demo Wizard
<!-- Jira: RCLIENT-28 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

### 10.1 Flow

```
Step 1: Enter Prospect Details
  └── Prospect Name, Company, Contact Name (optional)

Step 2: Choose Recycler
  └── Currently: Kisan KR10 Simulator (only option)

Step 3: Confirm
  └── Review settings → Create Demo

Step 4: Complete
  └── New SQLite seeded, credentials displayed
  └── Option to email credentials (if email configured)
```

### 10.2 What Gets Created
- New tenant record in SQLite with prospect details
- Demo users: `admin / 1234` and `cashier / 5678`
- New unique simulator Hardware ID (GUID)
- 30 days of sample `TaxCollection` transactions
- Device record bound to simulator hardware ID

### 10.3 For Cloud Deployments
When running in the cloud, "Create New Demo" provisions a new isolated SQLite file for that prospect. The cloud host maps the prospect's credentials to their specific SQLite file at login.

---

## 11. Self-Serve Demo Provisioning (Website)
<!-- Jira: RCLIENT-35,RCLIENT-36,RCLIENT-37,RCLIENT-38,RCLIENT-39 | Epic: RCLIENT-6 | Synced: 2026-04-09 -->

### 11.1 Flow

```
Marketing Website
└── Tax Authority Demo Request Form
    ├── First Name, Last Name
    ├── Company / Municipality Name
    ├── Email Address
    └── Submit → "Request Demo"

Backend (triggered by form submission)
├── Create new demo tenant in cloud demo database
├── Seed initial demo data (DemoDataSeeder)
├── Generate unique SimulatorHardwareId (GUID)
├── Create demo user credentials
└── Send email:
    Subject: "Your Recycler.IQ Demo is Ready"
    Body:
      - Demo app URL
      - Login: admin / 1234
      - Instructions
```

### 11.2 Backend Trigger Options
- **Webhooks from website form platform** (Typeform, HubSpot, etc.) → triggers provisioning endpoint
- **Simple REST endpoint** exposed by demo backend: `POST /api/demo/provision`
- **Manual provisioning** (admin triggers via Create New Demo wizard) as fallback

### 11.3 Provisioning Endpoint

```csharp
// POST /api/demo/provision
public class ProvisionDemoRequest
{
    public string FirstName { get; set; }
    public string LastName { get; set; }
    public string CompanyName { get; set; }
    public string Email { get; set; }
}

public class ProvisionDemoResponse
{
    public Guid DemoTenantId { get; set; }
    public string DemoAppUrl { get; set; }
    public string AdminUsername { get; set; }
    public string AdminPin { get; set; }
    public Guid SimulatorHardwareId { get; set; }
}
```

---

## 12. IP Protection
<!-- Jira: RCLIENT-30 | Epic: RCLIENT-4 | Synced: 2026-04-09 -->

### 12.1 Demo Mode Hard Locks

```csharp
// Prevent production config from being used without cloud API
public class ProductionStartupGuard
{
    private readonly ICloudApiClient _cloudApi;
    private readonly AppModeOptions _appMode;

    public async Task<bool> CanStartAsync()
    {
        if (_appMode.IsDemoMode) return true; // Demo always allowed

        // Production requires successful cloud API handshake
        var result = await _cloudApi.HandshakeAsync();
        return result.IsSuccess;
    }
}
```

### 12.2 Config Obfuscation
- Sensitive config values (connection strings, hardware IDs) stored encrypted in `appsettings.json`
- Encryption key derived from machine-specific values (machine name + MAC address)
- This prevents copy-paste of config to another machine

### 12.3 Demo JWT Isolation
- Demo license JWTs are issued with `"env": "Demo"` claim
- Production cloud API will reject any JWT with `"env": "Demo"`
- Demo JWTs are short-lived (30 days) and non-renewable without provisioning

### 12.4 Accepted Risks
> The following risks are accepted for the demo phase and will be addressed when the cloud API goes live:
> - Local MAUI binary can be reverse-engineered by a determined actor
> - Config obfuscation is deterrence, not true security
> - Real hardware binding and subscription enforcement require cloud API

---

## 13. Deployment Scenarios

### 13.1 Local Demo (Trade Show)

```
Prerequisites:
- Windows laptop or terminal
- Kisan KR10 hardware connected (OR headless simulator as fallback)
- RecyclerIQ.Link.Service installed and running

Config (Link.Service appsettings.json):
  AppMode.IsDemoMode = true

Config (MAUI Client appsettings.json):
  AppMode.IsDemoMode = true
  AppMode.LinkServiceUrl = http://localhost:5050  (gRPC endpoint)

Database (SQLite — seeded by DemoDataSeeder):
  Device.IsSimulator = false, Device.SimulatorUrl = null     (real hardware)
  — OR —
  Device.IsSimulator = true, Device.SimulatorUrl = http://localhost:5100  (simulator)

Startup:
1. (If using simulator) Launch Simulator: dotnet run --project Simulator
2. Link.Service starts automatically (Windows service) or manually
3. Launch Tax Authority client: RecyclerIQ.TaxAuthority.exe
4. Login: admin / 1234
```

### 13.2 Cloud Demo (Post-Show)

> **Note:** The MAUI Blazor Hybrid client is a native desktop app — it cannot run in a browser. For cloud demos, `RecyclerIQ.UI.WebClient` (Blazor Server) hosts the same UI components from `RecyclerIQ.UI.Shared` in a browser-accessible server-side Blazor app. Same Razor pages, same look and feel — different hosting model.

```
Prerequisites:
- Azure App Service (or similar) running RecyclerIQ.UI.WebClient (Blazor Server)
- Headless simulator deployed as a companion service
- Link.Service deployed as a companion service (same host or sidecar)

Config (Link.Service appsettings.json):
  AppMode.IsDemoMode = true

Config (WebClient appsettings.json):
  AppMode.IsDemoMode = true
  AppMode.LinkServiceUrl = https://link-internal.recycleriq.com

Database (SQLite — seeded per prospect):
  Device.IsSimulator = true
  Device.SimulatorUrl = https://simulator-internal.recycleriq.com

Provisioning:
- Website form → POST /api/demo/provision → email sent to prospect
- Prospect navigates to demo.recycler-iq.com, logs in with provided credentials
- Blazor Server renders the same UI.Shared components server-side over SignalR
```

### 13.3 Environment Config Summary

| Setting | Component | Demo Mode | Production Mode |
|---|---|---|---|
| IsDemoMode | Both | true | false |
| IRecycler resolution | Link.Service | From `Device` record in SQLite | From `Device` record in Azure SQL |
| Device.IsSimulator | Database | true or false (per device) | true or false (per device) |
| IIdentityProvider | MAUI Client | `LocalIdentityProvider` | `ResilientIdentityProvider` |
| ILicenseValidator | Link.Service | `DemoLicenseValidator` | `HardwareBoundLicenseValidator` |
| ISyncService | Link.Service | `NoOpSyncService` | `CloudSyncService` |
| ILinkClient | MAUI Client | IPC to Link.Service | IPC to Link.Service |
| Database | MAUI Client | Pre-seeded demo SQLite | Cloud-synced SQLite + Azure SQL |

---

## 14. Open Items

| Item | Status | Notes |
|---|---|---|
| Link.Service ↔ MAUI Client communication | DECIDED | gRPC — strongly typed .proto contracts, bidirectional streaming for hardware events. See ADR-002 and Link.Service PRD Section 9. |
| Link.Service demo mode startup | NOT DEFINED | How Link.Service starts in demo mode — Windows service, manual launch, or bundled with MAUI installer |
| Cloud host selection for demo | EVALUATING | Azure App Service vs simple VM (not GitHub Pages — needs .NET runtime for Link.Service + Simulator) |
| Website form platform | NOT STARTED | Typeform, HubSpot, or custom |
| Email provider | NOT DECIDED | SendGrid, Postmark, or Azure Communication Services |
| Demo session expiry policy | NOT DEFINED | How long do provisioned demos persist? |
| Demo seed data content | NOT DEFINED | Exact transaction types, amounts, date ranges to seed |
| Config encryption approach | NOT STARTED | Machine-derived key approach needs implementation |
| Post-show admin dashboard | NOT STARTED | Track provisioned demos, usage, leads |

---

*Recycler.IQ — Tax Authority Demo System Technical Spec v1.0 | March 2026 | CONFIDENTIAL*
