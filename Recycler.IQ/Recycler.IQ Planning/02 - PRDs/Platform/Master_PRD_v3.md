# Recycler.IQ — Master Product Requirements Document

**Version 3.0 | Architecture & Technical Decisions**
**Updated: March 2026**
**Company:** Lewers Logic LLC
**Status:** Final
**Copyright:** © 2026 Lewers Logic LLC. All rights reserved.

---

## Part 1: Executive Summary & High-Level Goals

Recycler.IQ is a centralized, hardware-agnostic software platform designed to optimize retail cash operations. By integrating directly with cash recyclers, Recycler.IQ provides real-time visibility, reduces manual errors, and optimizes Cash-In-Transit (CIT) logistics through predictive analytics and intelligent cash recycling. It operates on a B2B SaaS model with offline-tolerant, per-device edge licensing.

### Success Metrics

- **CIT Reduction:** Significantly reduce the frequency of cash pickups and deliveries by recycling cash on-site.
- **Operational Resilience:** Ensure 100% uptime for cash operations via a Local-First hybrid architecture.
- **Revenue Protection:** Enforce subscription compliance securely across offline edge nodes using Per-Device tracking.
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
| Launch Target | 10 - 50 store locations |
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
| API Hosting | Azure App Service |
| Database | Azure SQL |
| Database Design | Schema-per-tenant isolation |
| ORM | Entity Framework Core 10, code-first migrations |
| Async Messaging | Azure Service Bus |
| Secrets Management | Azure Key Vault |
| CQRS Pattern | MediatR |
| Authentication | Self-issued JWT bearer tokens |
| API Type | Internal only — no third-party consumers |

### 2.2 Observability Stack

| Component | Detail |
|---|---|
| Logging API | Serilog |
| Telemetry Standard | OpenTelemetry (vendor-neutral) |
| Dev Environment | Seq (local, free) |
| Production Backend | TBD — vendor-neutral, no lock-in |

All components — Cloud API, Local Node, and Web Portal — emit telemetry consistently through the same OpenTelemetry pipeline.

Rationale: OTel is the industry standard. Code never changes if backend changes. Azure Monitor can consume OTel natively if needed.

### 2.3 Billing & Subscriptions

> **DECISION PENDING:** Billing platform still under evaluation. See options below.

| Platform | Status |
|---|---|
| QuickBooks Online (~$300-500/yr) | Under Consideration — handles invoicing, tracks payments, API available, doubles as accounting tool |
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

### 3.1 Projects

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
└── RecyclerIQ.Link.Service           # .NET 10 Worker Service (site-level agent: hardware + offline + sync)

recycleriq-simulator/
└── RecyclerIQ.Simulator              # Blazor Server — standalone hardware simulator
```

### 3.2 Dependency Flow

```
API  -->  Application  -->  Domain
Infrastructure  -->  Application  -->  Domain

Domain has ZERO external dependencies.
Infrastructure implements interfaces defined in Domain.
```

This one-direction dependency rule keeps the codebase maintainable as it grows and makes unit testing straightforward.

### 3.3 Device Mapping

| Parameter | Detail |
|---|---|
| Mapping | One Link.Service per site, manages all recyclers |
| Multi-recycler sites | Each site gets one Link.Service installation managing multiple recyclers |
| Configuration | Recycler-specific config delivered at install time from Cloud API |
| License | Each instance has its own hardware-bound JWT tied to device serial/MAC |

Each site runs a single Link.Service instance that manages all recyclers at that location. Local UI apps connect to Link.Service to interact with hardware. Each recycler still has its own license and configuration, but the background service is shared per site.

---

## Part 4: Application Specifications

### 4.1 Cloud API

| Property | Detail |
|---|---|
| Type | ASP.NET Core 10 Web API |
| Framework | .NET 10 LTS |
| Purpose | Central nervous system — all components communicate through this |
| Consumers | Web Portal, Link.Service, Tax Authority UI |
| External | No third-party API consumers |

**Core Features:**

- **Edge Synchronization Engine:** Receives transaction batches and inventory snapshots pushed from Local Nodes. Serves user and config data pulled by Local Nodes. Online/offline heartbeat tracking.
- **Authentication & Multi-Tenancy:** Strict schema-per-tenant data segregation by TenantType, Region, and Store. Environment tagging (Production / Sandbox / Demo).
- **Master Data Management:** Authoritative source for all tenants, users, sites, devices, and recycler configurations.
- **Reporting Engine:** All detailed reporting served from the Cloud API. Web Portal consumes these endpoints.
- **Device Registry & Configuration:** Maintains recycler configurations per device. Serves config at install time and via periodic sync.
- **Tax Authority Support:** APIs supporting municipal/county cash collection workflows.
- **Machine Learning & Forecasting Engine:** Time-series models for cash depletion/overflow prediction per denomination. CIT Optimization Alerts.
- **License Issuance:** Validates billing status via IBillingService, then generates cryptographically signed JWTs bound to hardware serial/MAC.
- **Installer Distribution:** Serves local client bootstrapper with recycler-specific configuration packaging.
- **Telemetry Ingestion:** Collects events from UI and Edge nodes via OpenTelemetry pipeline.
- **Audit Log:** Immutable log of all transactions and actions across all tenants.

**Sync Endpoints:**

| Endpoint | Direction | Purpose |
|---|---|---|
| /api/sync/transactions | Local -> Cloud | Receives transaction batches from terminals |
| /api/sync/inventory | Local -> Cloud | Receives inventory snapshots (delta or heartbeat interval) |
| /api/sync/heartbeat | Local -> Cloud | Receives health pings from edge nodes |
| /api/sync/users/{siteId} | Cloud -> Local | Serves user cache for a specific site (offline PIN validation) |
| /api/devices/config/{deviceId} | Cloud -> Local | Serves recycler-specific configuration |
| /api/license/validate | Cloud -> Local | Validates device JWT |

### 4.2 Web Portal

| Property | Detail |
|---|---|
| Type | Single Page Application |
| Framework | Blazor WebAssembly (.NET 10) |
| Users | CFOs, CIT Coordinators, Regional Managers, Tenant Admins, SystemAdmins |
| Note | Replaces React/Angular — Blazor chosen for .NET stack consistency |

**UI Strategy: Single App, Tenant-Type-Aware Routing**

The Web Portal is a single Blazor WASM application that adapts its UI based on the authenticated user's TenantType claim. This avoids duplicating the ~70% of shared admin functionality across two separate portals.

| Web Portal Area | Shared | Retail-Specific | Tax Authority-Specific |
|---|---|---|---|
| Login / Auth | Shared | — | — |
| User Management | Shared | — | — |
| Site / Location CRUD | Shared | — | — |
| Device Registry | Shared | — | — |
| Installer Page | Shared | — | — |
| Maintenance / Admin Tools | Shared | — | — |
| License Management | Shared | — | — |
| Billing Management | Shared | — | — |
| Dashboard Widgets | Base layout shared | CIT status, cash forecast, deposit/withdrawal trends | Collection volumes, operator throughput |
| Config Options | Base config shared | CIT provider, forecasting toggle, shift rules | Municipality code, tax year config |
| Reports | Base report framework shared | CIT reports, shift reconciliation, cash flow by store | Collection reports, operator activity, daily reconciliation |
| CIT / Forecasting | — | Full CIT dashboard, ML predictions | Not applicable |

SystemAdmin users can switch between tenants of either type. Tenant-level admins see only their own tenant.

### 4.3 Local Node — Retail

| Property | Detail |
|---|---|
| Type | MAUI Blazor Hybrid (.NET 10) |
| Deployment | Packages as Windows .exe via bootstrapper installer |
| Future | Android/iOS via MAUI for mobile recycler control |
| Paired With | RecyclerIQ.Link.Service (site-level background agent for hardware comms, sync, and license validation) |
| Device Mapping | One Link.Service per site — manages all recyclers at location |

**Session Model: Shift-Based**

The retail local app operates on a shift model. Operators open a shift, perform cash operations, and close the shift with reconciliation. Receipts are printed for every operation.

| Operation | Description | Receipt |
|---|---|---|
| Open Shift | Initialize terminal session, record starting inventory | Yes — shift start receipt |
| Close Shift | Reconcile and end session, record ending inventory and variance | Yes — shift reconciliation receipt |
| Deposits | Load cash into the recycler (inbound cash) | Yes |
| Withdrawals | Pull cash from the recycler (outbound cash) | Yes |
| Transfers | Manage CIT pickups and deliveries | Yes |
| Inventory | View real-time detailed cash breakdown by denomination | N/A (view only) |

### 4.4 Local Node — Tax Authority

| Property | Detail |
|---|---|
| Type | MAUI Blazor Hybrid (.NET 10) |
| Deployment | Packages as Windows .exe via bootstrapper installer |
| Paired With | RecyclerIQ.Link.Service |
| Device Mapping | One Link.Service per site — manages all recyclers at location |
| Scope | Cash collection terminal ONLY — cashier-facing |
| Out of Scope | Tax account management, citizen records, payment history — handled by external tax system |
| Hardware | Kisan KR10 cash recycler (first supported manufacturer) |
| Status | Validated by POC — core workflow proven |

**Session Model: Transaction-Based**

Each interaction is a discrete bill payment. No shift concept. The cashier enters bill details, the citizen inserts cash, change is dispensed if needed, and a receipt is printed.

**Workflow (Validated by POC):**

```
Operator logs in (4-digit PIN, works offline)
  -> Enters bill details (Invoice #, Bill #, Amount Due)
  -> Optionally enters amount customer wants to pay
  -> Starts cash collection
  -> Citizen inserts bills into recycler
  -> Real-time progress displayed (collected vs. target)
  -> Operator finalizes transaction
  -> System calculates change, dispenses if needed
  -> Transaction saved locally (SyncStatus: Pending)
  -> Receipt printed
  -> Sync triggers immediately, pushes to Cloud API
  -> SyncStatus updated to Synced when confirmed
```

**Pages:**

| Page | Description |
|---|---|
| Login | 4-digit PIN entry with numeric keypad. Validates against locally cached user data. Works offline. |
| Collector | Core tax collection interface. Bill details entry, real-time collection progress, receipt printing, change calculation. |
| Inventory | Real-time denomination breakdown from recycler hardware. |
| Daily Summary | Lightweight view of today's transactions. All detailed reporting is in the Web Portal. |

### 4.5 Shared UI Component Library

| Property | Detail |
|---|---|
| Type | Razor Class Library |
| Consumed By | RecyclerIQ.UI.RetailClient, RecyclerIQ.UI.TaxAuthority, RecyclerIQ.UI.WebClient, and optionally RecyclerIQ.Web.Portal |
| Rationale | Both local UIs share identical hardware interaction components — build once, use in both |

| Component | Consumed By |
|---|---|
| Recycler status indicator (online/offline/error) | Both local apps, Web Portal device details |
| Denomination breakdown display | Both local apps, Web Portal inventory views |
| Cash inventory grid | Both local apps, Web Portal site details |
| Receipt printer integration | Both local apps |
| PIN login keypad | Both local apps |
| Hardware connectivity indicator | Both local apps |
| Sync status display | Both local apps |
| Transaction audit row | Both local apps, Web Portal reports |

### 4.6 Hardware Abstraction Layer

| Property | Detail |
|---|---|
| Type | Class Library |
| Project | RecyclerIQ.Hardware |
| Consumed By | RecyclerIQ.Link.Service |
| Pattern | IRecycler interface with manufacturer-specific implementations + factory |

**IRecycler Interface (Validated by POC):**

- `ConnectAsync` / `DisconnectAsync` — hardware lifecycle
- `GetInventoryAsync` — current denomination breakdown
- `StartDepositAsync` / `EndDepositAsync` — cash acceptance session
- `WithdrawAsync` — cash dispensing (change-making or withdrawals)
- `InsertBill` — bill acceptance event (simulator: manual trigger; hardware: automatic)

| Implementation | Status | Detail |
|---|---|---|
| SimulatorRecyclerClient | Complete (from POC) | In-memory mock recycler for Demo/Sandbox environments. Maintains simulated inventory, publishes events for UI feedback. |
| KisanRecycler | Partially complete (from POC) | Kisan KR10 integration via KR.Server.dll SDK. Production mapping has placeholders that must be completed. |
| Future manufacturers | Not started | IRecycler interface designed for extensibility. Manufacturer scope not yet defined. |

### 4.7 Link.Service (Site-Level Background Agent)

| Property | Detail |
|---|---|
| Type | .NET 10 Worker Service |
| Deployment | One instance per site, manages all recyclers at that location. Both tenant types share the same Link.Service. |
| Purpose | Background services for sync, hardware communication, license validation, and health monitoring |

| Service | Direction | Description |
|---|---|---|
| SyncWorker | Local -> Cloud | Pushes pending transactions and inventory snapshots to Cloud API. Runs on interval (30s) or on-demand via signal. |
| UserSyncService | Cloud -> Local | Pulls user data from Cloud API for this site. Populates local cache for offline PIN validation. |
| SyncSignalService | Internal | Semaphore-based immediate sync trigger. Allows UI to wake SyncWorker immediately after a transaction. |
| SyncStatusService | Internal | Tracks sync state for UI display. Circular buffer of recent log messages. |
| LicenseValidator | Cloud -> Local | Validates hardware-bound JWT on startup and periodically. Enforces grace period if offline. Strict lockout on expiry. |
| HeartbeatService | Local -> Cloud | Periodic health ping to Cloud API with device status, uptime, and connectivity info. |

### 4.8 Installer & Client Distribution

**Strategy: ClickOnce-Style Smart Installer**

| Step | Detail |
|---|---|
| 1 | Web Portal provides a download link — per-recycler in device registry, or a unified Download Client button |
| 2 | Downloads a lightweight bootstrapper (.exe or .msix) |
| 3 | On first run, bootstrapper prompts operator to select their recycler (or auto-detects if pre-registered) |
| 4 | Bootstrapper pulls recycler-specific config from Cloud API (SiteId, MachineId, hardware protocol, connection parameters) |
| 5 | Downloads the full MAUI Blazor Hybrid client package (Tax Authority or Retail, based on tenant type) |
| 6 | Writes local configuration with recycler-specific settings |
| 7 | Registers device with Cloud API (serial/MAC for license binding) |
| 8 | On subsequent launches, client validates license JWT and checks for updates |

**Cloud API Endpoints for Installer:**

| Endpoint | Purpose |
|---|---|
| GET /api/installer/package | Serves the client bootstrapper |
| GET /api/devices/config/{deviceId} | Returns recycler-specific config for installer |
| POST /api/devices/register | Registers device serial/MAC during installation |

---

## Part 5: Tenant Model

### 5.1 Tenant Types

| Rule | Detail |
|---|---|
| Types | Retail \| TaxAuthority (enum) |
| Mutually Exclusive | A tenant cannot be both Retail and TaxAuthority |
| DB Approach | Single schema, TenantType enum drives behavior and access control |
| Extension Tables | Shared core tables + type-specific profile tables where needed |

### 5.2 Schema Design

```sql
Tenants                              -- Shared core
  TenantId
  TenantType  (Retail | TaxAuthority)
  Name
  SubscriptionTier

RetailProfiles                       -- Retail extension
  TenantId (FK -> Tenants)
  CITProvider
  ForecastingEnabled

TaxAuthorityProfiles                 -- Tax Authority extension
  TenantId (FK -> Tenants)
  MunicipalityCode
  TaxYearConfig

Transactions                         -- Both tenant types
  TransactionId
  TenantId
  DeviceId
  TransactionType  (Deposit | Withdrawal | Transfer | TaxCollection | ShiftOpen | ShiftClose)
  Amount
  ExternalReferenceNumber            -- Tax authority fills; retail leaves null
  ReceiptData
  Timestamp

Devices                              -- Both tenant types
  TenantId
  StoreId
  SerialNumber
  MACAddress
```

**TransactionType Enum:**

| Value | Tenant Type | Description |
|---|---|---|
| Deposit | Retail | Cash loaded into recycler |
| Withdrawal | Retail | Cash pulled from recycler |
| Transfer | Retail | CIT pickup or delivery |
| ShiftOpen | Retail | Shift start record with opening inventory |
| ShiftClose | Retail | Shift end record with closing inventory and variance |
| TaxCollection | Tax Authority | Cash payment accepted for a tax bill |

> Sale was removed from the TransactionType enum. Retail does not integrate with POS at launch. If a future customer pays for POS integration, Sale can be reintroduced.

> One transaction table handles both tenant types. TransactionType differentiates behavior. TenantType middleware prevents cross-type endpoint access even with a valid JWT.

---

## Part 6: Roles & Permissions

### 6.1 Role Hierarchy

| Level | Roles |
|---|---|
| System Level | SystemAdmin — full platform access, all tenants, billing, infrastructure. Can switch between tenants of either type. |
| Tenant Level | TenantAdmin, RegionalManager, StoreManager, CITCoordinator, Operator |

### 6.2 Tenant Role Definitions

| Role | Scope & Permissions |
|---|---|
| TenantAdmin | Full access within their tenant. Manages stores, devices, users, and subscriptions. Sees only their own tenant. |
| RegionalManager | Visibility across multiple stores within a tenant. Reports and device management. |
| StoreManager | Single store access. Reports, device management, End-of-Day. |
| CITCoordinator | CIT scheduling, alerts, and pickup management only. (Retail tenants only.) |
| Operator | Day-to-day cash transactions on local client. No configuration or reporting access. |

### 6.3 Implementation Approach

| Decision | Detail |
|---|---|
| v1 Approach | Fixed roles with permission bitmask on entity |
| Rationale | Covers 80% of customers. Fast to build. Avoids permission engine complexity at launch. |
| Future | Custom tenant-defined permission groups post-MVP if customer demand requires it |
| Status | Role structure confirmed. Detailed permission matrix still being defined. |

---

## Part 7: Core Domain Entities

### 7.1 Confirmed Entities

| Entity | Notes |
|---|---|
| Tenant | TenantType enum (Retail \| TaxAuthority). Core tenant record. |
| RetailProfile | Extends Tenant for retail-specific configuration (CIT provider, forecasting, shift rules). |
| TaxAuthorityProfile | Extends Tenant for tax authority configuration (municipality code, tax year). |
| Region | Groups stores within a tenant for regional management. |
| Store | Physical location. Belongs to Tenant and Region. |
| Device | Cash recycler hardware. Bound to Store and License. Managed by site-level Link.Service (one service per site, many recyclers). Stores serial number, MAC address, and recycler-specific configuration. |
| Transaction | Single table for both tenant types via TransactionType enum. |
| License | Signed JWT license tied to Device serial/MAC. Tracks expiry and grace period. |
| User | Platform user. Belongs to Tenant. Has Role. PIN for local client authentication. |
| UserRole | Role assignment. System-level or Tenant-level. |
| CashDenomination / DenominationSnapshot | Recycler inventory tracking per denomination. |
| CITEvent | Cash-in-transit pickup/delivery record. (Retail tenants only.) |
| AuditLog | Immutable log of all transactions and actions. Critical for cash handling compliance. |
| BillingRecord | Tracks subscription state per tenant. Queried during license issuance. |
| Alert | CIT optimization alerts and critical system notifications. |

### 7.2 Still Being Defined

> The following entities require additional design work before implementation.

| Entity / Area | Blocker |
|---|---|
| User Groups / Permission detail | Permission matrix still being finalized |
| ML model inputs/outputs | ML approach not yet decided (ML.NET vs Python microservice) |

---

## Part 8: Data Flow & Synchronization

### 8.1 Sync Architecture

```
+-----------------------------------------------------------+
|  CLOUD (Azure)                                            |
|                                                           |
|  Cloud API (App Service)                                  |
|  +-- Receives: transactions, inventory snapshots,         |
|  |             heartbeats                                 |
|  +-- Serves:   users, recycler config, license validation |
|  +-- Stores:   all data in Azure SQL (master/auth.)       |
|                                                           |
|  Web Portal (Blazor WASM)                                 |
|  +-- All admin + reporting UI -> calls Cloud API          |
+----------------------------+------------------------------+
                             |  HTTPS + Azure Service Bus
+----------------------------+------------------------------+
|  LOCAL (On-Site, per site)                                |
|                                                           |
|  Link.Service -> pushes transactions/inventory UP         |
|              -> pulls users/config DOWN                   |
|                                                           |
|  Local UI (Tax Authority or Retail)                       |
|  Local SQLite (offline queue + cached config + users)     |
+-----------------------------------------------------------+
```

### 8.2 Sync Rules

| Data | Direction | Detail |
|---|---|---|
| Transactions | Local -> Cloud | Created locally with SyncStatus=Pending. Pushed to Cloud API. Marked Synced on confirmation. |
| Inventory Snapshots | Local -> Cloud | Pushed on delta (only if changed) or on heartbeat interval (5 min). |
| Users | Cloud -> Local | Authoritative in Cloud API. Pulled down to local cache filtered by site. Used for offline PIN validation. |
| Recycler Config | Cloud -> Local | Authoritative in Cloud API. Delivered at install time. Refreshable via periodic sync. |
| Heartbeat | Local -> Cloud | Periodic health ping with device status, uptime, and connectivity info. |

### 8.3 Offline Resilience

All local operations work without internet connectivity. Local SQLite is the source of truth until sync completes. When connectivity is restored, pending transactions and snapshots are pushed to the Cloud API automatically.

### 8.4 Reporting Strategy

| Reporting Level | Location | Detail |
|---|---|---|
| Detailed reports | Web Portal only | Transaction reports, end-of-day reconciliation, audit trails, operator activity, CIT reports (retail), collection reports (tax authority). All served by Cloud API from the master database. |
| Daily summary | Local client | Lightweight view of today's activity. Tax Authority: today's transactions. Retail: current shift summary. |

---

## Part 9: Open Items & Decisions Pending

| Item | Status | Blocking |
|---|---|---|
| Billing platform selection | EVALUATING — QuickBooks vs Salesforce | License activation implementation |
| Permission matrix detail | IN PROGRESS | User/Role entity finalization |
| ML approach | NOT DECIDED — ML.NET vs Python microservice | Forecasting engine design |
| SOC 2 compliance | DEFERRED — post-MVP | None currently |
| Recycler manufacturers in scope | NOT DEFINED — Kisan KR10 confirmed as first. Others TBD. | Hardware Integration Layer |
| Grace period duration | NOT DEFINED | License enforcement logic |
| Sync conflict resolution strategy | NOT DEFINED — recommend server-authoritative for cash transactions | Edge Sync Engine |

---

## Part 10: Decisions & Alternatives Evaluated

### 10.1 Dropped Decisions

| Item | Reason Dropped |
|---|---|
| React / Angular (Web Portal) | Replaced with Blazor WebAssembly for .NET stack consistency and shared component reuse. |
| Stripe | Fee-based model incompatible with invoice-only billing. No card processing at launch. |
| Salesforce Pro Suite (billing) | Still under evaluation. Not dropped — held for comparison vs QuickBooks. |
| Separate database per tenant type | Single schema with TenantType enum is sufficient. Separate DB would duplicate all shared infrastructure. |
| Complex permission engine (v1) | Fixed roles with bitmask chosen for speed. Custom groups deferred post-MVP. |
| Python microservice (ML) | Not decided yet — ML.NET is a viable .NET-native option being evaluated. |
| Sale TransactionType (v1) | Removed from launch. No POS integration at launch. Can be reintroduced if a customer pays for POS integration. |
| Two separate Web Portals | Single Blazor WASM app with tenant-type-aware routing. ~70% of admin UI is shared; duplicating two portals would double maintenance. |
| Multi-unit local app | One Link.Service per site managing all recyclers. Simplifies deployment (single install per location), reduces overhead, while maintaining per-device license binding and configuration. |
| External tax system integration (v1) | Current customers do not allow integration. Deferred as paid custom option. |
| POS integration (v1) | Retail operations function independently. Deferred as paid custom option at upcharge. |

### 10.2 Technology Summary

| Concern | Decision |
|---|---|
| Cloud | Azure |
| Runtime | .NET 10 LTS |
| API | ASP.NET Core 10, Clean Architecture |
| Authentication | Self-issued JWT |
| Database | Azure SQL, schema-per-tenant, EF Core 10 code-first |
| Messaging | Azure Service Bus |
| Logging | Serilog + OpenTelemetry (Seq for dev) |
| Billing | PENDING — QuickBooks or Salesforce (invoice-based only) |
| Local / Tax UI | MAUI Blazor Hybrid (.NET 10), deploys as .exe |
| Web Portal | Blazor WebAssembly (.NET 10), single app with tenant-type-aware routing |
| Shared UI | Razor Class Library |
| Background Service | .NET 10 Worker Service |
| Tenant Model | Single schema, TenantType enum |
| Roles | Fixed roles v1, permission bitmask |
| CQRS | MediatR |
| Secrets | Azure Key Vault |
| Hardware | IRecycler abstraction, Kisan KR10 first manufacturer |
| Installer | ClickOnce-style bootstrapper with config pull from Cloud API |
| Device Mapping | One Link.Service per site — manages all recyclers at location |
| Go-to-Market | Tax Authority first, Retail second |
