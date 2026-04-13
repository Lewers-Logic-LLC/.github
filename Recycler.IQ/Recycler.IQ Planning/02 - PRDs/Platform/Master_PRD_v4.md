# Recycler.IQ — Master Product Requirements Document

**Version 4.0 | Executive Overview & Architecture Reference**
**Updated: April 2026**
**Company:** Lewers Logic LLC
**Status:** Draft
**Copyright:** © 2026 Lewers Logic LLC. All rights reserved.

> **Purpose:** This Master PRD is a concise executive overview of the entire Recycler.IQ product. It summarizes architecture, scope, and key decisions. For implementation detail, refer to the individual sub-PRDs listed in [Appendix A](#appendix-a-sub-prd-index).

---

## Part 1: Executive Summary & High-Level Goals

Recycler.IQ is a centralized, hardware-agnostic software platform designed to optimize retail cash operations. By integrating directly with cash recyclers, Recycler.IQ provides real-time visibility, reduces manual errors, and optimizes Cash-In-Transit (CIT) logistics through predictive analytics and intelligent cash recycling. It operates on a B2B SaaS model with offline-tolerant, per-device edge licensing.

### Success Metrics

- **CIT Reduction:** Significantly reduce the frequency of cash pickups and deliveries by recycling cash on-site.
- **Operational Resilience:** Ensure 100% uptime for cash operations via a Local-First hybrid architecture.
- **Revenue Protection:** Enforce subscription compliance securely across offline edge nodes using per-device tracking.
- **Engagement Tracking:** Monitor software usage and hardware interaction across Production, Sandbox, and Demo environments.

### Target Markets

| Market | Description |
|---|---|
| Retail | Brick-and-mortar retailers requiring cash recycling, CIT optimization, and cash management reporting. |
| Tax Authority | Municipal/county offices accepting cash property tax payments. Cash collection terminal only — no tax management system. |

### Go-to-Market Sequence

| Phase | Tenant Type | Rationale |
|---|---|---|
| First | Tax Authority | Active customer relationships; simpler workflow validates platform architecture. All shared infrastructure (Link.Service, UI.Shared, Hardware, sync, licensing) is built during this phase. |
| Second | Retail | Inherits shared infrastructure from Tax Authority launch. Adds shift-based workflows and CIT management. |

### Launch Scale

| Parameter | Detail |
|---|---|
| Launch Target | 10–50 store locations |
| Geography | United States at launch; Canada near-term expansion |
| Team Size | 3 developers (1 lead + 2 additional) |
| Billing Manager | Founder at launch |

---

## Part 2: Technical Architecture Decisions

### 2.1 Platform & Infrastructure

| Decision | Detail |
|---|---|
| Cloud Platform | Microsoft Azure |
| API Framework | .NET 10 (LTS — supported through November 2028) |
| Architecture Pattern | Clean Architecture |
| API Hosting | Azure App Service (Blue/Green deployment via slots) |
| Database | Azure SQL — hybrid multi-tenancy (schema-per-tenant shared DB + dedicated DB for enterprise) |
| Database Design | Master/Registry DB for tenant routing; shared DB with per-tenant schemas; dedicated DBs for enterprise tier |
| ORM | Entity Framework Core 10, code-first migrations |
| Async Messaging | Azure Service Bus (topics: orders, inventory, notifications) |
| Secrets Management | Azure Key Vault (Managed Identity access) |
| CQRS Pattern | MediatR |
| Authentication | Self-issued JWT bearer tokens (user identity + device license) |
| API Type | Internal only — no third-party consumers |
| IaC | Azure Bicep (recommended) |

> **Detail:** See [PRD_Infrastructure.md](PRD_Infrastructure.md) for full Azure resource architecture, CI/CD pipeline, and environment strategy.

### 2.2 Observability Stack

| Component | Detail |
|---|---|
| Logging API | Serilog |
| Telemetry Standard | OpenTelemetry (vendor-neutral) |
| Dev Environment | Seq (local, free) |
| Production Backend | Azure Application Insights (OTel exporter) |

All components — Cloud API, Link.Service, and Web Portal — emit telemetry consistently through the same OpenTelemetry pipeline.

### 2.3 Billing & Subscriptions

> **DECISION PENDING:** Billing platform still under evaluation.

| Platform | Status |
|---|---|
| QuickBooks Online (~$300–500/yr) | Under Consideration — handles invoicing, tracks payments, API available, doubles as accounting tool |
| Salesforce Pro Suite (~$1,200/yr) | Under Consideration — full CRM, invoice management, API for subscription status queries |
| Stripe | DROPPED — fee-based model, not suitable for invoice-only billing without card processing |

| Parameter | Detail |
|---|---|
| Payment Model | Invoice-based only — no card processing at launch |
| Payment Method | ACH bank transfer or check |
| Billing Manager | Tommy (Founder) at launch |
| Key API Requirement | Billing platform must support querying subscription/payment status via API for license activation |
| Revisit Trigger | 50+ customers, or if card payments are added |

The billing integration is abstracted behind `IBillingService` in the API. The platform choice does not block API development — swap the implementation without touching business logic.

### 2.4 License Activation Flow

```
New Customer Signs Up
  -> Invoice generated in billing platform
  -> Customer pays via ACH / check
  -> Payment marked received
  -> API queries IBillingService.IsSubscriptionActive(tenantId)
  -> API issues cryptographically signed JWT
  -> JWT tied to device serial number / MAC address
  -> Local Node validates JWT on startup
  -> Grace period enforced if internet drops
  -> Strict lockout if license expires
```

### 2.5 Integration Policy

| Integration | Status | Detail |
|---|---|---|
| External tax authority systems | Not at launch | Current tax authority customers do not allow integration into their tax management systems. Available as paid custom integration if a future customer requests it. |
| Point-of-Sale (POS) systems | Not at launch | Retail operations function independently of POS. Available as paid custom integration at an upcharge. |
| Third-party API consumers | Not at launch | API is internal only. |

---

## Part 3: Solution Structure

### 3.1 Repositories & Projects

Projects span multiple repositories. See the [Repository Structure ADR](../03%20-%20Architecture%20Decisions/repository-structure-decisions.md) for the full repo-to-project mapping.

```
recycleriq-core/ (NuGet packages — shared contracts)
├── RecyclerIQ.Domain                 # Entities, enums, domain events, ILinkClient
└── RecyclerIQ.Common                 # Shared utilities, constants, extensions, DTOs

recycleriq-cloud/
├── RecyclerIQ.API                    # ASP.NET Core 10 Web API (entry point)
├── RecyclerIQ.Application            # MediatR handlers, business logic, DTOs
├── RecyclerIQ.Infrastructure         # EF Core, repositories, external services
└── RecyclerIQ.Web.Portal             # Blazor WebAssembly (cloud analytics)

recycleriq-clients/
├── RecyclerIQ.UI.Shared              # Shared Razor component library (project reference)
├── RecyclerIQ.UI.TaxAuthority        # MAUI Blazor Hybrid (Tax Authority)
├── RecyclerIQ.UI.RetailClient        # MAUI Blazor Hybrid (Retail)
└── RecyclerIQ.UI.WebClient           # Blazor Server (browser-accessible — cloud demos, future web access)

recycleriq-link/
├── RecyclerIQ.Hardware               # IRecycler interface, manufacturer implementations (project reference)
└── RecyclerIQ.Link.Service           # .NET 10 Worker Service (site-level agent)

recycleriq-simulator/
└── RecyclerIQ.Simulator              # Blazor Server — standalone hardware simulator
```

> **Note on UI.WebClient:** This is a thin Blazor Server wrapper that hosts the same `RecyclerIQ.UI.Shared` Razor components server-side over SignalR. It provides browser-accessible access to the client UI without requiring a native install — used for cloud demos, remote dealer access, and potential future web-only customers. It is *not* a duplicate of the MAUI apps; it reuses the same shared component library.

### 3.2 Dependency Flow

```
API  -->  Application  -->  Domain
Infrastructure  -->  Application  -->  Domain

Domain has ZERO external dependencies.
Infrastructure implements interfaces defined in Domain.
```

### 3.3 NuGet vs Project Reference Strategy

| Project | Distribution | Rationale |
|---|---|---|
| RecyclerIQ.Domain | NuGet (internal feed) | Cross-repo contract — consumed by cloud, link, and clients |
| RecyclerIQ.Common | NuGet (internal feed) | Shared utilities across all repos |
| RecyclerIQ.UI.Shared | Project reference | Single consumer repo (recycleriq-clients) |
| RecyclerIQ.Hardware | Project reference | Single consumer repo (recycleriq-link) |

### 3.4 Device Mapping

| Parameter | Detail |
|---|---|
| Mapping | One Link.Service per site, manages all recyclers |
| Multi-recycler sites | Each site gets one Link.Service installation managing multiple recyclers |
| Configuration | Recycler-specific config delivered at install time from Cloud API |
| License | Each recycler has its own hardware-bound JWT tied to device serial/MAC |
| Multi-instance support | Architecture supports multiple Link.Service instances per site as a future scaling option (5–10 recyclers per instance recommended) |

---

## Part 4: Communication Protocols

### 4.1 Client ↔ Link.Service (Local)

| Aspect | Detail |
|---|---|
| Protocol | gRPC over LAN (HTTP/2) |
| Contracts | Strongly typed .proto definitions |
| Patterns | Request/response for commands; server streaming for real-time hardware events (bill inserted, collection progress, recycler status changes, queue position) |
| Rationale | Bidirectional streaming, low latency, strongly typed — superior to REST for real-time hardware event delivery |
| Discovery | Auto-discovery via mDNS/broadcast; clients find Link.Service instances on local network |

> **Detail:** See [Local_Architecture_PRD_v1.md](Local_Architecture_PRD_v1.md) §4 and [PRD_LinkService.md](PRD_LinkService.md) §9.

### 4.2 Link.Service ↔ Cloud API (Remote)

| Aspect | Detail |
|---|---|
| Sync (data push/pull) | REST over HTTPS |
| Real-time config push | SignalR (WebSocket) — Cloud API pushes config change notifications when admin updates settings in Web Portal |
| Fallback | Link.Service polls for config updates on 24h interval in case SignalR notification is missed |
| Auth | Per-instance API key (tenant + site scoped, independently rotatable) |

### 4.3 Authentication Layers

| Component | Auth Mechanism | Purpose |
|---|---|---|
| Recycler hardware | Hardware-bound JWT (per device) | License enforcement. Tied to device serial/MAC. |
| Link.Service instance | API key (per service instance) | Service-to-Cloud API authentication. Tenant + site scoped. |
| UI client users | JWT (user identity) | Authenticates the operator. |

> **Detail:** See [Local_Architecture_PRD_v1.md](Local_Architecture_PRD_v1.md) §5.

---

## Part 5: Application Specifications

### 5.1 Cloud API

| Property | Detail |
|---|---|
| Type | ASP.NET Core 10 Web API |
| Framework | .NET 10 LTS |
| Purpose | Central nervous system — all components communicate through this |
| Consumers | Web Portal, Link.Service, Tax Authority UI |
| External | No third-party API consumers |

**Core Capabilities:** Edge synchronization engine, authentication & multi-tenancy (schema-per-tenant + dedicated DB), master data management, reporting engine, device registry & configuration, tax authority support, ML/forecasting engine, license issuance via `IBillingService`, installer distribution, OpenTelemetry ingestion, immutable audit log.

**Sync Endpoints:**

| Endpoint | Direction | Purpose |
|---|---|---|
| /api/v1/sync/transactions | Local → Cloud | Receives transaction batches from devices |
| /api/v1/sync/inventory | Local → Cloud | Receives inventory snapshots (delta or heartbeat) |
| /api/v1/sync/heartbeat | Local → Cloud | Receives health pings from edge nodes |
| /api/v1/sync/users/{storeId} | Cloud → Local | Serves user cache for site (offline PIN validation) |
| /api/v1/devices/{deviceId}/config | Cloud → Local | Serves recycler-specific configuration |
| /api/v1/license/validate | Cloud → Local | Validates device JWT |

> **Detail:** See [PRD_CloudAPI.md](PRD_CloudAPI.md) for full endpoint specs, request/response schemas, and multi-tenancy implementation.

### 5.2 Web Portal

| Property | Detail |
|---|---|
| Type | Single Page Application |
| Framework | Blazor WebAssembly (.NET 10) |
| Hosting | Azure Static Web Apps or Blob Storage + CDN |
| Users | CFOs, CIT Coordinators, Regional Managers, Tenant Admins, SystemAdmins |
| Tenant Routing | Subdomain-per-tenant (`{tenantname}.recycleriq.com`) with TenantType-aware UI |
| Auth | SSO/OAuth/Custom login paths; JWT with TenantId + TenantType claims |
| Real-time | SignalR hub subscriptions for CIT status and device alerts (future phase) |

**UI Strategy:** Single Blazor WASM app with tenant-type-aware routing. ~70% of admin functionality is shared; tenant-specific pages (CIT dashboard for retail, collection volumes for tax authority) are conditionally rendered based on TenantType claim. SystemAdmin users can switch between tenants.

> **Detail:** See [PRD_BlazorPortal.md](PRD_BlazorPortal.md) for routing structure, page specs, and state management.

### 5.3 Local Node — Tax Authority (UI.TaxAuthority)

| Property | Detail |
|---|---|
| Type | MAUI Blazor Hybrid (.NET 10) |
| Deployment | Windows .exe via bootstrapper installer |
| Session Model | Transaction-based (no shifts) — each cash collection is independent |
| Pages | Login (4-digit PIN), Collector (real-time bill collection), Inventory, Daily Summary |
| Hardware | Kisan KR10 cash recycler (first manufacturer) via Link.Service |
| Offline | Up to 8 hours; PIN validated against locally cached user list |

> **Detail:** See [PRD_MAUIBlazorHybrid.md](PRD_MAUIBlazorHybrid.md) §3.

### 5.4 Local Node — Retail (UI.RetailClient)

| Property | Detail |
|---|---|
| Type | MAUI Blazor Hybrid (.NET 10) |
| Deployment | Windows .exe via bootstrapper installer; Android APK/AAB |
| Target Platforms | Windows (primary) and Android (cost-effective tablet terminal) |
| Session Model | Shift-based — open shift, perform operations, close with reconciliation |
| Operations | Deposits, Withdrawals, Transfers (CIT), Inventory, Shift Close |
| Receipt | Printed for every operation |
| Deferred | iOS and macOS Catalyst — WebClient covers browser-based access |

> **Detail:** See [PRD_MAUIBlazorHybrid.md](PRD_MAUIBlazorHybrid.md) §4.

### 5.5 Shared UI Component Library (UI.Shared)

| Property | Detail |
|---|---|
| Type | Razor Class Library (.NET 10) |
| Consumed By | UI.TaxAuthority, UI.RetailClient, UI.WebClient, optionally Web.Portal |
| Distribution | Project reference within recycleriq-clients repo |

**Components:** Recycler status indicator, denomination breakdown display, cash inventory grid, receipt printer integration, PIN login keypad, hardware connectivity indicator, sync status display, transaction audit row template.

> **Detail:** See [PRD_MAUIBlazorHybrid.md](PRD_MAUIBlazorHybrid.md) §5 and [PRD_SharedLibraries.md](PRD_SharedLibraries.md).

### 5.6 Hardware Abstraction Layer

| Property | Detail |
|---|---|
| Type | Class Library |
| Project | RecyclerIQ.Hardware |
| Consumed By | RecyclerIQ.Link.Service |
| Pattern | IRecycler interface with manufacturer-specific implementations + factory |

**IRecycler Interface (Validated by POC):** `ConnectAsync`, `DisconnectAsync`, `GetInventoryAsync`, `StartDepositAsync`, `EndDepositAsync`, `WithdrawAsync`, `InsertBillAsync`, `RunDiagnosticsAsync`, plus `BillInserted` event.

| Implementation | Status | Detail |
|---|---|---|
| SimulatorRecyclerClient | Complete | HTTP client that calls the standalone Simulator's REST API. Implements both `IRecycler` and `ISimulatorControl`. Runs inside Link.Service; clients interact with it only via `ILinkClient` IPC. |
| KisanRecycler | Partially complete (from POC) | Kisan KR10 integration via KR.Server.dll SDK. Production mapping has placeholders that must be completed. |
| Future manufacturers | Not started | IRecycler interface designed for extensibility. |

> **Detail:** See [PRD_LinkService.md](PRD_LinkService.md) §3 and [PRD_Simulator.md](PRD_Simulator.md).

### 5.7 Link.Service (Site-Level Background Agent)

| Property | Detail |
|---|---|
| Type | .NET 10 Worker Service |
| Deployment | One instance per site, manages all recyclers. Cross-platform daemon (Windows service, Linux systemd, or Docker) with auto-restart. |
| Local Comms | gRPC server for UI client commands + hardware event streaming |
| Cloud Comms | REST for sync push/pull + SignalR client for real-time config push from Cloud API |
| Auth to Cloud | Per-instance API key (tenant + site scoped) |
| Required | Link.Service must be running for local clients to operate — it is not optional |

**Hosted Services:**

| Service | Purpose |
|---|---|
| SyncWorker | Pushes pending transactions and inventory snapshots to Cloud API (interval + on-demand) |
| UserSyncService | Pulls user data from Cloud API for offline PIN validation |
| SyncSignalService | Semaphore-based immediate sync trigger from UI |
| SyncStatusService | Tracks sync state, circuit breaker with exponential backoff |
| LicenseValidator | Validates hardware-bound JWT on startup and periodically; enforces grace period |
| HeartbeatService | Periodic health ping to Cloud API |
| CloudSignalRClient | Receives real-time config push notifications from Cloud API |

> **Detail:** See [PRD_LinkService.md](PRD_LinkService.md) for full service specs, HAL, and multi-recycler tracking.

### 5.8 Recycler Failover

Each client may be configured with a primary recycler and an optional fallback recycler. Link.Service maintains a queue of pending operations per recycler and serializes all access. Clients receive real-time queue position updates via gRPC streaming.

| Scenario | Behavior |
|---|---|
| Primary Busy | Wait up to configurable timeout, then auto-fallback (if enabled) or prompt operator |
| Primary Offline/Error | Fall back immediately |
| Both unavailable | Fail operation, display error |

Every transaction records which recycler was actually used and the failover reason (if any).

> **Detail:** See [Local_Architecture_PRD_v1.md](Local_Architecture_PRD_v1.md) §6–7.

### 5.9 Simulator

| Property | Detail |
|---|---|
| Type | Blazor Server — standalone process in its own repository |
| Purpose | General-purpose Kisan KR10 emulator for dev, QA, trade shows, and cloud demos |
| Communication | REST API endpoints; Link.Service calls it via `SimulatorRecyclerClient` (HTTP) |
| Headless Mode | `--headless` flag starts REST API only (no Blazor UI) for cloud/automated scenarios |
| Positioning | Potentially licensable as standalone product for third-party integrators |
| Independence | Not locked to demo mode — any `Device` with `IsSimulator = true` gets simulator behavior in any environment |

The simulator control panel (`SimulatorControlPanel.razor`) lives in UI.Shared and is visible whenever the connected device reports `ISimulatorControl.IsAvailable = true`, regardless of demo or production mode.

> **Detail:** See [PRD_Simulator.md](PRD_Simulator.md) for REST API, state machine, and hardware ID configuration.

### 5.10 Demo System

The demo system reuses the production codebase with a runtime `IsDemoMode` config flag that swaps specific implementations:

| Concern | Demo Mode | Production Mode |
|---|---|---|
| Identity | `LocalIdentityProvider` (SQLite only) | `ResilientIdentityProvider` (cloud + local fallback) |
| Sync | `NoOpSyncService` | `CloudSyncService` |
| License | `DemoLicenseValidator` (stub) | `HardwareBoundLicenseValidator` |
| Database | Pre-seeded demo SQLite | Cloud-synced SQLite + Azure SQL |

**Deployment modes:**

- **Local Demo (Trade Show):** MAUI client on Windows laptop, real Kisan KR10 hardware (or simulator fallback), pre-seeded SQLite.
- **Cloud Demo (Post-Show):** `RecyclerIQ.UI.WebClient` (Blazor Server) hosts the same UI.Shared components in a browser over SignalR. Headless simulator + Link.Service as companion services. Per-prospect isolated SQLite databases.

**Self-serve demo provisioning:** Marketing website form triggers backend to seed new demo tenant, generate unique simulator hardware ID, and email credentials + demo URL to prospect.

> **Detail:** See [RecyclerIQ_TaxAuthority_Demo_PRD.md](RecyclerIQ_TaxAuthority_Demo_PRD.md) and [RecyclerIQ_TaxAuthority_Demo_TechSpec.md](RecyclerIQ_TaxAuthority_Demo_TechSpec.md).

### 5.11 Installer & Client Distribution

**Strategy: ClickOnce-Style Smart Installer**

1. Web Portal provides download link (per-recycler or unified)
2. Lightweight bootstrapper (.exe, ~10 MB) downloaded
3. Bootstrapper prompts operator to select recycler (or auto-detects)
4. Pulls recycler-specific config from Cloud API
5. Downloads full MAUI Blazor Hybrid client package
6. Writes local configuration (app.config.json)
7. Registers device with Cloud API (serial/MAC for license binding)
8. Starts Link.Service as platform daemon (Windows service, systemd unit, or Docker container)
9. On subsequent launches, validates license JWT and checks for updates

> **Detail:** See [PRD_MAUIBlazorHybrid.md](PRD_MAUIBlazorHybrid.md) §7.

---

## Part 6: Tenant Model

### 6.1 Tenant Types

| Rule | Detail |
|---|---|
| Types | Retail \| TaxAuthority (enum) |
| Mutually Exclusive | A tenant cannot be both Retail and TaxAuthority |
| DB Approach | Hybrid — standard tenants share a DB with per-tenant schemas; enterprise tenants get dedicated DBs |
| Extension Tables | Shared core tables + type-specific profile tables (RetailProfile, TaxAuthorityProfile) |

### 6.2 Schema Design

Core tables (Tenants, Transactions, Devices, Users) are shared across tenant types. `TransactionType` enum differentiates behavior. `TenantType` middleware prevents cross-type endpoint access.

**TransactionType Enum:** Deposit, Withdrawal, Transfer, ShiftOpen, ShiftClose (Retail only), TaxCollection (Tax Authority only).

> Sale was removed — no POS integration at launch. Available as paid custom integration if requested.

> **Detail:** See [PRD_CloudAPI.md](PRD_CloudAPI.md) §4 and [PRD_Infrastructure.md](PRD_Infrastructure.md) §6 for multi-tenancy implementation.

---

## Part 7: Roles & Permissions

### 7.1 Role Hierarchy

| Level | Roles |
|---|---|
| System Level | SystemAdmin — full platform access, all tenants, billing, infrastructure. Can switch between tenants. |
| Tenant Level | TenantAdmin, RegionalManager, StoreManager, CITCoordinator, Operator |

### 7.2 Implementation Approach

| Decision | Detail |
|---|---|
| v1 Approach | Fixed roles with permission bitmask on entity |
| Rationale | Covers 80% of customers. Fast to build. Avoids permission engine complexity at launch. |
| Future | Custom tenant-defined permission groups post-MVP if customer demand requires it |

---

## Part 8: Data Flow & Synchronization

### 8.1 Sync Architecture

```
+-----------------------------------------------------------+
|  CLOUD (Azure)                                            |
|                                                           |
|  Cloud API (App Service)                                  |
|  +-- Receives: transactions, inventory, heartbeats        |
|  +-- Serves:   users, config, license validation          |
|  +-- Pushes:   config changes via SignalR                 |
|  +-- Stores:   Azure SQL (hybrid multi-tenant)            |
|                                                           |
|  Web Portal (Blazor WASM)                                 |
|  +-- All admin + reporting UI -> calls Cloud API          |
+----------------------------+------------------------------+
                             |  HTTPS (REST + SignalR)
+----------------------------+------------------------------+
|  LOCAL (On-Site, per site)                                |
|                                                           |
|  Link.Service                                             |
|  -> pushes transactions/inventory UP (REST)               |
|  -> pulls users/config DOWN (REST)                        |
|  -> receives config push via SignalR                      |
|  -> exposes gRPC API for local UI clients                 |
|  -> manages all recyclers at site                         |
|                                                           |
|  Local UI (Tax Authority or Retail)                       |
|  -> communicates with Link.Service via gRPC               |
|  Local SQLite (offline queue + cached config + users)     |
+-----------------------------------------------------------+
```

### 8.2 Sync Rules

| Data | Direction | Detail |
|---|---|---|
| Transactions | Local → Cloud | Created locally with SyncStatus=Pending. Pushed to Cloud API. Marked Synced on confirmation. |
| Inventory Snapshots | Local → Cloud | Pushed on delta or heartbeat interval. |
| Users | Cloud → Local | Authoritative in Cloud API. Pulled to local cache filtered by site. |
| Recycler Config | Cloud → Local | Delivered at install time. Refreshable via SignalR push or periodic fallback poll (24h). |
| Heartbeat | Local → Cloud | Periodic health ping with device status, uptime, connectivity. |
| Config Changes | Cloud → Local | Real-time push via SignalR when admin updates settings in Web Portal. |

### 8.3 Offline Resilience

All local operations work without internet connectivity. Local SQLite is the source of truth until sync completes. Link.Service must be running and reachable on the LAN — it is a required dependency. When cloud connectivity is restored, pending transactions and snapshots are pushed automatically.

### 8.4 Reporting Strategy

| Level | Location | Detail |
|---|---|---|
| Detailed reports | Web Portal only | Served by Cloud API from master database. |
| Daily summary | Local client | Lightweight view of today's activity. |

---

## Part 9: Domain Model

### 9.1 Confirmed Entities

Tenant, RetailProfile, TaxAuthorityProfile, Region, Store, Device, Transaction, License, User, UserRole, CashDenomination, DenominationSnapshot, CITEvent, AuditLog, BillingRecord, Alert.

> **Detail:** See [PRD_SharedLibraries.md](PRD_SharedLibraries.md) §2 for full entity definitions, enums, value objects, domain events, and aggregate boundaries.

### 9.2 Still Being Defined

| Entity / Area | Blocker |
|---|---|
| User Groups / Permission detail | Permission matrix still being finalized |
| ML model inputs/outputs | ML approach not yet decided (ML.NET vs Python microservice) |

---

## Part 10: Open Items & Decisions Pending

| Item | Status | Blocking |
|---|---|---|
| Billing platform selection | EVALUATING — QuickBooks vs Salesforce | License activation implementation |
| Permission matrix detail | IN PROGRESS | User/Role entity finalization |
| ML approach | NOT DECIDED — ML.NET vs Python microservice | Forecasting engine design |
| SOC 2 compliance | DEFERRED — post-MVP | None currently |
| Recycler manufacturers in scope | NOT DEFINED — Kisan KR10 confirmed as first | Hardware Integration Layer |
| Grace period duration | NOT DEFINED | License enforcement logic |
| Sync conflict resolution strategy | NOT DEFINED — recommend server-authoritative | Edge Sync Engine |
| gRPC .proto contract design | NOT STARTED | Client ↔ Link.Service integration |
| Auto-discovery mechanism | NOT STARTED — mDNS vs broadcast | Multi-Link.Service support |
| Cloud host for demo (WebClient) | EVALUATING | Cloud demo deployment |
| Website form platform (demo provisioning) | NOT STARTED | Self-serve demo |
| Email provider (demo provisioning) | NOT DECIDED | Self-serve demo |
| Receipt template designs | NOT STARTED | Phase 1 receipt printing |
| Local data encryption strategy | NOT DECIDED — SQLCipher vs DPAPI | SQLite security |
| Auto-update mechanism | NOT DEFINED | Client distribution |

---

## Part 11: Decisions & Alternatives Evaluated

### 11.1 Dropped Decisions

| Item | Reason Dropped |
|---|---|
| React / Angular (Web Portal) | Replaced with Blazor WebAssembly for .NET stack consistency and shared component reuse. |
| Stripe | Fee-based model incompatible with invoice-only billing. No card processing at launch. |
| Separate database per tenant type | Hybrid multi-tenancy (schema-per-tenant shared + dedicated enterprise) provides both cost efficiency and isolation options. |
| Complex permission engine (v1) | Fixed roles with bitmask chosen for speed. Custom groups deferred post-MVP. |
| Sale TransactionType (v1) | Removed from launch. No POS integration at launch. |
| Two separate Web Portals | Single Blazor WASM app with tenant-type-aware routing. ~70% shared admin UI. |
| Multi-unit local app | One Link.Service per site managing all recyclers. Simplifies deployment. |
| External tax system integration (v1) | Current customers do not allow integration. Deferred as paid custom option. |
| POS integration (v1) | Retail operations function independently. Deferred as paid custom option. |
| Named pipes for client ↔ Link.Service | Link.Service and clients may be on different machines; LAN-based gRPC chosen instead. |
| In-memory simulator (within Link.Service) | Simulator runs as a separate process with REST API — supports independent release cycle, cloud deployments, and potential third-party licensing. |

### 11.2 Technology Summary

| Concern | Decision |
|---|---|
| Cloud | Azure |
| Runtime | .NET 10 LTS |
| API | ASP.NET Core 10, Clean Architecture, MediatR CQRS |
| Authentication | Self-issued JWT (user + device) + per-instance API keys |
| Database | Azure SQL, hybrid multi-tenancy, EF Core 10 code-first |
| Messaging | Azure Service Bus |
| Logging | Serilog + OpenTelemetry (Seq for dev, App Insights for prod) |
| Billing | PENDING — QuickBooks or Salesforce (invoice-based only) |
| Local / Tax UI | MAUI Blazor Hybrid (.NET 10), deploys as .exe |
| Web Portal | Blazor WebAssembly (.NET 10), subdomain-per-tenant routing |
| Cloud Demo UI | Blazor Server (UI.WebClient), hosts UI.Shared components over SignalR |
| Shared UI | Razor Class Library (UI.Shared) |
| Background Service | .NET 10 Worker Service |
| Local IPC | gRPC (bidirectional streaming over HTTP/2) |
| Cloud Push | SignalR (WebSocket) for real-time config notifications |
| Tenant Model | Hybrid — schema-per-tenant (shared) + dedicated DB (enterprise) |
| Roles | Fixed roles v1, permission bitmask |
| Secrets | Azure Key Vault (Managed Identity) |
| Hardware | IRecycler abstraction, Kisan KR10 first manufacturer |
| Simulator | Standalone Blazor Server process, REST API, potentially licensable |
| Installer | ClickOnce-style bootstrapper with config pull from Cloud API |
| Device Mapping | One Link.Service per site — manages all recyclers at location |
| IaC | Azure Bicep (recommended) |
| CI/CD | GitHub Actions, Blue/Green deployment via App Service slots |
| Go-to-Market | Tax Authority first, Retail second |

---

## Part 12: Sprint 1 Status (Mar 29 – Apr 19, 2026)

**As of April 12, 2026**

| Metric | Count |
|--------|-------|
| **Done** | 66 ✅ |
| **In Progress** | 0 |
| **Ready (Backlog)** | 97 |
| **Pending Dev Review** | 2 |
| **Blocked** | 1 — RLINK-3 "Sync & Background Services" |
| **Total Jira Issues** | 100 (across RCORE, RCLIENT, RCLOUD, RLINK, RIQSIM, LM) |

### Jira Sync Status

- **PRD requirement sections with `Jira: NONE`:** 0
- **All PRD files fully synced to Jira:** ✅ Recycler.IQ Platform, RCORE, RCLIENT, RCLOUD, RLINK, RIQSIM, Legal Mind
- **Master_PRD_v4 drift check:** In sync with all sub-PRDs referenced in Appendix A ✅

### Blocked Items

| Item | Status | Notes |
|------|--------|-------|
| RLINK-3 | Blocked | Sync & Background Services — requires decision/unblocking |

### Next Steps

- Unblock RLINK-3 to resume sprint velocity
- Continue backlog refinement for remaining 97 ready items
- Monitor PRD sections for any new sync requirements

---

## Appendix A: Sub-PRD Index

| Document | Jira Project(s) | Scope |
|---|---|---|
| [PRD_SharedLibraries.md](PRD_SharedLibraries.md) | RCORE | Domain model, value objects, events, shared contracts |
| [PRD_LinkService.md](PRD_LinkService.md) | RLINK | Link.Service architecture, HAL, background services, multi-recycler |
| [PRD_MAUIBlazorHybrid.md](PRD_MAUIBlazorHybrid.md) | RCLIENT | Tax Authority & Retail MAUI apps, UI.Shared, offline architecture, installer |
| [PRD_BlazorPortal.md](PRD_BlazorPortal.md) | RCLOUD | Web Portal routing, pages, state management |
| [PRD_CloudAPI.md](PRD_CloudAPI.md) | RCLOUD | API endpoints, multi-tenancy, CQRS, sync engine |
| [PRD_Infrastructure.md](PRD_Infrastructure.md) | RCLOUD | Azure resources, CI/CD, environments, IaC, database management |
| [PRD_Simulator.md](PRD_Simulator.md) | RIQSIM | Simulator REST API, state machine, headless mode, hardware ID |
| [RecyclerIQ_TaxAuthority_Demo_PRD.md](RecyclerIQ_TaxAuthority_Demo_PRD.md) | RCLIENT | Demo system scope, deployment modes, IP protection |
| [RecyclerIQ_TaxAuthority_Demo_TechSpec.md](RecyclerIQ_TaxAuthority_Demo_TechSpec.md) | RCLIENT | Demo mode DI wiring, seeding, reset, provisioning, auth |
| [Local_Architecture_PRD_v1.md](Local_Architecture_PRD_v1.md) | — | gRPC comms, multi-instance Link.Service, failover, config sync |

---

## Document Control

| Field | Value |
|---|---|
| **Created** | March 2026 (v1.0) |
| **v4.0 Updated** | April 2026 |
| **Owner** | Tommy Lewers, Lewers Logic LLC |
| **Status** | Draft |
| **Supersedes** | Master_PRD_v3.md |
| **Audience** | Development Team, Investors, Partners |
