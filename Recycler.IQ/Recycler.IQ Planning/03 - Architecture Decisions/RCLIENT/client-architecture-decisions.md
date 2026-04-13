# Recycler.IQ --- Architecture Decision Records
## MAUI Blazor Hybrid Client Architecture
**April 11, 2026**
**Company:** Lewers Logic LLC
**Copyright:** &copy; 2026 Lewers Logic LLC. All rights reserved.

**Status:** Final

> This document records architectural decisions for the Recycler.IQ local client applications (UI.TaxAuthority and UI.RetailClient). These decisions supplement the Master PRD v4 and MAUI Blazor Hybrid PRD.

<!--
  Jira Project: RCLIENT (RecyclerIQ Clients)
  Epics: RCLIENT-1 (Repo Setup), RCLIENT-2 (Tax Authority Auth), RCLIENT-3 (Tax Authority Pages),
         RCLIENT-7 (Retail Pages), RCLIENT-8 (Installer), RCLIENT-9 (UI.Shared)
  Last Synced: 2026-04-11
-->

---

## ADR-001: MAUI Blazor Hybrid for Local Client Applications
<!-- Jira: RCLIENT-10 | Epic: RCLIENT-1 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-001 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

The local client applications (Tax Authority and Retail) need to run on Windows desktops (primary) and Android tablets (cost-effective operator terminals) with offline capability, local SQLite storage, and native hardware access (receipt printers, system tray on Windows). Options considered were WPF, Electron, and MAUI Blazor Hybrid. iOS and macOS Catalyst are deferred indefinitely — the WebClient (Blazor Server) covers browser-based access on any remaining platform.

### Decision

Use **MAUI Blazor Hybrid (.NET 10)** for both local client applications. Blazor Razor components run inside a native MAUI shell, combining web UI flexibility with native platform access.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **WPF** | Native Windows, mature | Windows-only forever, no component sharing with web portal, separate UI framework from backend |
| **Electron** | Cross-platform, web tech | Separate Node.js pipeline, no .NET code sharing, large bundle size, memory overhead |
| **MAUI Blazor Hybrid** | Full-stack .NET, shared Razor components with web portal, Windows + Android from same codebase | Newer framework, smaller community, MAUI-specific quirks |

### Consequences

- Single language (C#) across backend, services, and UI --- reduces context switching
- Razor components from `RecyclerIQ.UI.Shared` are reusable across both local apps and the Blazor WASM web portal
- **Target platforms:** Windows (primary on-site terminal) and Android (cost-effective tablet terminal connecting to Link.Service via gRPC over LAN). iOS and macOS Catalyst deferred --- WebClient covers browser-based access on those platforms.
- .NET 10 runtime must be bundled with or installed alongside the app (Windows); Android packages the runtime in the APK/AAB
- Team only needs Blazor expertise, not separate WPF or React/Electron skills

---

## ADR-002: Offline-First with Local SQLite Persistence
<!-- Jira: RCLIENT-12,RCLIENT-13,RCLIENT-14,RCLIENT-15 | Epic: RCLIENT-2 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-002 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

Cash recycler sites operate in environments where network connectivity is unreliable. Tax authority field offices and retail locations may lose internet for hours during a business day. The system must support a full 8-hour offline business day without data loss.

### Decision

Each client application uses an **embedded SQLite database** as the local source of truth. Transactions are written to SQLite first, then queued for cloud sync via Link.Service. The cloud copy is secondary until sync confirmation is received.

### Schema Design

Four core tables: Users (cached credentials), Transactions (offline queue), Sessions (retail shift tracking), and HardwareEvents (local event buffer). Schema details in PRD_MAUIBlazorHybrid.md Section 6.1.

### Consequences

- Zero data loss during network outages --- all operations write locally first
- Sync status is tracked per-transaction (Pending, Synced, Failed, Conflict)
- Same EF Core repository abstraction works for both local SQLite and cloud Azure SQL
- No `ITenantConnectionResolver` needed locally --- single-tenant-per-device model
- Data retention policy: 90 days (Tax Authority), 180 days (Retail) before local archive
- Encryption strategy (SQLCipher vs. DPAPI) deferred --- must resolve before production

---

## ADR-003: PBKDF2-SHA256 for Local PIN Authentication
<!-- Jira: RCLIENT-12,RCLIENT-13 | Epic: RCLIENT-2 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-003 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

Operators authenticate via 4-digit PINs at the local app. PIN validation must work offline against locally cached credentials. The hashing algorithm must balance security with validation speed on typical site hardware (low-end Windows PCs).

### Decision

Use **PBKDF2-SHA256 with 100,000 iterations** for PIN hashing. PINs are never transmitted over the network --- validation is always local against the cached `Users` table populated by Link.Service `UserSyncService`.

### Alternatives Considered

| Option | Pros | Cons |
|--------|------|------|
| **bcrypt** | Industry standard for passwords | Slower on low-end hardware, overkill for 4-digit PINs |
| **PBKDF2-SHA256** | Fast enough for PINs, built into .NET, configurable iterations | Less adaptive than bcrypt |
| **Argon2** | Memory-hard, most resistant to GPU attacks | Not built into .NET, external dependency |

### Consequences

- PIN validation completes in <500ms on target hardware
- 3-attempt lockout policy enforced locally (lockout duration TBD)
- Link.Service pulls revoked PIN list during sync to update local revocation cache
- Cache expiration window prevents stale credentials (duration TBD, recommend 24--48 hours)
- All PIN entries logged with timestamp, result, and sync status for audit trail

---

## ADR-004: gRPC for Client-to-Link.Service Communication
<!-- Jira: RCLIENT-10 | Epic: RCLIENT-1 | Synced: 2026-04-11 | Cross-ref: RLINK ADR-002 -->

| Field | Value |
|---|---|
| ADR ID | ADR-004 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

Local client apps need to communicate with Link.Service for hardware commands (start collection, dispense cash), real-time hardware events (denomination detected, item rejected), and sync operations. This decision is the client-side complement to RLINK ADR-002.

### Decision

Use **gRPC over LAN** with strongly typed `.proto` contracts. Link.Service hosts the gRPC server; client apps connect as gRPC clients. Bidirectional streaming is used for real-time hardware event delivery.

### Consequences

- Strongly typed contracts prevent client/service contract drift
- Bidirectional streaming enables real-time denomination updates during cash collection
- `.proto` files are the single source of truth for the client-service API --- defined in RCORE `ILinkClient` interface
- No direct hardware access from client apps --- all hardware communication proxied through Link.Service
- Client apps discover Link.Service via mDNS/broadcast on the LAN (see RLINK ADR-005)

---

## ADR-005: Shared Razor Class Library for UI Component Reuse
<!-- Jira: RCLIENT-53,RCLIENT-54,RCLIENT-55,RCLIENT-56,RCLIENT-57,RCLIENT-58,RCLIENT-59,RCLIENT-60,RCLIENT-61,RCLIENT-62 | Epic: RCLIENT-9 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-005 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

Both local apps (Tax Authority and Retail) share common UI patterns: PIN keypad, denomination breakdown, recycler status indicator, sync status display, and receipt printing. The Blazor WASM web portal also needs some of these components. Duplicating components across three projects creates maintenance burden and visual inconsistency.

### Decision

Extract shared UI components into `RecyclerIQ.UI.Shared`, a **Razor Class Library (RCL)** distributed as an internal NuGet package. Both local apps and the web portal consume the same component library.

### Component Inventory

| Component | Consumers |
|-----------|-----------|
| PINKeypad | Tax Authority, Retail |
| RecyclerStatusIndicator | Tax Authority, Retail, Portal |
| DenominationBreakdown | Tax Authority, Retail, Portal |
| CashInventoryGrid | Tax Authority, Retail, Portal |
| SyncStatusDisplay | Tax Authority, Retail |
| ReceiptPrinterComponent | Tax Authority, Retail |
| HardwareConnectivityIndicator | Tax Authority, Retail |
| TransactionAuditRow | Tax Authority, Retail, Portal |

### Consequences

- Single source for UI components --- fix once, deploy everywhere
- Semantic versioning on the NuGet package prevents breaking changes from propagating unexpectedly
- Brand consistency enforced via shared theming (Recycler.IQ palette: #0F084B primary, #A0D2E7 accent)
- UI.Shared lives in the `recycleriq-clients` repo as a project reference (not in `recycleriq-core`), per repository structure ADR
- Components must be platform-agnostic --- no MAUI-specific APIs in UI.Shared (those go in platform-specific projects)

---

## ADR-006: ClickOnce-Style Bootstrapper for App Distribution
<!-- Jira: RCLIENT-47,RCLIENT-48,RCLIENT-49,RCLIENT-50,RCLIENT-51 | Epic: RCLIENT-8 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-006 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

Local apps must be installed at recycler sites by field technicians or remote IT staff. The installer must handle device registration, config file creation, Link.Service installation, and initial user sync --- all in a single flow. Enterprise deployment tools (SCCM, Intune) are not available at most target sites.

### Decision

Use a **lightweight bootstrapper installer** (~10 MB .exe) downloaded from the web portal. The bootstrapper handles the full lifecycle: download MAUI app package, write `app.config.json`, register device with Cloud API, install Link.Service as a Windows service, and launch the app.

### Installation Flow

1. Download bootstrapper from web portal
2. Bootstrapper fetches device config from Cloud API
3. Downloads MAUI app package (~50--100 MB)
4. Writes `app.config.json` with device ID, site ID, API endpoint, hardware type
5. Registers device via `POST /devices/register` (returns activation token)
6. Installs and starts Link.Service as a Windows service
7. Launches the app

### Auto-Update Strategy (Phase 1)

- Bootstrapper itself is version-pinned --- requires re-download for updates
- MAUI app checks Cloud API on startup for new versions
- User-initiated update (not forced) with background download
- Two versions stored locally (current + previous) for rollback

### Consequences

- Single-step install for field technicians --- no manual config editing
- Device registration happens automatically during install --- no separate provisioning step
- `app.config.json` is the local source of truth for device identity and site assignment
- Auto-update mechanism is manual in Phase 1 --- forced updates deferred to Phase 2
- Windows 10 (Build 1809+) and Windows 11 targeted for desktop installs
- Android distribution via APK sideload or managed Google Play (enterprise) --- separate from Windows bootstrapper flow

---

## ADR-007: Single-Tenant-Per-Device Data Architecture
<!-- Jira: RCLIENT-12 | Epic: RCLIENT-2 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-007 |
| Status | Accepted |
| Date | April 11, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ --- Lewers Logic LLC |

### Context

The Cloud API uses a hybrid multi-tenancy model with `ITenantConnectionResolver` to route database contexts to the correct tenant. Local client apps are physically installed at a single site belonging to a single tenant. There is no scenario where a local app serves multiple tenants.

### Decision

Local SQLite databases use a **single-tenant-per-device model**. No tenant resolution logic is needed locally. The tenant context is established at install time via `app.config.json` and never changes without a full reinstall.

### Consequences

- Simpler local data layer --- no `ITenantConnectionResolver`, no tenant-scoped queries
- Same EF Core repository abstractions are reused, but with a single static SQLite connection
- If a device is reassigned to a different tenant, a full reinstall with new device registration is required
- One app instance per device enforces single-shift (Retail) and single-operator (Tax Authority) models
- No risk of cross-tenant data leakage at the local level

---

## Open Items

| Item | Priority | Status |
|------|----------|--------|
| Local data encryption (SQLCipher vs. DPAPI) | Critical | Undecided |
| PIN lockout duration and recovery mechanism | High | TBD |
| Offline PIN cache expiration window | High | TBD (recommend 24--48 hrs) |
| Auto-update forced vs. optional (Phase 2) | Medium | Deferred |
| Receipt template design and printer qualification | Medium | Deferred |
| Windows version compatibility testing | High | TBD |
| Android minimum SDK version and tablet form factor testing | Medium | TBD |
| Android distribution method (sideload APK vs. managed Google Play) | Medium | TBD |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-11 | Claude (generated from PRD) | Initial ADR set --- 7 decisions extracted from MAUI Blazor Hybrid PRD |
| 1.1 | 2026-04-12 | Claude | Platform scope update --- Windows + Android only, iOS/macOS deferred |
