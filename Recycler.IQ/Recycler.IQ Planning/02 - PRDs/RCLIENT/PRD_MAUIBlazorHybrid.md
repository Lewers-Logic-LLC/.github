# PRD: MAUI Blazor Hybrid Local Apps (Tax Authority & Retail)

**Company:** Lewers Logic LLC

**Product Line:** Recycler.IQ
**Document Version:** 1.0
**Last Updated:** 2026-03-22
**Scope:** Recycler.IQ UI.TaxAuthority and UI.RetailClient (Retail) local applications
**Status:** Final

---

## 1. Overview

This PRD defines the architecture, feature set, and deployment strategy for two MAUI Blazor Hybrid desktop applications that form the local interface tier for Recycler.IQ recycler networks. These apps run on-site at cash recycler locations and provide:

- **UI.TaxAuthority**: PIN-authenticated cash collection terminal for tax authority workflows (transaction-based, no shifts)
- **UI.RetailClient (Retail)**: Shift-based cash operations management for retail/bank locations (deposits, withdrawals, transfers, inventory)

Both applications are **local-first** with embedded SQLite databases, offline-capable, and paired with a Link.Service background agent (one per site) for site-level orchestration and cloud synchronization.

This document supplements the **Recycler.IQ Master PRD** and focuses exclusively on the MAUI Blazor Hybrid implementation, local data persistence, and installer distribution.

---

## 2. Architecture
<!-- Jira: RCLIENT-10,RCLIENT-52 | Epic: RCLIENT-1 | Synced: 2026-04-09 | Note: Repo scaffold + telemetry -->

### 2.1 Technology Stack
- **Framework:** MAUI Blazor Hybrid (.NET 10)
- **UI Framework:** Blazor (Razor components) with MAUI native bindings
- **Local Database:** SQLite (embedded, location-specific)
- **Distribution:** Windows .exe via ClickOnce-style bootstrapper installer; Android APK/AAB via sideload or managed distribution
- **Target Platforms:** Windows (primary on-site terminal) and Android (cost-effective tablet terminal)
- **Deferred Platforms:** iOS and macOS Catalyst are deferred indefinitely — no customer demand, and WebClient covers browser-based access on any device

### 2.2 Deployment Topology
```
┌─────────────────────────────────────────┐
│         Recycler.IQ Web Portal        │  (Cloud, browser-based)
│         (Config, User Mgmt, Analytics)  │
└────────────┬────────────────────────────┘
             │
             │ Installer download + API calls
             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Recycler Site (On-Premise)                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐    ┌──────────────────┐                   │
│  │ UI.TaxAuthority  │    │ UI.RetailClient     │                   │
│  │ (MAUI Blazor)    │    │ (Retail MAUI)    │                   │
│  │ • SQLite local   │    │ • SQLite local   │                   │
│  │ • Receipt print  │    │ • Receipt print  │                   │
│  │                  │    │                  │                   │
│  └────────┬─────────┘    └────────┬─────────┘                   │
│           │                       │                              │
│           └───────────┬───────────┘                              │
│                       │ Local IPC / Events                       │
│                       ↓                                          │
│           ┌───────────────────────┐                             │
│           │  Link.Service     │                             │
│           │  (Background Agent)   │                             │
│           │  • Sync to cloud      │                             │
│           │  • Device mgmt        │                             │
│           │  • Hardware control   │                             │
│           └───────────┬───────────┘                             │
│                       │                                          │
│           ┌───────────┴───────────┐                             │
│           ↓                       ↓                              │
│      [Hardware]            [Network/Cloud]                       │
│   Kisan KR10 Recycler    RecyclerIQ API Endpoint                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Inter-App Communication
- **Local Communication:** Apps communicate with Link.Service via gRPC over LAN (strongly typed .proto contracts, server streaming for hardware events). Proto definitions and generated client stubs are consumed via NuGet from `RecyclerIQ.Protos` (recycleriq-core repo) — see [PRD_SharedLibraries §6](../RCORE/PRD_SharedLibraries.md#6-protos-project-recycleriqprotos) for the full contract spec.
- **Shared Data:** Common SQLite database (site-level) or per-app databases (to be finalized)
- **Hardware:** Both apps interact with Kisan KR10 via Link.Service proxy calls

### 2.4 Shared UI Component Library
<!-- Jira: RCLIENT-53,RCLIENT-54,RCLIENT-55,RCLIENT-56,RCLIENT-57,RCLIENT-58,RCLIENT-59,RCLIENT-60,RCLIENT-61,RCLIENT-62 | Epic: RCLIENT-9 | Synced: 2026-04-09 -->
Both apps consume **[ProductName].UI.Shared** (Razor Class Library) for consistent UI patterns:
- Recycler status indicator widget
- Denomination breakdown display
- Cash inventory grid
- Receipt printer integration component
- PIN login keypad (numeric-only input with visual feedback)
- Hardware connectivity indicator
- Transaction sync status display (queue, pending, synced)
- Transaction audit row template

---

## 3. Tax Authority App (UI.TaxAuthority)
<!-- Jira: RCLIENT-18,RCLIENT-19,RCLIENT-20,RCLIENT-21,RCLIENT-22,RCLIENT-23,RCLIENT-24 | Epic: RCLIENT-3 | Synced: 2026-04-09 -->

### 3.1 Session Model
- **Transaction-based** (no shifts): Each cash collection is an independent transaction
- **Offline-capable:** PIN validation against locally cached user list
- **Session Lifecycle:** Login → Bill details → Collection → Finalization → Sync

### 3.2 Pages & Workflows
<!-- Jira: RCLIENT-16 | Epic: RCLIENT-2 | Synced: 2026-04-09 | Note: Login screen auth method -->

#### 3.2.1 Login Page
- **Input:** 4-digit numeric PIN (from shared keypad component)
- **Validation:** Offline-first against locally cached `Users` table
- **Fallback:** Works even with zero network connectivity
- **Error Handling:** 3-attempt limit (lockout duration: ⚠ to be defined), display PIN invalid
- **Success:** Redirect to Collector page, start transaction session

#### 3.2.2 Collector Page (Core Workflow)
**Objective:** Real-time bill collection with live progress tracking

**Inputs:**
- Bill denomination (user selects or types)
- Bill quantity
- (Optional) Payer identifier / transaction reference

**Display Elements:**
- Target amount (calculated: denomination × quantity)
- Real-time collection progress bar (cash inserted vs. target)
- Denomination breakdown of collected cash (live update)
- Current totals (inserted, target remaining)

**Actions:**
1. User enters bill details → confirm
2. Collector waits for citizen to insert cash into Kisan KR10 recycler
3. Hardware sends denomination data to Link.Service
4. Service forwards collection events to UI.TaxAuthority via IPC
5. App displays live progress in real-time
6. When target amount reached, show "Collection Complete" state
7. User reviews and finalizes transaction (or can cancel/restart)

**Hardware Integration:**
- Kisan KR10 denomination data via Link.Service
- ⚠ **Detail TBD:** Exact event schema (denomination count updates, total amount, error states)

#### 3.2.3 Inventory Page
- **Display:** Denomination breakdown of all cash currently in recycler (read-only from Link.Service)
- **Refresh:** On-demand or periodic poll (⚠ frequency TBD)
- **Data:** Count per denomination (e.g., $100: 42 units, $50: 105 units, etc.)

#### 3.2.4 Daily Summary Page
- **Scope:** All transactions for current calendar day
- **Columns:** Transaction ID, Time, Denomination, Amount Collected, Sync Status, Operator (PIN user)
- **Actions:** View details of any transaction, retry sync for "Pending" rows
- **Export:** ⚠ Print to receipt (if applicable) or CSV export (scope TBD)

### 3.3 Scope Boundaries (What NOT in This App)
- ❌ Tax account management
- ❌ User account creation or modification
- ❌ Report generation (beyond daily summary)
- ❌ Settings/configuration (handled by Cloud API during install)
- ❌ Hardware diagnostics (reserved for Link.Service)

### 3.4 Non-Functional Requirements (Tax Authority)
- **Startup Time:** ⚠ Target TBD (aim: <3 sec from cold start to login page)
- **Offline Duration:** Must support up to 8 hours offline (full business day)
- **Sync Batch Size:** Queue transactions locally, sync batch of 50 max per attempt
- **Memory Footprint:** ⚠ Target <200 MB idle
- **SQLite Retention:** Keep 90 days of transaction history locally

---

## 4. Retail App (UI.RetailClient)
<!-- Jira: RCLIENT-40,RCLIENT-41,RCLIENT-42,RCLIENT-43,RCLIENT-44,RCLIENT-45,RCLIENT-46 | Epic: RCLIENT-7 | Synced: 2026-04-09 -->

### 4.1 Session Model
- **Shift-based:** StoreManager or Operator opens a shift, performs operations, closes shift
- **Offline-capable:** PIN validated against locally cached users
- **Reconciliation:** Close Shift includes balance verification and receipt printing

### 4.2 Users & Roles
- **StoreManager:** Can open/close shifts, perform all operations
- **Operator:** Can perform deposits, withdrawals, transfers (under manager supervision); cannot close shift

### 4.3 Pages & Workflows

#### 4.3.1 Login Page
- Same as Tax Authority: 4-digit PIN, local validation, offline support, 3-attempt lockout

#### 4.3.2 Shift Operations Page (Main Dashboard)
**Objective:** Display active shift state and operation buttons

**Display:**
- Operator name (from login PIN)
- Shift start time and elapsed duration
- Current shift balance (sum of deposits - withdrawals)
- Inventory snapshot (denomination breakdown)
- Quick-action buttons: Deposit, Withdraw, Transfer, View Inventory

**⚠ Detailed page specs TBD** (layout, charts, alerts)

#### 4.3.3 Deposit Operation
- **Input:** Amount, denomination breakdown (or auto-detect via hardware)
- **Process:** Cash fed into recycler → Hardware validates → Record in shift ledger
- **Output:** Deposit receipt (printed), balance updated on dashboard
- **Sync Status:** Mark transaction "Pending" until cloud ack

#### 4.3.4 Withdrawal Operation
- **Input:** Amount, denominations requested
- **Validation:** Sufficient inventory available
- **Process:** Recycler dispenses cash → hardware confirms → Record in ledger
- **Output:** Withdrawal receipt (printed), balance updated
- **Sync Status:** Mark "Pending"

#### 4.3.5 Transfer Operation (CIT - Cash In Transit)
- **Input:** Amount, destination (another site or central bank), transport method
- **Process:** Cash prepared for pickup, receipt generated, balance reduced
- **Output:** Transfer receipt (printed), shift ledger updated
- **Sync Status:** Mark "Pending" → updates to "Transferred" once CIT pickup confirmed (via Link.Service)
- **⚠ CIT integration spec TBD**

#### 4.3.6 Inventory Page
- **Display:** Read-only denomination breakdown of recycler inventory
- **Refresh:** On-demand or periodic
- **Restrictions:** No modifications from UI (controlled by Deposit/Withdraw operations)

#### 4.3.7 Close Shift Page
- **Reconciliation:** Compare system balance (ledger) vs. physical recycler state
- **Display:** Expected vs. actual by denomination
- **Actions:**
  - If balanced: print "Close Shift" receipt → shift record saved to SQLite + queued for sync
  - If variance: flag discrepancy (⚠ escalation process TBD), allow override with manager PIN
- **Receipt:** Shows all shift transactions, final balance, timestamp, manager approval

### 4.4 Non-Functional Requirements (Retail)
- **Startup Time:** ⚠ Target TBD (aim: <3 sec)
- **Concurrent Shifts:** Single shift per device (one app instance per recycler location)
- **Session Timeout:** ⚠ TBD (e.g., auto-logout after 15 min idle)
- **Memory Footprint:** ⚠ Target <250 MB idle
- **SQLite Retention:** Keep 180 days of shift/transaction history

---

## 5. Shared UI Component Library (UI.Shared)
<!-- Jira: RCLIENT-53,RCLIENT-54,RCLIENT-55,RCLIENT-56,RCLIENT-57,RCLIENT-58,RCLIENT-59,RCLIENT-60,RCLIENT-61,RCLIENT-62 | Epic: RCLIENT-9 | Synced: 2026-04-09 -->

### 5.1 Consumption Pattern
- **Packaged as:** Razor Class Library (.NET 10)
- **Consumed by:** UI.TaxAuthority, UI.RetailClient, optionally Web Portal
- **Distribution:** NuGet package (internal feed)
- **Versioning:** Semantic versioning; apps pin compatible version range

### 5.2 Component Inventory

| Component | Purpose | Inputs | Outputs |
|-----------|---------|--------|---------|
| `RecyclerStatusIndicator` | Shows online/offline, health status | isOnline, isHealthy, error | Visual status badge |
| `DenominationBreakdown` | Table of denomination counts | denominationMap (dict) | HTML table, sortable |
| `CashInventoryGrid` | Live inventory with total amount | inventory data | Grid with running total |
| `ReceiptPrinterComponent` | Queue receipt print jobs | receiptContent, printerName | Print result / error |
| `PINKeypad` | Numeric input, 4-digit entry | onSubmit callback | PIN string (no echo) |
| `HardwareConnectivityIndicator` | Shows Kisan KR10 connection state | connectionStatus enum | Status icon + tooltip |
| `SyncStatusDisplay` | Shows pending/synced transaction counts | queuedCount, syncedCount | Status text + retry button |
| `TransactionAuditRow` | Single transaction display (template) | transaction object | HTML row (denomination, amount, time, status) |

### 5.3 Design & Styling
- **Palette:** Recycler.IQ brand (primary: #0F084B, secondary/accent: #A0D2E7, per Master PRD)
- **Responsive:** Works on desktop Windows (primary) and Android tablets (secondary terminal option)
- **Accessibility:** WCAG 2.1 AA standard (⚠ detailed audit TBD)

---

## 6. Offline & Local-First Architecture

### 6.1 SQLite Schema (Shared)

#### Users Table
```
id (PK, int)
pin_hash (varchar, bcrypt or PBKDF2)
name (varchar)
role (enum: Operator, StoreManager, TaxAuthority)
active (bool)
last_synced (timestamp)
```

#### Transactions Table
```
id (PK, uuid)
session_id (uuid, foreign key to Sessions)
transaction_type (enum: Collect, Deposit, Withdraw, Transfer)
denomination (int, bill amount in cents or count)
quantity (int, number of bills)
total_amount (decimal)
timestamp (datetime)
operator_pin_hash (varchar, reference to user)
sync_status (enum: Pending, Synced, Failed, Conflict)
sync_error (text, error message if failed)
retry_count (int)
local_id (uuid, unique identifier before cloud ack)
cloud_id (uuid, filled after sync)
```

#### Sessions Table (Retail Shift-Based)
```
id (PK, uuid)
session_type (enum: Shift, Transaction)
operator_pin_hash (varchar)
start_time (datetime)
end_time (nullable datetime)
starting_balance (decimal)
ending_balance (decimal)
expected_inventory (json blob, denomination map)
actual_inventory (json blob, from final hardware read)
variance_amount (decimal)
variance_notes (text)
status (enum: Open, Closed, Reconciliation_Required)
sync_status (enum: Pending, Synced, Failed)
```

#### Hardware Events Table (Local Queue)
```
id (PK, int)
timestamp (datetime)
event_type (enum: DenominationDetected, ItemInserted, ItemRejected, HardwareError)
denomination (int, nullable)
count (int, nullable)
error_code (varchar, nullable)
processed (bool)
```

### 6.2 PIN Authentication (Offline)
<!-- Jira: RCLIENT-12,RCLIENT-13,RCLIENT-14,RCLIENT-15 | Epic: RCLIENT-2 | Synced: 2026-04-09 -->
- **Hashing:** PBKDF2-SHA256 (not bcrypt, for speed) with 100K iterations
- **Storage:** pin_hash in Users table, populated during device registration via UserSyncService (cloud → local)
- **Offline Validation:** Compare hash locally against cached Users table; no cloud call required
- **Online Authentication:** App uses whichever auth path the tenant is configured for (SSO/OAuth/Custom); no PIN required when online
- **Offline During Sync:** If cloud is unreachable, PIN validation falls back to locally cached credentials with expiration window (duration TBD; recommend 24–48 hours)
- **Cache Expiration:** Offline PIN cache expires if not synced for X days; user must re-authenticate online before operations resume
- **Revocation:** Link.Service pulls revoked PIN list via UserSyncService during sync cycle; updates local revocation cache
- **Audit:** All PIN entries logged with timestamp, result (success/failure), and sync status

### 6.3 Sync Status & Transaction Queue
- **Pending Transactions:** Stored in Transactions table with sync_status = "Pending" until acknowledged by cloud
- **Synced Status:** Mark transaction "Synced" only after cloud API confirms receipt and returns cloud_id
- **Failed Status:** If sync fails after retries, mark as "Failed" with error message; user can manually retry
- **Trigger:** Link.Service periodically (every 5 min or on-demand) attempts sync via UserSyncService
- **Batching:** Send up to 50 transactions per API call (SyncStatus: Pending/Synced tracked per transaction)
- **New Users Offline:** Cannot add new users to app while offline; new users must wait for next cloud sync (offline mode prevents user creation)
- **Permission Changes:** Updates to user permissions/roles take effect on next sync cycle; cached permissions are read-only until sync completes
- **Conflict Handling:** If cloud returns duplicate-detected error, mark as "Conflict" and display warning
- **Retry Logic:** Exponential backoff (1 sec, 2 sec, 4 sec, max 60 sec between attempts)
- **User Visibility:** Sync status icon and pending count shown on main pages; transaction-level sync status displayed in ledger

### 6.4 Local Data Architecture (SQLite)
- **Local Source of Truth:** SQLite is the primary data store until sync completes; cloud is secondary copy
- **Entity Framework Core:** Same repository abstraction layer used for both local SQLite and cloud DbContext
- **ITenantConnectionResolver Pattern:** Not used locally; local SQLite is single-tenant-per-device
  - *Cloud use:* ITenantConnectionResolver routes DbContext to correct tenant database
  - *Local use:* Single SQLite file per site; no tenant resolution needed
- **Encryption:** ⚠ TBD; recommend DPAPI on Windows (tied to system user) or SQLCipher for cross-platform support
- **Master Key Storage:** Recommend DPAPI or hardware module; deferred to Phase 2 unless regulatory mandate requires Phase 1
- **Data Retention:** Keep 90 days transaction history (Tax Authority), 180 days (Retail) before archive

---

## 7. Installer & Distribution
<!-- Jira: RCLIENT-47,RCLIENT-48,RCLIENT-49,RCLIENT-50,RCLIENT-51 | Epic: RCLIENT-8 | Synced: 2026-04-09 -->

### 7.1 Bootstrapper Flow

```
1. User downloads installer .exe from Web Portal
   ├─ Installer is small (~10 MB) ClickOnce-style bootstrapper
   │
2. User runs installer
   ├─ (Optional) Prompt: "Select recycler location / device?"
   │  └─ List fetched from Cloud API (based on Web Portal user context)
   │
3. Bootstrapper calls RecyclerIQ API to pull device config
   ├─ API returns: app version, .NET 10 runtime requirement, SQLite schema version
   ├─ Downloads latest MAUI app package (.zip or .exe, ~50-100 MB)
   │
4. Bootstrapper unpacks to app directory
   ├─ Typically: C:\Program Files\RecyclerIQ\[AppName] or C:\Users\[User]\AppData\Local\RecyclerIQ
   │
5. Bootstrapper writes local config file
   ├─ JSON file: app.config.json
   │  ├─ deviceId (UUID assigned during registration)
   │  ├─ deviceName (location / recycler name)
   │  ├─ cloudApiEndpoint (base URL)
   │  ├─ siteId (which site this device belongs to)
   │  ├─ recyclerHardwareType (e.g., "Kisan KR10")
   │  └─ features (feature flags, e.g., mobile_sync, offline_mode)
   │
6. Bootstrapper registers device with Cloud API
   ├─ POST /devices/register
   │  ├─ deviceId, serialNumber (from Kisan KR10), MAC address
   │  ├─ returns: activation token (for future API calls)
   │
7. Bootstrapper starts Link.Service (Windows background service registration)
   ├─ Service autostart enabled
   ├─ Service reads app.config.json
   ├─ Service initializes SQLite, schedules sync
   │
8. Bootstrapper launches app
   └─ App reads app.config.json
      ├─ Checks local SQLite for Users table
      ├─ If empty, syncs default users from cloud
      └─ Display login page
```

### 7.2 Config File Format (app.config.json)
```json
{
  "app": {
    "name": "UI.TaxAuthority",
    "version": "1.0.0"
  },
  "device": {
    "id": "uuid-12345",
    "name": "Site A - Recycler 1",
    "serialNumber": "KR10-123456",
    "macAddress": "00:11:22:33:44:55"
  },
  "site": {
    "id": "uuid-site-789",
    "name": "Tax Authority Branch 1"
  },
  "api": {
    "endpoint": "https://api.recycler-iq.com",
    "timeoutMs": 30000
  },
  "hardware": {
    "type": "Kisan KR10",
    "commPort": "COM3"
  },
  "sync": {
    "intervalMinutes": 5,
    "batchSize": 50,
    "maxRetries": 5
  },
  "features": {
    "offlineMode": true,
    "mobileSync": false,
    "crashReporting": true
  }
}
```

### 7.3 Auto-Update Strategy
- **⚠ CRITICAL GAP:** Auto-update mechanism not defined
  - **Questions:**
    - Does bootstrapper self-update? Manual download vs. automatic check?
    - MAUI app self-update via cloud API? Or bootstrapper re-run required?
    - Rollback capability?
    - Update frequency and notification to end-user?
  - **Recommendation for Phase 1:**
    - Bootstrapper version pinned to OS install; user must re-download for bootstrapper updates
    - MAUI app auto-checks cloud API on startup; displays "Update Available" banner
    - User clicks "Update Later" or "Update Now" (manual trigger, not forced)
    - Update downloads in background, restarts app on next close
    - Store 2 versions locally (current + previous) for quick rollback if corrupt

### 7.4 Device Registration & Activation
- **Serial Number Source:** Read from Kisan KR10 hardware (via Link.Service)
- **MAC Address:** Read from first active network interface (Windows API)
- **Activation Token:** Stored locally, used in all API calls; revoked on cloud if device unregistered
- **Uninstall:** Link.Service cleanup (remove device record, stop sync)

---

## 8. Receipt Printing

### 8.1 Current State
- **Requirement:** Both apps must support receipt printer integration
- **Hardware:** Assumed thermal printer (e.g., Epson TM series) connected via USB or Network
- **Scope:** Component in UI.Shared (ReceiptPrinterComponent) provided; **no receipt templates designed yet**

### 8.2 Receipt Types (To Be Designed)

| Receipt Type | Trigger | Required Fields | Print Scope |
|--------------|---------|-----------------|-------------|
| **Collection Receipt** | Tax Authority: finalize collection | Transaction ID, denominations, amount, timestamp, operator, sync status | Phase 2 (template design pending) |
| **Open Shift Receipt** | Retail: open shift | Shift ID, operator, start time, starting balance | Phase 2 |
| **Deposit Receipt** | Retail: finalize deposit | Deposit amount, denominations, timestamp, shift ID | Phase 2 |
| **Withdrawal Receipt** | Retail: finalize withdrawal | Withdrawal amount, denominations, timestamp, shift ID | Phase 2 |
| **Close Shift Receipt** | Retail: close shift | Shift summary, final balance, variance (if any), all transactions | Phase 2 |
| **Transfer/CIT Receipt** | Retail: finalize transfer | Transfer amount, destination, timestamp, CIT tracking number | Phase 2 |

### 8.3 Printer Setup (Phase 1)
- **Discovery:** ReceiptPrinterComponent automatically detects USB/Network printers on device
- **Configuration:** Store selected printer name in app.config.json
- **Fallback:** If printer offline, queue receipt to "PrintQueue" table; retry on reconnect
- **Error Handling:** Display "Printer offline" warning; allow user to continue (receipt queued) or wait

### 8.4 Template Design (Deferred)
- **Phase 2 deliverable:** Mockups for each receipt type
- **Considerations:**
  - QR code for transaction verification (optional)
  - Barcode for shift/transaction tracking
  - Logos and branding
  - Localization (language, currency format)

---

## 9. Non-Functional Requirements

### 9.1 Performance
| Metric | Target | Notes |
|--------|--------|-------|
| **App Startup (Cold)** | ⚠ <3 seconds | Login page load-ready |
| **App Startup (Warm)** | <1 second | Cache hits, minimal re-init |
| **PIN Validation** | <500 ms | Local hash compare only |
| **Denomination Data Update** | <1 second | Push from Link.Service via IPC |
| **Transaction Finalize** | <2 seconds | Write to SQLite + IPC to Service |
| **Sync Batch (50 txns)** | <10 seconds | API call + DB write |
| **Inventory Query** | <500 ms | SQLite read, no joins |
| **Page Navigation** | <300 ms | Blazor render + state update |

### 9.2 Resource Usage
| Resource | Target | Notes |
|----------|--------|-------|
| **Memory (Idle)** | <200 MB (Tax), <250 MB (Retail) | ⚠ Baseline TBD after profiling |
| **Memory (Peak)** | <500 MB | During large batch sync |
| **Disk Space** | <500 MB | App + SQLite + logs |
| **Network Bandwidth** | <5 MB per sync batch | Compressed JSON payloads |
| **CPU** | <5% idle, <30% active | No constant polling or high-frequency updates |

### 9.3 Reliability & Availability
| Aspect | Requirement |
|--------|-------------|
| **Uptime** | 99% during business hours (8am–6pm local) |
| **MTTR (Mean Time to Recovery)** | <5 min (restart app/service) |
| **Data Loss** | Zero tolerance; sync confirmation required before purge from queue |
| **Concurrent Users** | 1 per device (single-shift model) |
| **Offline Duration** | Up to 8 hours without network |

### 9.4 Windows Platform Support
- **⚠ CRITICAL GAP:** Windows version compatibility not specified
  - **Questions:**
    - Windows 10? Windows 11? Both?
    - Minimum build version?
    - .NET 10 Windows Runtime support confirmed?
  - **Recommendation for Phase 1:**
    - Target: Windows 10 (Build 1809+) and Windows 11
    - Document .NET 10 runtime requirements in installer
    - Test on both before release

### 9.5 Logging & Diagnostics
| Aspect | Requirement |
|--------|-------------|
| **Local Logs** | App and Service write to C:\ProgramData\RecyclerIQ\logs; rotate daily, keep 30 days |
| **Log Level** | Info (default), Debug (on-demand via config), Error (always) |
| **Sensitive Data** | Never log PIN hashes, API tokens, full transaction amounts (truncate) |
| **Structured Logging** | Use JSON format for cloud ingestion |

### 9.6 Crash Reporting & Error Handling
- **⚠ CRITICAL GAP:** Crash reporting strategy not defined
  - **Questions:**
    - Local error log only, or automatic cloud report?
    - PII/sensitive data filtering required?
    - User consent for crash report submission?
    - Alert/escalation for critical errors (e.g., hardware disconnected)?
  - **Recommendation for Phase 1:**
    - Catch all unhandled exceptions at App level; log to local file
    - Display user-friendly error message (not stack trace)
    - Provide "Report Error" button in error dialog (manual upload to cloud)
    - Store crash logs in encrypted local folder (tied to DPAPI on Windows)
    - Phase 2: Automatic crash reporting with user opt-in

### 9.7 Security
| Aspect | Requirement |
|--------|-------------|
| **API Authentication** | Device activation token (OAuth 2.0 Bearer, expires 1 year) |
| **API Transport** | HTTPS/TLS 1.2+ only; certificate pinning ⚠ TBD |
| **PIN Storage** | PBKDF2-SHA256, 100K iterations, salted |
| **PIN Transmission** | Never over network; validated locally only |
| **Database Access** | SQLite file-level permissions (user who runs service only) |
| **Hardware Communication** | Link.Service proxy; no direct app-to-hardware access |

### 9.8 Accessibility
- **WCAG 2.1 Level AA** (target, ⚠ detailed audit deferred to Phase 2)
- **Screen Reader Support:** All components include ARIA labels
- **Keyboard Navigation:** Full app functional without mouse
- **Color Contrast:** 4.5:1 minimum for text
- **Font Sizing:** Support browser zoom up to 200%

---

## 10. Open Items & Gaps

### Critical Gaps (Block Phase 1 Release)
- [ ] **Receipt Template Design** – No mockups or specs for any receipt type; must define format, fields, QR/barcode strategy before print integration can be tested
- [ ] **Windows Version Requirements** – Confirm min/max Windows versions, .NET 10 Runtime compatibility, test on both Windows 10 and 11
- [ ] **Startup Time Targets** – Define acceptable cold-start and warm-start times; establish baseline via profiling
- [ ] **Memory/Disk Targets** – Current targets are estimates; must validate post-prototype build
- [ ] **Local Data Encryption Strategy** – No decision on SQLCipher vs. DPAPI vs. BitLocker; security policy required
- [ ] **Retail App Page Specifications** – Only high-level workflows described; missing detailed UI layouts for Shift Dashboard, Deposit/Withdraw/Transfer pages

### High-Priority Gaps (Phase 1 or Early Phase 2)
- [ ] **Auto-Update Mechanism** – Define bootstrapper self-update, MAUI app update delivery, rollback strategy, user notification model
- [ ] **Crash Reporting Strategy** – Local vs. cloud reporting, PII filtering, error alerting thresholds, user consent
- [ ] **Printer Hardware Qualification** – Test with specific thermal printer models; document supported models in installer
- [ ] **CIT Integration Specification** – Define how Retail transfers interact with external CIT tracking system; API contract and status updates
- [ ] **Reconciliation Escalation Process** – What happens if Close Shift balance variance exceeds threshold? Manager override rules? Cloud notification?
- [ ] **Session Timeout & Idle Logout** – Define idle duration before automatic logout (Retail shift close); preserve unsaved transactions?
- [ ] **PIN Lockout Policy** – Define lockout duration after 3 failed attempts (e.g., 15 min, 1 hour); recovery mechanism

### Medium-Priority Gaps (Phase 2)
- [ ] ~~**Mobile Roadmap**~~ **RESOLVED** – Android included in v1 scope (Windows + Android). iOS and macOS Catalyst deferred indefinitely. Android tablets serve as cost-effective operator terminals connecting to Link.Service via gRPC over LAN.
- [ ] **Report Generation & Export** – Scope of reports beyond Daily Summary; CSV/PDF export formats, cloud-based report portal
- [ ] **Multi-Language Support** – UI localization, receipt localization, currency/date format handling
- [ ] **Performance Profiling & Optimization** – Establish baselines, identify bottlenecks (Blazor vs. native render, SQLite query optimization)
- [ ] **User Onboarding & Help System** – In-app tutorials, FAQ, context-sensitive help for operations
- [ ] **Audit Trail & Compliance** – Detailed audit logging, user action tracking, regulatory compliance checks (SOX, PCI-DSS)

### Lower-Priority Items (Phase 3+)
- [ ] **Dark Mode Support** – Optional UI theme
- [ ] **Offline Analytics** – Local reporting on queued vs. synced transactions
- [ ] **Hardware Diagnostics Portal** – Self-service troubleshooting tools for operators
- [ ] **Integration with Tax Authority Backend** – Real-time validation of bill denominations, limits, or clearance

---

## 11. Dependencies & Integration Points

### External Integrations
1. **Recycler.IQ Cloud API**
   - Endpoint: `https://api.recycler-iq.com` (from Master PRD)
   - Operations: User sync, device registration, transaction sync, config pull, PIN revocation check
   - Auth: Device activation token (Bearer)

2. **Link.Service (Local Background Agent)**
   - Communication: gRPC over LAN (see ADR-002)
   - Operations: Hardware communication proxy, sync orchestration, event streaming (denomination updates)
   - Lifecycle: Started by installer, runs as Windows service, controlled by both apps

3. **Kisan KR10 Hardware**
   - Communication: Via Link.Service only (not direct from MAUI apps)
   - Data: Denomination detection, item insertion/rejection, error codes
   - Port: TBD (RS-232, USB, or network); read from app.config.json

4. **Receipt Printer**
   - Discovery: Windows print API (local printers)
   - Protocol: Standard Windows Print Spooler
   - Queuing: Local PrintQueue table in SQLite

### Internal Dependencies
- **UI.Shared Component Library:** Consumed via NuGet; versioning pinned in app project files
- **SQLite:** Embedded via NuGet (e.g., SQLite.Net-PCL or SQLite for .NET 10)
- **.NET 10 Runtime:** Bundled with MAUI app or downloaded by bootstrapper

---

## 12. Success Criteria & Acceptance Tests

### Phase 1 (MVP)
- [ ] Installer downloads, registers device, and launches UI.TaxAuthority without errors
- [ ] PIN login works offline; validates against locally cached users
- [ ] Collector page displays real-time denomination updates from mock Kisan KR10 (via Link.Service simulator)
- [ ] Transaction syncs to cloud API and receives confirmation (no duplicates)
- [ ] Daily Summary displays all transactions for current day with correct sync status
- [ ] Retail app Shift Open/Close records saved to SQLite and queued for sync
- [ ] Deposit/Withdrawal operations update local inventory and sync status
- [ ] Receipt printing queue works (print to file or test printer)
- [ ] App handles 8-hour offline period; queue persists and syncs on reconnect
- [ ] No sensitive data (PINs, API tokens) visible in logs or debug output

### Phase 2 (Extended)
- [ ] Auto-update downloads and installs new version without data loss
- [ ] Crash reporting captures errors and uploads to cloud (with user consent)
- [ ] Receipt templates printed correctly for all receipt types
- [ ] Android tablet version connects to Link.Service via gRPC and operates as a secondary terminal
- [ ] Regulatory audit trail contains all required events and user actions
- [ ] Performance baseline: startup <3s, PIN validation <500ms, sync 50 txns <10s

---

## 13. Appendix: Glossary

| Term | Definition |
|------|-----------|
| **MAUI** | Multi-platform App UI (Microsoft framework for .NET 10 — targeting Windows and Android for Recycler.IQ) |
| **Blazor Hybrid** | Blazor web UI rendered in native app shell (MAUI) |
| **SQLite** | Lightweight embedded relational database |
| **IPC** | Inter-Process Communication (local apps talking to Link.Service) |
| **Link.Service** | Background service per recycler location (cross-platform — Windows service or Linux systemd); orchestrates sync, hardware control |
| **Sync Status** | Transaction state: Pending (local only), Synced (cloud confirmed), Failed (retry needed) |
| **PIN** | 4-digit numeric identifier for operator authentication |
| **Kisan KR10** | Currency recycler hardware (first supported model) |
| **ClickOnce** | Microsoft installer framework; bootstrapper pattern used here |
| **DPAPI** | Data Protection API (Windows encryption tied to user login) |
| **Reconciliation** | Balance verification at shift close (expected vs. actual inventory) |
| **CIT** | Cash In Transit (external armored car service) |

---

## Document Control

| Field | Value |
|-------|-------|
| **Created** | 2026-03-22 |
| **Last Modified** | 2026-03-22 |
| **Owner** | Recycler.IQ Product Team |
| **Status** | Draft (Phase 1 Planning) |
| **Audience** | Development Team (Backend, Frontend, QA) |
| **Related Docs** | Recycler.IQ Master PRD, Link.Service PRD (TBD), UI.Shared Component Catalog (TBD) |

---

**End of PRD**
