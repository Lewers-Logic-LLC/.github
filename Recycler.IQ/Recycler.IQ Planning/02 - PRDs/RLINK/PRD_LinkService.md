# Link.Service Sub-PRD
## Recycler.IQ: Site-Level Background Agent & Hardware Orchestration

**Company:** Lewers Logic LLC

**Document Version:** 1.0
**Date:** March 22, 2026
**Audience:** Backend & DevOps Team
**Status:** Final

---

<!-- 
  Jira Project: RLINK (RecyclerIQ Link)
  Epics: RLINK-1 (Core), RLINK-2 (HAL), RLINK-3 (Sync), RLINK-4 (gRPC), 
         RLINK-5 (SignalR), RLINK-6 (API Key Auth), RLINK-7 (Multi-Recycler), RLINK-8 (Repo Setup)
  Stories: RLINK-9 through RLINK-53
  Last Synced: 2026-04-11
-->

## 1. Overview

### Purpose
Link.Service is a .NET 10 Worker Service that runs on each Recycler.IQ site (location) as a platform-native daemon — Windows service, Linux systemd unit, or Docker container. It is the bridge between cloud infrastructure and local hardware, responsible for:
- Orchestrating all cash recyclers at a single physical location
- Managing bidirectional sync (local ↔ cloud) for transactions, inventory, users, and configuration
- Validating hardware licenses and enforcing access control
- Providing offline-first resilience via local SQLite queue
- Exposing a local gRPC API for MAUI/Blazor hybrid clients to interact with recyclers
- Monitoring health and triggering remediation (restart, reconnect, etc.)

### Deployment Model
- **One instance per site** (location/retail outlet), regardless of recycler count
- All recyclers at that site connect to the same Link.Service instance
- Both tenant types (Tax Authorities and Retail Chains) use identical Link.Service binaries and DI configuration
- Installed as a platform-native daemon with auto-restart on crash:
  - **Windows:** Windows service (`sc.exe` / PowerShell `New-Service`)
  - **Linux:** systemd unit (supports Raspberry Pi, mini-PCs, servers)
  - **Docker:** Container image for Linux hosts or orchestrated environments
- Processes run with local system privileges (no domain auth required)

### Relationship to Master PRD
This document is a technical deep-dive of the **Link.Service** component from the Master PRD. It assumes familiarity with:
- Recycler.IQ product architecture (cloud, MAUI clients, local hardware)
- Recycler types (Kisan KR10, future manufacturers)
- Sync, licensing, and offline-first principles

---

## 2. Architecture

### Worker Service Structure
<!-- Jira: RLINK-9 | Epic: RLINK-8 | Synced: 2026-04-11 | Scaffold repo -->

```
Link.Service (cross-platform daemon)
├── Startup Configuration (DI container, hosted services registration)
├── Hosted Services (long-running background tasks)│   ├── SyncWorker
│   ├── UserSyncService
│   ├── SyncSignalService
│   ├── SyncStatusService
│   ├── LicenseValidator
│   └── HeartbeatService
├── Hardware Abstraction Layer
│   ├── IRecycler interface
│   ├── RecyclerFactory
│   ├── SimulatorRecycler
│   ├── KisanRecycler
│   └── [Future implementations]
├── Local Data Layer
│   ├── SQLite database (offline queue, config cache, user cache, license state)
│   └── Repository pattern abstractions
├── Sync Engine
│   ├── Transaction sync (local → cloud)
│   ├── Inventory sync (local ↔ cloud with delta detection)
│   ├── User sync (cloud → local, site-filtered)
│   └── Config sync (cloud → local, on install + periodic)
├── License Validation
│   └── JWT verification, grace period logic, hardware binding checks
├── Cloud Notification Layer
│   └── SignalR client — receives real-time config push notifications from Cloud API
└── Local Communication Layer
    └── gRPC server — strongly typed .proto contracts for UI client commands and hardware event streaming
```

### Dependency Injection & Startup
<!-- Jira: RLINK-12,RLINK-14,RLINK-15 | Epic: RLINK-1 | Synced: 2026-04-11 | DI wiring, demo mode, AppModeOptions -->

```csharp
// Program.cs Pattern
var builder = Host.CreateDefaultBuilder(args);

builder
    .ConfigureServices(services => {
        // Configuration
        services.Configure<SyncOptions>(config.GetSection("Sync"));
        services.Configure<LicenseOptions>(config.GetSection("License"));

        // Data Access
        services.AddScoped<LinkDbContext>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IInventoryRepository, InventoryRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IConfigRepository, ConfigRepository>();

        // Hardware Abstraction
        services.AddScoped<IRecyclerFactory, RecyclerFactory>();
        services.AddScoped<IRecyclerRegistry, RecyclerRegistry>(); // Multi-recycler tracking

        // Hosted Services (registered in dependency order)
        services.AddHostedService<SyncStatusService>();        // Must start first
        services.AddHostedService<LicenseValidator>();         // Validate before operations
        services.AddHostedService<UserSyncService>();          // Populate offline users
        services.AddHostedService<SyncWorker>();               // Main sync loop
        services.AddHostedService<SyncSignalService>();        // Signal receiver
        services.AddHostedService<HeartbeatService>();         // Health monitoring

        // Local Communication (UI Client ↔ Link.Service)
        services.AddGrpc();
        services.AddScoped<IRecyclerCommandHandler, RecyclerCommandHandler>();

        // Cloud Notification (Cloud API → Link.Service)
        services.AddSingleton<CloudSignalRClient>(); // SignalR client for real-time config push
    })
    .Build()
    .RunAsync();
```

### Local SQLite Database
<!-- Jira: RLINK-52 | Epic: RLINK-1 | Synced: 2026-04-11 -->
- **File Location:** `%ProgramData%\RecyclerIQ\{SiteId}\link-service.db`
- **Purpose:** Offline-first queue, cache, and state tracking; local source of truth until sync completes
- **Repository Pattern:** EF Core repositories used for both local SQLite and cloud DbContext (same abstractions)
- **Tenant Isolation:** Not applicable locally; single site = single SQLite file (no multi-tenancy at site level)
- **ITenantConnectionResolver:** Only used in cloud DbContext factory; not used locally (local DbContext uses fixed SQLite connection string)
- **Encryption:** ⚠ TBD; recommend DPAPI on Windows or SQLCipher for cross-platform (Phase 2 or if regulatory mandate)
- **Backup:** Optional daily snapshot to cloud (consider for disaster recovery)

---

## 3. Hardware Abstraction Layer (HAL)
<!-- Jira Epic: RLINK-2 | Synced: 2026-04-11 -->

### Design Goals
- Decouple recycler operations from business logic
- Enable multiple manufacturer support with zero core change
- Facilitate testing with SimulatorRecycler
- Support concurrent operations across multiple recyclers at one site

### IRecycler Interface
<!-- Jira: RLINK-17,RLINK-18 | Epic: RLINK-2 | Synced: 2026-04-11 | IRecycler + ISimulatorControl -->

```csharp
public interface IRecycler
{
    /// <summary>
    /// Recycler identifier (serial, IMEI, MAC, or UUID assigned at provisioning)
    /// </summary>
    string DeviceId { get; }

    /// <summary>
    /// Current operational state (Offline, Online, Busy, Error)
    /// </summary>
    RecyclerState State { get; }

    /// <summary>
    /// True if connected and licensed; false if offline or unlicensed
    /// </summary>
    bool IsAvailable { get; }

    /// <summary>
    /// Connect to hardware. May be USB, serial, or SDK client.
    /// Throws if connection fails or license is invalid.
    /// </summary>
    Task ConnectAsync(CancellationToken ct);

    /// <summary>
    /// Gracefully close connection and cleanup resources.
    /// </summary>
    Task DisconnectAsync(CancellationToken ct);

    /// <summary>
    /// Fetch current hopper inventory.
    /// Returns cached value if connection lost; updates cache on next successful read.
    /// </summary>
    Task<InventorySnapshot> GetInventoryAsync(CancellationToken ct);

    /// <summary>
    /// Initiate a cash deposit. Returns transaction token and expected duration.
    /// Blocks until hardware is ready. Throws if offline or license invalid.
    /// </summary>
    Task<DepositSession> StartDepositAsync(
        string depositId,
        int expectedDenominations,
        CancellationToken ct);

    /// <summary>
    /// Finalize deposit; capture final inventory and return to ready state.
    /// </summary>
    Task<DepositResult> EndDepositAsync(
        string depositId,
        CancellationToken ct);

    /// <summary>
    /// Withdraw cash (manual operation or dispense).
    /// Updates inventory immediately. Queued for sync if offline.
    /// </summary>
    Task<WithdrawalResult> WithdrawAsync(
        WithdrawalRequest request,
        CancellationToken ct);

    /// <summary>
    /// Insert a bill (for testing or operator reload). Manufacturer-specific.
    /// </summary>
    Task<bool> InsertBillAsync(
        int denomination,
        CancellationToken ct);

    /// <summary>
    /// Hardware diagnostics (hopper sensors, network, license state, etc.)
    /// Returned to cloud and logged locally.
    /// </summary>
    Task<DiagnosticReport> RunDiagnosticsAsync(CancellationToken ct);
}

public enum RecyclerState
{
    Offline,     // No connection or disabled
    Online,      // Connected, licensed, ready
    Busy,        // Processing deposit or withdrawal
    Error,       // Connection/license/hardware error
    Initializing // Startup sequence
}

public record InventorySnapshot
{
    public DateTime CapturedAt { get; init; }
    public Dictionary<int, int> DenominationCounts { get; init; } // denomination → count
    public int TotalValue { get; init; }
    public string ManufacturerChecksum { get; init; } // For delta detection
}

public record DepositSession
{
    public string SessionId { get; init; }
    public DateTime StartedAt { get; init; }
    public int EstimatedDurationSeconds { get; init; }
}

public record DepositResult
{
    public string SessionId { get; init; }
    public InventorySnapshot FinalInventory { get; init; }
    public List<string> ErrorsEncountered { get; init; } = new();
    public bool Success => ErrorsEncountered.Count == 0;
}
```

### RecyclerFactory Pattern
<!-- Jira: RLINK-19,RLINK-22 | Epic: RLINK-2 | Synced: 2026-04-11 | Interface + concrete factory -->

```csharp
public interface IRecyclerFactory
{
    IRecycler CreateRecycler(RecyclerConfig config);
}

public class RecyclerFactory : IRecyclerFactory
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<RecyclerFactory> _logger;

    public IRecycler CreateRecycler(RecyclerConfig config)
    {
        return config.ManufacturerType switch
        {
            "Simulator" => new SimulatorRecycler(config, _logger),
            "KisanKR10" => new KisanRecycler(config, _serviceProvider.GetRequiredService<IKisanSDKWrapper>(), _logger),
            _ => throw new NotSupportedException($"Manufacturer {config.ManufacturerType} not supported")
        };
    }
}
```

### RecyclerRegistry (Multi-Recycler Tracking)
<!-- Jira: RLINK-53 | Epic: RLINK-7 | Synced: 2026-04-11 -->

```csharp
public interface IRecyclerRegistry
{
    /// <summary>
    /// Register a recycler (at startup from local config or cloud sync).
    /// </summary>
    void RegisterRecycler(IRecycler recycler);

    /// <summary>
    /// Get recycler by device ID.
    /// </summary>
    IRecycler? GetRecycler(string deviceId);

    /// <summary>
    /// Get all recyclers at this site.
    /// </summary>
    IEnumerable<IRecycler> GetAllRecyclers();

    /// <summary>
    /// Mark recycler as removed (e.g., decommissioned).
    /// </summary>
    void UnregisterRecycler(string deviceId);
}
```

### Implementations
<!-- Jira: RLINK-20,RLINK-21 | Epic: RLINK-2 | Synced: 2026-04-11 | SimulatorRecyclerClient + KisanRecycler -->

#### SimulatorRecycler
- **Status:** Complete (from POC)
- **Purpose:** In-memory mock for development/testing
- **Behavior:**
  - No real hardware required
  - Simulates deposit/withdrawal with configurable delays
  - Inventory is RAM-only (reset on app restart)
  - Useful for integration tests and MAUI client dev
- **License Validation:** Bypassed (always valid)

#### KisanRecycler
- **Status:** Partially complete (from POC); production placeholders remain
- **Hardware:** Kisan KR10 via KR.Server.dll SDK (assumed provided by manufacturer)
- **Connection:** Serial or USB via SDK client
- **Considerations:**
  - ⚠ **Production blockers:** Error handling incomplete, edge cases around SDK exceptions not covered
  - SDK threading model must be understood (is it thread-safe? async-friendly?)
  - Hopper sensor reliability and checksum verification needed
  - Battery-backed RTC for offline operation assumption

#### Future Implementations
- Hyosung (common in retail ATMs, global market)
- De La Rue (European & Asian markets)
- Proprietary hardware (custom OEMs)
- Each would implement `IRecycler` in own assembly; factory loads via reflection or plugin discovery

---

## 4. Background Services
<!-- Jira: RLINK-44,RLINK-45,RLINK-46,RLINK-47,RLINK-48,RLINK-49 | Epics: RLINK-3,RLINK-5,RLINK-6 | Synced: 2026-04-11 -->

Each hosted service runs independently in the DI container and handles a specific concern. Services are started in dependency order.

### 4.1 SyncStatusService
<!-- Jira: RLINK-44 | Epic: RLINK-3 | Synced: 2026-04-11 -->
**Purpose:** Track and persist sync state; prevent duplicate syncs; circuit breaker.

**Responsibility:**
- Maintain a circular buffer of sync attempts (success/failure, timestamp, data count)
- Track last sync time per data type (transactions, inventory, users, config)
- Expose `ISyncStatusProvider` for other services to query state
- Detect sync loops (continuous failures) and pause with exponential backoff

**Trigger:** Starts with the application; runs continuously.

**Interval:** N/A (event-driven updates)

**Key Properties:**
```csharp
public interface ISyncStatusProvider
{
    SyncStatus GetStatus(string dataType); // transactions, inventory, users, config
    void RecordSyncAttempt(string dataType, SyncResult result);
    bool CanSyncNow(string dataType); // Circuit breaker check
    int PendingTransactionCount { get; }
    int PendingInventoryUpdates { get; }
}
```

**Error Handling:**
- If sync fails 5 times consecutively, enter exponential backoff (5s, 10s, 20s, 40s, 80s)
- Log warnings but do not throw; allow other services to continue
- Reset backoff counter on successful sync

---

### 4.2 LicenseValidator
<!-- Jira: RLINK-45 | Epic: RLINK-6 | Synced: 2026-04-11 -->
**Purpose:** Validate hardware licenses at startup and periodically; enforce access control.

**Responsibility:**
- Load license JWT from local cache (encrypted) or cloud at startup
- Verify JWT signature (public key embedded or fetched from cloud at install-time)
- Check hardware binding (device serial/MAC must match claims)
- Enforce grace period if offline (default: ⚠ **undefined**, suggest 7 days)
- Enter lockout mode (refuse operations) on license expiry without grace
- Emit `LicenseStateChanged` events for UI/HeartbeatService

**Trigger:** Starts after SyncStatusService; validates at startup and every 6 hours.

**Interval:** 6 hours (or per config)

**Key Methods:**
```csharp
public interface ILicenseValidator
{
    Task<LicenseValidationResult> ValidateAsync(CancellationToken ct);
    LicenseState CurrentState { get; }
    bool CanOperate { get; } // False if expired + no grace
    event EventHandler<LicenseStateChanged> StateChanged;
}

public record LicenseValidationResult
{
    public bool IsValid { get; init; }
    public string? ErrorMessage { get; init; }
    public DateTime ExpiresAt { get; init; }
    public DateTime GracePeriodExpiresAt { get; init; }
    public bool IsInGracePeriod => !IsValid && DateTime.UtcNow < GracePeriodExpiresAt;
}
```

**Error Handling:**
- If license is invalid + no grace period: log error, set `CanOperate = false`, prevent all recycler operations
- If offline (no cloud contact): use cached license if still in grace period; log warning
- If license fetch fails on install: block service startup with clear error

**JWT Structure (Example):**
```json
{
  "iss": "recycler-iq-cloud",
  "sub": "site-{siteId}",
  "deviceId": "{serialOrMac}",
  "exp": 1735689600,
  "iat": 1704153600,
  "aud": "link-service",
  "type": "site-license"
}
```

---

### 4.3 UserSyncService
<!-- Jira: RLINK-46 | Epic: RLINK-3 | Synced: 2026-04-11 -->
**Purpose:** Pull user data from cloud including permissions and PIN hashes; populate local offline cache for PIN validation.

**Responsibility:**
- Fetch users from cloud API filtered by site ID
- Cache in SQLite with PIN hashes (encrypted)
- Pull user permissions and roles for offline validation (cached with expiration)
- Detect user additions/removals and update local index
- Support offline PIN validation without cloud
- Populate cache used by MAUI apps for offline-first PIN auth

**Trigger:** Starts after LicenseValidator; runs on interval or on-demand via SyncSignalService signal.

**Interval:** 30 minutes (or per config); on-demand trigger from MAUI app or manual sync request

**Key Methods:**
```csharp
public interface IUserSyncService : IHostedService
{
    Task SyncNowAsync(CancellationToken ct); // On-demand trigger
    Task<IEnumerable<CachedUser>> GetCachedUsersAsync(CancellationToken ct);
}
```

**Sync Logic:**
- Fetch `/api/users?siteId={siteId}` from cloud including permissions, roles, and PIN validation data
- Compare with local cache (hash or last-mod timestamp)
- Insert new users, update modified users, mark deleted users as inactive
- Store PIN hashes (PBKDF2-SHA256) in local Users table
- Cache expiration window: TBD (recommend 24–48 hours)
- Log changes and report metrics to HeartbeatService
- If offline (no cloud contact): skip sync, use existing cache; proceed with offline PIN validation

**Permission Caching:**
- Cache user permissions and roles alongside PIN hash
- Permissions are read-only until next sync completes
- Permission changes from cloud take effect on next sync cycle (not real-time offline)

**Error Handling:**
- If sync fails: retry in 5 minutes, do not block other services
- If local database is full (quota): delete oldest inactive users (by last-login date)
- If cloud returns 401: attempt license refresh via LicenseValidator
- If cache expires during offline period: block new logins; show expiration warning to user

---

### 4.4 SyncWorker
<!-- Jira: RLINK-47 | Epic: RLINK-3 | Synced: 2026-04-11 -->
**Purpose:** Main bidirectional sync engine for transactions, inventory, and config.

**Responsibility:**
- Sync transactions from local queue to cloud (SyncStatus: Pending → Synced)
- Sync inventory changes to cloud on delta or heartbeat interval
- Fetch and cache updated config from cloud
- Detect and handle sync conflicts (retry, log, escalate)
- Batch operations for efficiency

**Trigger:** Runs on fixed interval or triggered by SyncSignalService signal.

**Interval:** 30 seconds (default). This is a **tenant-configurable parameter set from the Cloud Admin Portal** — allows adjusting per tenant for performance tuning or business requirements. Pushed to Link.Service via SignalR config notification. Also triggerable on-demand via signal.

**Key Methods:**
```csharp
public interface IHostedService
{
    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync(CancellationToken cancellationToken);
}

// SyncWorker implements above and also:
public event EventHandler<SyncProgressChanged> ProgressChanged;
```

**Sync Rules (See Section 5 for details):**

| Data Type       | Direction | Trigger           | Batch Size | Conflict Resolution |
|-----------------|-----------|-------------------|------------|--------------------|
| Transactions    | Local→Cloud | Every 30s + signal | 50         | SQLite is local source of truth until cloud ack; mark Synced after confirmation |
| Inventory       | Local↔Cloud | Delta or 5min | 1 per recycler | Timestamp + checksum; local cache is fallback if cloud unreachable |
| Users           | Cloud→Local | 30min + signal | 100 | Cloud wins (full replace); cached locally with expiration window |
| Config          | Cloud→Local | Install + SignalR push + 24h fallback | 1 (atomic) | Cloud wins (full replace) |

**Error Handling:**
- Failed transaction sync: retry with exponential backoff (5s, 10s, 20s, 40s, 80s)
- Max retries: 10; after that, mark as failed and alert operator
- Inventory sync failure: use last known good state, retry on next interval
- If cloud is unreachable: queue locally, skip sync, return to SyncWorker on next cycle

---

### 4.5 SyncSignalService
<!-- Jira: RLINK-48 | Epic: RLINK-5 | Synced: 2026-04-11 -->
**Purpose:** Receive and act on immediate sync requests (semaphore-based).

**Responsibility:**
- Listen for sync signals from MAUI client or operator console
- Trigger `SyncWorker.SyncNowAsync()` and `UserSyncService.SyncNowAsync()`
- Implement semaphore/event to prevent sync storms (max 1 sync per 5 seconds)
- Log all signal sources for audit

**Trigger:** Listens passively; triggered by external signal (gRPC call from UI client, or SignalR notification from Cloud API).

**Interval:** N/A (event-driven)

**Key Methods:**
```csharp
public interface ISyncSignalService : IHostedService
{
    // External (MAUI, operator console) can call via IPC:
    Task<bool> RequestImmediateSyncAsync(string source, CancellationToken ct);
}
```

**Implementation Notes:**
- Use `SemaphoreSlim` to enforce rate limit (5s min between syncs)
- Log source of every signal for audit trail
- If signal queue exceeds 10 pending: drop oldest signals and log warning

**Error Handling:**
- If sync triggered by signal fails: log error, do not retry (caller can re-request)
- If semaphore wait times out: log and ignore (sync may already be in progress)

---

### 4.6 SyncSignalService — Communication Mechanisms

**Decided:** Two signal sources feed into SyncSignalService:

| Signal Source | Transport | Trigger |
|---|---|---|
| UI Client (local) | gRPC call to Link.Service | Operator requests manual sync from UI |
| Cloud API (remote) | SignalR push notification | Config change made in Web Portal (recycler settings, user adds/changes, any admin config) |

Both signal sources invoke `RequestImmediateSyncAsync()` through the same semaphore-guarded path. The SyncSignalService does not differentiate between local and cloud triggers — it applies the same rate limiting and logging regardless of source.

---

### 4.7 HeartbeatService
<!-- Jira: RLINK-49 | Epic: RLINK-3 | Synced: 2026-04-11 -->
**Purpose:** Periodic health monitoring and diagnostics.

**Responsibility:**
- Ping each recycler every 1 minute (or per config)
- Detect and recover from transient failures (auto-reconnect)
- Report health metrics to cloud (optional)
- Trigger diagnostic reports on error
- Emit events for UI (offline/online transitions)

**Trigger:** Runs on fixed interval; starts after LicenseValidator.

**Interval:** 1 minute per recycler

**Key Metrics:**
```csharp
public record HeartbeatMetrics
{
    public string RecyclerId { get; init; }
    public RecyclerState State { get; init; }
    public int UpDownCycles { get; init; } // Bounces detected
    public DateTime LastSuccessfulHeartbeat { get; init; }
    public TimeSpan AverageResponseTime { get; init; }
}
```

**Auto-Recovery Logic:**
- If recycler is offline for > 5 minutes: log warning
- If offline for > 30 minutes: attempt full reconnect (ConnectAsync)
- If reconnect fails 3 times: escalate to operator alert (via UI)
- Track "up/down" cycles to detect flaky hardware

**Error Handling:**
- If ping fails (timeout 10s): mark offline, continue checking
- If diagnostic report fails: log but don't block heartbeat
- On error, emit `RecyclerOffline` event (consumed by MAUI UI for status display)

---

## 5. Sync Engine
<!-- Jira: RLINK-50 | Epic: RLINK-3 | Synced: 2026-04-11 -->

### Sync Rules by Data Type

#### 5.1 Transactions (Local → Cloud)
- **What:** Deposit, withdrawal, inventory adjustment records
- **Trigger:** Every 30 seconds or on-demand via SyncSignalService
- **Batch Size:** 50 transactions per sync (configurable)
- **State Machine:**
  - Local: `SyncStatus = Pending`
  - Cloud acknowledges: `SyncStatus = Synced`
  - Locally, mark as synced; never resend

**Schema (SQLite):**
```sql
CREATE TABLE Transactions (
    Id TEXT PRIMARY KEY,
    RecyclerId TEXT NOT NULL,
    Type TEXT NOT NULL, -- Deposit, Withdrawal, Adjustment
    Amount INT,
    DenominationBreakdown TEXT, -- JSON
    CreatedAt DATETIME NOT NULL,
    SyncStatus TEXT DEFAULT 'Pending', -- Pending, Synced, Failed
    SyncAttempts INT DEFAULT 0,
    LastSyncError TEXT,
    FOREIGN KEY(RecyclerId) REFERENCES Recyclers(Id)
);
```

#### 5.2 Inventory (Local ↔ Cloud with Delta)
- **What:** Hopper counts, total value per recycler
- **Trigger:** Every 5 minutes (heartbeat) OR on delta detection (checksum mismatch)
- **Direction:** Bidirectional
  - Local → Cloud: When delta detected locally
  - Cloud → Local: Periodic sync of ground-truth (conflict resolution)
- **Batch Size:** 1 per recycler (atomic)
- **Delta Detection:** Manufacturer checksum (IRecycler.GetInventoryAsync() returns checksum)

**Conflict Resolution:**
- ⚠ **Undefined:** What if local and cloud disagree on inventory?
  - **Suggestion:** Cloud is ground truth. If local inventory > cloud by > 10%, log anomaly and use cloud value.
  - **Rationale:** Cloud is immutable audit trail; local can have sensor drift.

**Schema (SQLite):**
```sql
CREATE TABLE InventorySnapshots (
    Id TEXT PRIMARY KEY,
    RecyclerId TEXT NOT NULL,
    DenominationCounts TEXT NOT NULL, -- JSON map
    TotalValue INT NOT NULL,
    ManufacturerChecksum TEXT,
    CapturedAt DATETIME NOT NULL,
    SyncedAt DATETIME, -- NULL if pending
    FOREIGN KEY(RecyclerId) REFERENCES Recyclers(Id)
);
```

#### 5.3 Users (Cloud → Local)
- **What:** PIN, name, role, enabled flag
- **Trigger:** Every 30 minutes or on-demand via signal
- **Direction:** Cloud → Local only
- **Batch Size:** 100 per sync (configurable)
- **Filter:** By site ID

**Sync Logic:**
- Fetch `/api/users?siteId={siteId}&modifiedAfter={lastSyncTime}`
- Full replace of local user table (or upsert per user)
- Hash PINs locally if cloud returns cleartext (⚠ **not specified**)

**Schema (SQLite):**
```sql
CREATE TABLE Users (
    Id TEXT PRIMARY KEY,
    SiteId TEXT NOT NULL,
    Name TEXT NOT NULL,
    PinHash TEXT, -- bcrypt or similar
    Role TEXT, -- Operator, Manager, Admin
    Enabled BOOLEAN DEFAULT TRUE,
    CreatedAt DATETIME,
    ModifiedAt DATETIME,
    LastSyncedAt DATETIME
);
```

#### 5.4 Config (Cloud → Local)
- **What:** Feature flags, sync intervals, locale, manufacturer settings
- **Trigger:** At install + every 24 hours
- **Direction:** Cloud → Local only
- **Batch Size:** 1 (atomic)

**Sync Logic:**
- Fetch `/api/config?siteId={siteId}`
- Write to local config cache (encrypted? ⚠ **not specified**)
- Reload service if critical config changes (e.g., manufacturer type)

**Schema (SQLite):**
```sql
CREATE TABLE ConfigCache (
    Key TEXT PRIMARY KEY,
    Value TEXT NOT NULL, -- JSON
    FetchedAt DATETIME NOT NULL,
    ExpiresAt DATETIME
);
```

### 5.5 Retry Strategy

**Exponential Backoff:**
- Initial: 5 seconds
- Multiplier: 2x per retry
- Max: 5 minutes
- Max retries per item: 10

**Jitter:** Add random 0–20% to prevent thundering herd

**Code Example:**
```csharp
private async Task<T> SyncWithRetryAsync<T>(
    Func<CancellationToken, Task<T>> operation,
    string operationName,
    CancellationToken ct)
{
    var attempt = 0;
    var delay = TimeSpan.FromSeconds(5);

    while (attempt < 10)
    {
        try
        {
            return await operation(ct);
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.ServiceUnavailable)
        {
            attempt++;
            var jitter = TimeSpan.FromMilliseconds(Random.Shared.Next(0, (int)(delay.TotalMilliseconds * 0.2)));
            await Task.Delay(delay + jitter, ct);
            delay = TimeSpan.FromSeconds(Math.Min(delay.TotalSeconds * 2, 300));
        }
    }

    _logger.LogError("Sync operation '{Op}' failed after 10 retries", operationName);
    throw new SyncException($"Failed to {operationName} after max retries");
}
```

---

## 6. License Validation
<!-- Jira: RLINK-51 | Epic: RLINK-6 | Synced: 2026-04-11 -->

### JWT Structure & Claims

**Header:**
```json
{
  "alg": "RS256",
  "kid": "recycler-iq-v1",
  "typ": "JWT"
}
```

**Payload:**
```json
{
  "iss": "recycler-iq-cloud",
  "sub": "site-{siteId}",
  "aud": "link-service",
  "typ": "site-license",
  "deviceId": "{macAddress}",  // Hardware binding
  "siteId": "{siteId}",
  "iat": 1704153600,
  "exp": 1735689600,            // 1 year
  "gracePeriodDays": 7          // ⚠ Currently hardcoded; should be in JWT
}
```

### Validation Flow

```
1. Application Startup
   ↓
2. Check local encrypted cache for license
   ├─ [Cache miss] → Fetch from cloud /api/licenses/{siteId}
   └─ [Cache hit] → Parse and validate
   ↓
3. Verify JWT signature
   ├─ [Invalid] → Fail startup; log error; do not proceed
   └─ [Valid] → Continue
   ↓
4. Extract deviceId claim; compare with local hardware MAC/serial
   ├─ [Mismatch] → Fail startup; log security alert
   └─ [Match] → Continue
   ↓
5. Check exp claim
   ├─ [Expired, but within grace period] → Warn; set OperationalMode = Grace
   ├─ [Expired, past grace period] → Lockout; prevent all operations
   └─ [Not expired] → Set OperationalMode = Normal
   ↓
6. Update local cache; emit LicenseStateChanged event
   ↓
7. Periodic re-validation (every 6 hours)
```

### Grace Period Logic

**Grace Period Duration:** ⚠ **Undefined** (suggest 7 days in JWT claim)

**Behavior:**
- If license is expired but `Now < exp + gracePeriodDays`:
  - Set `CanOperate = true`
  - Emit warning to logs and UI
  - Allow all operations (sync, deposits, etc.)
  - Attempt to renew on next sync
- If license is expired and `Now >= exp + gracePeriodDays`:
  - Set `CanOperate = false`
  - Block all recycler operations
  - Return HTTP 403 Forbidden to any MAUI requests
  - Log critical error; escalate to operator alert

**Grace Period Renewal:**
- If offline and in grace period: continue operating
- When online: fetch fresh license from cloud
- Update cache and reset expiration timer

### Lockout Behavior

**Conditions for Lockout:**
1. License expired + past grace period
2. Hardware binding mismatch (MAC/serial changed)
3. License revoked on cloud (e.g., subscription cancelled)

**On Lockout:**
- Set `CanOperate = false`
- Return HTTP 403 to all MAUI requests
- Log security event (deviceId, reason, timestamp)
- Emit `LicenseExpired` event (UI shows red alert)
- **Do NOT** suppress errors; operator must know

**Recovery:**
- Manual license renewal on cloud
- Link.Service detects change on next validation cycle
- Automatically resume operations (no restart required)

**Hardware Binding Mismatch Recovery:**
- If MAC/serial changes (e.g., network card replaced):
  - LicenseValidator detects mismatch
  - Log warning; escalate to operator
  - Operator contacts support; cloud reissues license with new MAC
  - Link.Service restarts or re-validates and resumes

### Key Storage & Protection

**Private Key:**
- ⚠ **Not specified:** Where is the private key stored for signing?
  - **Suggestion:** Cloud only (Azure Key Vault); Link.Service only has public key (embedded in binary or fetched at install)

**Public Key Distribution:**
- Embed in Link.Service binary at build-time (copy from Azure Key Vault)
- Or fetch from cloud at install-time and cache locally (encrypted)
- Never distribute public key in URL query params

**Encryption:**
- ⚠ **Not specified:** How is cached license encrypted on disk?
  - **Suggestion:** Use DPAPI (Windows Data Protection API) with machine key
  - Alternative: AES-256 with key derived from local machine identifier

---

## 7. Local Data Store (SQLite)
<!-- Jira: RLINK-52 | Epic: RLINK-1 | Synced: 2026-04-11 -->

### Database Location & Access
- **Path:** `%ProgramData%\RecyclerIQ\{SiteId}\link-service.db`
- **User:** NETWORK SERVICE (or LocalSystem if running as service)
- **Backup:** Optional; consider daily snapshot to cloud for audit/recovery
- **Size Estimate:** ~100 MB for 1 year of transactions + inventory + users

### Schema Overview

```
Recyclers
├── Id (TEXT PRIMARY KEY)
├── ManufacturerType (TEXT) -- Simulator, KisanKR10, etc.
├── DeviceLicense (TEXT)    -- JWT
├── IsAvailable (BOOLEAN)
├── LastHeartbeat (DATETIME)
└── Config (TEXT)           -- JSON manufacturer-specific settings

Transactions
├── Id (TEXT PRIMARY KEY)
├── RecyclerId (TEXT FK)
├── Type (TEXT)
├── Amount (INT)
├── DenominationBreakdown (TEXT JSON)
├── CreatedAt (DATETIME)
├── SyncStatus (TEXT) -- Pending, Synced, Failed
├── SyncAttempts (INT)
└── LastSyncError (TEXT)

InventorySnapshots
├── Id (TEXT PRIMARY KEY)
├── RecyclerId (TEXT FK)
├── DenominationCounts (TEXT JSON)
├── TotalValue (INT)
├── ManufacturerChecksum (TEXT)
├── CapturedAt (DATETIME)
└── SyncedAt (DATETIME NULL)

Users
├── Id (TEXT PRIMARY KEY)
├── SiteId (TEXT)
├── Name (TEXT)
├── PinHash (TEXT)
├── Role (TEXT)
├── Enabled (BOOLEAN)
├── CreatedAt (DATETIME)
├── ModifiedAt (DATETIME)
└── LastSyncedAt (DATETIME)

ConfigCache
├── Key (TEXT PRIMARY KEY)
├── Value (TEXT JSON)
├── FetchedAt (DATETIME)
└── ExpiresAt (DATETIME)

SyncStatus
├── Id (TEXT PRIMARY KEY) -- "transactions", "inventory", "users", "config"
├── LastSyncTime (DATETIME)
├── LastSuccessTime (DATETIME)
├── FailureCount (INT)
├── BackoffUntil (DATETIME NULL)
└── CircularBuffer (TEXT JSON) -- Last 10 sync attempts
```

### Caching & TTL

| Data | TTL | Refresh Trigger | Encryption |
|------|-----|-----------------|-----------|
| Transactions | Until synced | Sync success | ⚠ No |
| Inventory | 5 minutes (heartbeat) | Delta or timeout | ⚠ No |
| Users | 30 minutes | Interval or signal | ⚠ No (if PIN included) |
| Config | 24 hours | Interval or reload | ⚠ No |
| License | 6 hours | Interval or startup | **Yes (DPAPI)** |

### Data Cleanup & Retention

**Transaction Cleanup:**
- Keep synced transactions for 90 days (audit trail)
- Delete after 90 days (or per local law requirement)
- **Trigger:** Daily background job at 2:00 AM UTC

**Inventory Cleanup:**
- Keep last 30 snapshots per recycler
- Delete older snapshots
- **Trigger:** Weekly (Sundays, 3:00 AM UTC)

**User Cleanup:**
- Delete disabled users not accessed in 60 days
- Keep enabled users indefinitely
- **Trigger:** Weekly

**Config Cleanup:**
- Expired cache entries auto-deleted on read
- **Trigger:** On-demand (lazy deletion)

### Encryption Strategy

⚠ **Not Fully Specified**

**Recommendation:**
- **Transactions & Inventory:** No encryption (audit trail integrity matters; encrypt at rest via full-disk encryption or BitLocker)
- **Users (if PIN included):** Encrypt PinHash field using DPAPI
- **License:** Encrypt entire JSON field using DPAPI
- **Config:** No encryption (contains only feature flags, locale, etc.)

**Implementation:**
```csharp
public class DataProtectionProvider
{
    private readonly DataProtectionScope _scope = DataProtectionScope.CurrentUser;

    public string Encrypt(string plaintext)
    {
        var bytes = Encoding.UTF8.GetBytes(plaintext);
        var dpi = DataProtectionProvider.Create("RecyclerIQ.Link");
        var encrypted = dpi.Protect(bytes);
        return Convert.ToBase64String(encrypted);
    }

    public string Decrypt(string encrypted)
    {
        var bytes = Convert.FromBase64String(encrypted);
        var dpi = DataProtectionProvider.Create("RecyclerIQ.Link");
        var decrypted = dpi.Unprotect(bytes);
        return Encoding.UTF8.GetString(decrypted);
    }
}
```

---

## 8. Multi-Recycler Management
<!-- Jira: RLINK-53,RLINK-40 | Epic: RLINK-7 | Synced: 2026-04-11 -->

### Overview
A single Link.Service instance can manage 2–10 recyclers at one site (typical: 1–3). All recyclers connect via hardware abstraction layer; service coordinates operations to prevent conflicts.

### Recycler Discovery & Registration

**Startup Sequence:**
1. Load recycler config from local SQLite (persisted config)
2. If no config: fetch from cloud `/api/recyclers?siteId={siteId}`
3. For each config, instantiate IRecycler via factory:
   ```csharp
   var recycler = _recyclerFactory.CreateRecycler(config);
   _recyclerRegistry.RegisterRecycler(recycler);
   ```
4. Attempt `recycler.ConnectAsync()`; log result (may be offline initially)
5. HeartbeatService will attempt reconnect every 1 minute

### Concurrent Operations

**Constraint:** Each recycler can only process ONE operation at a time (exclusive lock).

**Implementation:**
```csharp
public class ConcurrentRecyclerManager
{
    private readonly Dictionary<string, SemaphoreSlim> _operationLocks = new();

    public async Task<T> ExecuteExclusiveAsync<T>(
        string recyclerId,
        Func<CancellationToken, Task<T>> operation,
        CancellationToken ct)
    {
        var @lock = _operationLocks.GetOrAdd(recyclerId, _ => new SemaphoreSlim(1, 1));

        using (await @lock.WaitAsync(ct)) // Exclusive access
        {
            return await operation(ct);
        }
    }
}
```

**Deposit Scenario (Multiple Recyclers):**
- Operator selects Recycler A for deposit
- Service acquires lock on Recycler A, starts deposit
- Operator selects Recycler B for withdrawal (while Recycler A is busy)
- Service acquires lock on Recycler B, starts withdrawal
- Both operations proceed in parallel (no conflict)
- Inventory sync acquires read-only access to both (non-exclusive; uses last-known-good snapshot)

**Inventory Sync (All Recyclers):**
```csharp
public async Task SyncInventoryAsync(CancellationToken ct)
{
    var recyclers = _recyclerRegistry.GetAllRecyclers();

    var tasks = recyclers
        .Select(r => SyncSingleRecyclerInventoryAsync(r, ct))
        .ToList();

    await Task.WhenAll(tasks); // Parallel, non-blocking
}

private async Task SyncSingleRecyclerInventoryAsync(
    IRecycler recycler,
    CancellationToken ct)
{
    await _concurrentManager.ExecuteExclusiveAsync(
        recycler.DeviceId,
        async _ => {
            var snapshot = await recycler.GetInventoryAsync(ct);
            await _inventoryRepository.SaveAsync(snapshot, ct);
        },
        ct);
}
```

### Load Balancing & Failover
<!-- Jira: RLINK-41,RLINK-42 | Epic: RLINK-7 | Synced: 2026-04-11 | Primary/fallback + failover metadata -->

⚠ **Not Specified:** How does MAUI client choose which recycler for a deposit?

**Suggestion:**
- Operator UI displays all recyclers with state (Online/Offline/Busy)
- Operator explicitly selects recycler (not automatic)
- If selected recycler is offline: show error; user must retry
- Future: Could implement round-robin or least-busy heuristic

### Recycler Decommissioning

**Cloud Initiates Decommission:**
- Cloud sends config sync with recycler marked `Enabled: false`
- Link.Service detects change, calls `recycler.DisconnectAsync()`
- Removes from registry; HeartbeatService stops monitoring
- Logs audit event
- Hardware physically removed by operator

---

## 9. Communication Architecture
<!-- Jira: RLINK-31,RLINK-32,RLINK-33,RLINK-34,RLINK-35,RLINK-36,RLINK-37,RLINK-38,RLINK-39 | Epics: RLINK-4,RLINK-5,RLINK-6 | Synced: 2026-04-11 -->

### High-Level Architecture

```
MAUI Hybrid Client (on site)
        ↓
    [gRPC over LAN]
        ↓
Link.Service (cross-platform daemon)
        ├─ Hardware Abstraction Layer
        ├─ Sync Engine
        └─ Local Data Store
        ↓↑
    [REST (HTTPS)]          — sync endpoints (transactions, inventory, users, config)
    [SignalR (wss)]         — real-time config push notifications from Cloud API
        ↓↑
Recycler.IQ Cloud (Azure)
```

### Communication Channels

| Channel | Protocol | Purpose |
|---|---|---|
| UI Client ↔ Link.Service | gRPC | Request/response commands + server streaming for real-time hardware events. Strongly typed .proto contracts. HTTP/2 over LAN. |
| Link.Service → Cloud API | REST (HTTPS) | Sync push (transactions, inventory) and sync pull (users, config). Interval-based + on-demand. |
| Cloud API → Link.Service | SignalR (WebSocket) | Real-time config change notifications. When admin updates recycler settings, user accounts, or any config in the Web Portal, Cloud API pushes a notification to Link.Service which triggers an immediate config pull via REST. |

### gRPC — UI Client ↔ Link.Service (Decided: ADR-002)
<!-- Jira: RLINK-31,RLINK-11,RLINK-32 | Epic: RLINK-4 | Synced: 2026-04-11 | .proto contracts, gRPC server, event streaming -->

**Why gRPC:**
- Bidirectional streaming for real-time hardware events (bill inserted, collection progress, recycler status changes, queue position updates)
- Request/response for commands (start deposit, withdraw, get inventory, check status)
- Strongly typed `.proto` contracts — mismatches caught at compile time
- HTTP/2 — low latency over LAN
- First-class .NET 10 support

**Service Discovery:** Clients use auto-discovery (mDNS or broadcast) to find Link.Service instances on the local network. Operator selects a recycler, and the Link.Service endpoint is stored in local client config.

### SignalR — Cloud API → Link.Service (Config Push)
<!-- Jira: RLINK-34,RLINK-35,RLINK-36,RLINK-37 | Epic: RLINK-5 | Synced: 2026-04-11 | CloudSignalRClient, reconnect, SyncSignalService, configurable interval -->

**Purpose:** Eliminate polling latency for config changes. When an admin modifies settings in the Web Portal, the change propagates to the site immediately.

**Events pushed via SignalR:**
- Recycler configuration changes (settings, enable/disable)
- User account changes (new user, role change, deactivation)
- Site configuration changes (auth method, sync interval, etc.)
- Tenant-level setting changes

**Flow:**
1. Admin makes a change in the Web Portal
2. Cloud API persists the change and publishes a SignalR notification to the affected Link.Service instance(s)
3. Link.Service receives the notification and triggers `SyncSignalService.RequestImmediateSyncAsync()`
4. SyncSignalService pulls the updated config via REST (same endpoints as interval-based sync)
5. 24h interval-based config sync remains as a fallback in case SignalR notification is missed

**Connection Management:**
- Link.Service maintains a persistent SignalR connection to Cloud API
- Auto-reconnect with exponential backoff on disconnect
- If SignalR connection is lost, interval-based polling continues as fallback
- Connection authenticated via the Link.Service API key (same key used for REST calls)

### gRPC API Contract
<!-- Jira: RLINK-31 (moving to RCORE) | Epic: RLINK-4 | Synced: 2026-04-12 -->

> **Note:** The `.proto` service definitions, message types, and full contract specification have moved to **PRD_SharedLibraries.md §6 (Protos Project)** in the RCORE PRD. The protos live in `RecyclerIQ.Protos` in the recycleriq-core repo and are consumed by Link.Service via NuGet (server stubs). See [PRD_SharedLibraries §6](../RCORE/PRD_SharedLibraries.md#6-protos-project-recycleriqprotos) for the canonical contract definitions.

**Link.Service implements the gRPC server** for these services:

| Service | RPCs | Pattern |
|---------|------|---------|
| `RecyclerService` | ListRecyclers, StartDeposit, EndDeposit, Withdraw, GetInventory | Unary |
| `StatusService` | GetStatus, TriggerSync | Unary |
| `RecyclerEventStream` | SubscribeToEvents | Server streaming |

### Offline-First Resilience

**If Link.Service is Down:**
- MAUI UI cannot start deposits or withdrawals
- UI displays "Service Offline" message
- Local cached data (last known inventory, user list) is **not** directly accessible to UI
- Rationale: Only Link.Service is trusted to validate license, acquire recycler locks, etc.

**If Cloud is Down (Link.Service is Up):**
- MAUI UI can still initiate deposits (Link.Service handles retry queuing)
- Transactions are queued locally and synced on cloud recovery
- UI can fetch user list from local cache (for PIN validation)
- Inventory is cached and refreshed on next sync

---

## 10. Non-Functional Requirements

### Resource Usage Targets

| Metric | Target | Notes |
|--------|--------|-------|
| **Memory** | < 200 MB at idle | Heap + managed resources |
| **Memory (Peak)** | < 500 MB during sync | Batch operations may spike |
| **CPU** | < 5% average (single core) | Mostly I/O-bound |
| **Disk I/O** | < 10 MB/sec during sync | SQLite write pattern |
| **Network** | < 100 kbps average | Batch sync operations |
| **Startup Time** | < 30 seconds | From service start to ready |

### Startup Sequence & Dependencies

**Boot Order (Critical):**
1. Application host starts
2. DI container initialized
3. SQLite database opened (create if missing)
4. SyncStatusService started (tracks sync state)
5. LicenseValidator started (must validate before operations)
6. UserSyncService started (populate offline user cache)
7. SyncWorker started (main sync loop)
8. SyncSignalService started (listen for signals)
9. HeartbeatService started (monitor recyclers)
10. IPC listener started (accept MAUI connections)
11. Ready for operations

**Failure Handling:**
- If step 3 (SQLite) fails: crash with clear error log; operator must fix DB corruption
- If step 5 (LicenseValidator) fails: crash with "License invalid" message; operator contacts support
- If step 6–9 fail: log warning, continue (graceful degradation; some features unavailable)

### Resilience & Restart Behavior

**Automatic Restart (platform-specific):**
- **Windows:** Service recovery configured via `sc.exe failure` — restart after 5 seconds on crash
- **Linux (systemd):** `Restart=on-failure`, `RestartSec=5` in the unit file
- **Docker:** `restart: unless-stopped` policy in docker-compose
- Max restarts per 24h: ⚠ **not specified** (suggest 100)

**Watchdog / Health Check:**
⚠ **Not Implemented:** Consider adding:
- Periodic self-check (every 30s): verify DB access, memory usage, thread count
- If self-check fails repeatedly: trigger diagnostic dump and restart
- Platform event log entry on each restart (Windows Event Log / journald)

**Graceful Shutdown:**
- On service stop request:
  1. Cancel all background service tasks
  2. Close IPC listeners (reject new connections)
  3. Wait for in-flight operations to complete (max 10s timeout)
  4. Flush any pending SQLite writes
  5. Close database connection
  6. Exit with code 0

### Logging & Observability
<!-- Jira: RLINK-16 | Epic: RLINK-8 | Synced: 2026-04-11 -->

**Log Levels:**
| Level | When | Example |
|-------|------|---------|
| **Debug** | Detailed trace (disabled in prod) | "Inventory delta detected: +5 bills" |
| **Info** | Significant events | "Sync completed: 12 transactions sent" |
| **Warning** | Recoverable errors | "Recycler offline, will retry in 5 min" |
| **Error** | Operational failure | "License validation failed: JWT expired" |
| **Critical** | System failure (halt) | "Database corrupted; cannot proceed" |

**Log Destinations:**
- **Local file:** Platform-dependent base path (rotate daily, keep 30 days):
  - Windows: `%ProgramData%\RecyclerIQ\{SiteId}\logs\link-service.log`
  - Linux: `/var/lib/recycleriq/{SiteId}/logs/link-service.log`
  - Docker: Stdout/stderr (container logging driver handles persistence)
- **Platform event log:** Critical/Error events — Windows Event Log or journald (for admin monitoring)
- **Cloud (optional):** Send logs to Azure Application Insights for analytics

**Audit Trail:**
- **Transaction sync:** Log tx ID, source, destination, result, timestamp
- **License events:** Log validation result, device ID, expiry, grace period status, timestamp
- **Recycler state changes:** Log online/offline transitions, errors, timestamp
- **Sync signal requests:** Log source (e.g., "MAUI-UI-user-001"), timestamp

**Structured Logging (example):**
```csharp
_logger.LogInformation(
    "Transaction synced: {TransactionId} | Amount: {Amount} | Status: {Status}",
    tx.Id, tx.Amount, tx.SyncStatus);

_logger.LogWarning(
    "License validation failed | DeviceId: {DeviceId} | Reason: {Reason} | NextValidationAt: {NextValidation}",
    license.DeviceId, validationResult.ErrorMessage, DateTime.UtcNow.AddHours(6));
```

### Service Installation (Cross-Platform)
<!-- Jira: RLINK-10 | Epic: RLINK-8 | Synced: 2026-04-12 | CI/CD pipeline -->

Link.Service is cross-platform (.NET 10) — the Kisan KR10 SDK uses a TCP binary protocol with no Windows-specific dependencies, enabling deployment on Windows, Linux, or Docker.

#### Windows (Windows Service)

**Installation Script (PowerShell):**
```powershell
$serviceName = "Link-Service-$siteId"
$exePath = "C:\Program Files\RecyclerIQ\LinkService\Link.Service.exe"
$displayName = "Recycler.IQ Link Service ($siteId)"

New-Service `
    -Name $serviceName `
    -BinaryPathName $exePath `
    -DisplayName $displayName `
    -StartupType Automatic `
    -ErrorAction Stop

# Set recovery options: restart after 5 seconds on failure
sc.exe failure $serviceName reset= 86400 actions= restart/5000
```

**Service User:**
- **LocalSystem** (default): Highest privileges, access to all system resources
- **NETWORK SERVICE** (alternative): Lower privileges, suitable if running multiple instances per machine

#### Linux (systemd)

**Unit File (`/etc/systemd/system/link-service-{SiteId}.service`):**
```ini
[Unit]
Description=Recycler.IQ Link Service (%i)
After=network.target

[Service]
Type=notify
ExecStart=/opt/recycleriq/linkservice/Link.Service
WorkingDirectory=/opt/recycleriq/linkservice
Restart=on-failure
RestartSec=5
User=recycleriq
Environment=DOTNET_ENVIRONMENT=Production

[Install]
WantedBy=multi-user.target
```

Supports Raspberry Pi (ARM64), Linux mini-PCs, and standard servers — enabling zero-Windows-licensing deployments when paired with Android tablet clients.

#### Docker

**docker-compose.yml:**
```yaml
services:
  link-service:
    image: recycleriq/link-service:latest
    restart: unless-stopped
    network_mode: host  # Required for LAN gRPC/mDNS discovery
    volumes:
      - ./data:/var/lib/recycleriq
    environment:
      - DOTNET_ENVIRONMENT=Production
```

#### Firewall (all platforms)
- **Inbound:** gRPC port (HTTP/2, configurable — default 5001) for UI client connections on LAN
- **Outbound:** HTTPS port 443 (REST sync + SignalR WebSocket connection to Cloud API)

---

## 11. Open Items & Gaps

### Critical Gaps (Must Resolve Before Production)

| Gap | Status | Suggested Resolution |
|-----|--------|----------------------|
| **Grace Period Duration** | ⚠ Undefined | Define in license JWT claim; recommend 7 days |
| **Sync Conflict Resolution** | ⚠ Undefined | Cloud is ground truth; log anomalies if local > cloud by > 10% |
| **gRPC .proto Contract Design** | ⚠ Not Started | Define service contracts for recycler commands and hardware event streams |
| **KisanRecycler Implementation** | ⚠ Incomplete | Add error handling for SDK exceptions; test sensor reliability |
| **Multi-Recycler Concurrency** | ⚠ Lightly Defined | Exclusive locks per recycler; document conflict scenarios |
| **Health Check / Watchdog** | ⚠ Not Implemented | Add periodic self-check; trigger restart on failure |
| **Local Data Encryption** | ⚠ Not Specified | Use DPAPI for sensitive fields (License, PinHash) |
| **Sync Rollback Strategy** | ⚠ Not Defined | If sync fails mid-batch: roll back all in batch; retry later |

### Secondary Gaps (Consider for v2)

| Gap | Impact | Suggested Resolution |
|-----|--------|----------------------|
| Private key distribution for JWT signing | Security | Use Azure Key Vault; embed public key in binary |
| Config reload without restart | Uptime | Implement config change detection; hot-reload non-critical settings |
| Remote diagnostics / telemetry | Operations | Send diagnostic reports to cloud on error; enable remote troubleshooting |
| Per-recycler offline queue size limit | Operations | Cap SQLite growth; alert if queue exceeds 10k transactions |
| On-demand sync trigger from Cloud Admin Portal | Latency | v2 nice-to-have — admin button to trigger immediate transaction sync via SignalR |
| User PIN reset / unlock workflow | Security | Define offline PIN reset flow; coordinate with cloud |
| Manufacturer SDK timeout handling | Reliability | Document timeout per SDK; implement adaptive retry |
| Multi-site Link.Service clustering | Scalability | Not needed for MVP (1 service per site); future: consider HA failover |

### Questions for Product & Cloud Team

1. **Grace Period:** Is 7 days reasonable? Or varies by tenant?
2. **Conflict Resolution:** If local inventory > cloud, should we alert operator or auto-correct?
3. **SignalR Hub Design:** Define the Cloud API SignalR hub contract for config push notifications
4. **Data Retention:** Keep synced transactions for 90 days? Or longer for audit?
5. **PIN Storage:** Cloud sends cleartext PINs? Or hashed? How to validate offline?
6. **KisanRecycler SDK:** Any known issues or limitations in KR.Server.dll?
7. **Watchdog:** Should Link.Service restart itself, or rely on platform daemon recovery (Windows SCM / systemd / Docker)?
8. **Encryption:** Full-disk BitLocker sufficient, or require per-field encryption?
9. **Multi-Recycler Load Balancing:** Operator manually selects, or auto-assign by availability?
11. **Sync Interval Range:** What min/max bounds should the Cloud Admin Portal enforce for the configurable sync interval?
10. **License Renewal:** Can it happen without downtime, or requires restart?

---

## Appendix A: Database Migration Strategy

When Link.Service starts with an older schema:

```csharp
public class DatabaseMigrator
{
    public async Task MigrateAsync(LinkDbContext context, ILogger logger)
    {
        var version = await GetCurrentSchemaVersionAsync(context);

        switch (version)
        {
            case 0: // Brand new DB
                await context.Database.EnsureCreatedAsync();
                await SetSchemaVersionAsync(context, 1);
                logger.LogInformation("Database created at schema version 1");
                break;

            case 1: // Upgrade to v2
                await UpgradeV1ToV2Async(context, logger);
                await SetSchemaVersionAsync(context, 2);
                break;

            case 2: // Already latest
                logger.LogInformation("Database is current at version 2");
                break;
        }
    }

    private async Task UpgradeV1ToV2Async(LinkDbContext context, ILogger logger)
    {
        // Example: Add new column
        await context.Database.ExecuteSqlRawAsync(
            "ALTER TABLE Transactions ADD COLUMN Metadata TEXT DEFAULT NULL");

        logger.LogInformation("Migrated schema from v1 to v2");
    }
}
```

---

## Appendix B: Example Service Configuration (appsettings.json)

```json
{
  "Sync": {
    "TransactionBatchSize": 50,
    "InventoryBatchSize": 1,
    "UserBatchSize": 100,
    "TransactionIntervalSeconds": 30,
    "InventoryHeartbeatSeconds": 300,
    "UserSyncIntervalSeconds": 1800,
    "ConfigSyncIntervalSeconds": 86400,
    "MaxRetries": 10,
    "RetryBackoffInitialMs": 5000,
    "RetryBackoffMaxMs": 300000
  },
  "License": {
    "ValidationIntervalSeconds": 21600,
    "GracePeriodDays": 7,
    "CloudLicenseEndpoint": "https://api.recycler-iq.com/api/licenses"
  },
  "Hardware": {
    "DefaultManufacturer": "Simulator",
    "HeartbeatIntervalSeconds": 60,
    "HeartbeatTimeoutMs": 10000,
    "RecoveryRetries": 3,
    "RecoveryDelayMs": 30000
  },
  "Database": {
    "ConnectionString": "Data Source={DataDir}/link-service.db",
    "CommandTimeout": 30
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft": "Warning"
    },
    "File": {
      "Path": "{DataDir}/logs/link-service-{Date}.log",
      "RetentionDays": 30
    },
    "PlatformLog": {
      "Enabled": true,
      "MinimumLevel": "Warning",
      "Note": "Windows → Event Log; Linux → journald; Docker → stdout"
    }
  }
}
```

---

## Appendix C: Testing Strategy

### Unit Tests
- **SyncWorker:** Mock IRecyclerRegistry, test batch logic, retry logic
- **LicenseValidator:** Mock JWT provider, test expiry, grace period, hardware binding
- **HeartbeatService:** Mock IRecycler, test state transitions, recovery logic

### Integration Tests
- **Sqlite ↔ Repository:** Use in-memory SQLite; verify CRUD operations
- **SimulatorRecycler:** Full end-to-end deposit/withdrawal flow
- **Sync Pipeline:** Local DB → Cloud API (mock), verify batch size, retry

### Acceptance Tests
- Start service, register two recyclers (Simulator + Kisan)
- Deposit on Recycler A, withdrawal on Recycler B (concurrent)
- Verify transactions synced, inventory updated, users populated
- Simulate license expiry; verify lockout and recovery on renewal
- Simulate cloud outage; verify local queueing and recovery

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-22 | DevOps | Initial draft |

---

**End of PRD**

---

### Next Steps
1. Review with cloud team for API contracts & conflict resolution approach
2. Finalize grace period duration (recommended: 7 days)
3. Design gRPC .proto contracts for UI client ↔ Link.Service communication
4. Complete KisanRecycler SDK wrapper & error handling
5. Implement database schema & migrations
6. Build hosted services in dependency order
7. Write integration tests (SQLite + SimulatorRecycler)
8. Package as platform installers (Windows service, Linux systemd, Docker image)

