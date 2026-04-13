# Recycler.IQ — Local Architecture & Multi-Recycler Operations
## Product Requirements Document
**Version 1.0 | March 28, 2026**
**Company:** Lewers Logic LLC
**Copyright:** © 2026 Lewers Logic LLC. All rights reserved.
**Status:** Final

> **Note:** This PRD supplements the Master PRD (v3.0). It does not replace or modify existing decisions documented there.

---

<!-- 
  Jira Project: RLINK (RecyclerIQ Link)
  Epics: RLINK-1 (Core), RLINK-2 (HAL), RLINK-3 (Sync), RLINK-4 (gRPC), 
         RLINK-5 (SignalR), RLINK-6 (API Key Auth), RLINK-7 (Multi-Recycler), RLINK-8 (Repo Setup)
  Last Synced: 2026-04-11
-->

## Part 1: Overview

This document captures the product requirements for the local on-site architecture of Recycler.IQ, specifically covering Link.Service as the site-level hardware broker, multi-recycler operations, client-to-Link.Service communication, and recycler failover behavior. These requirements emerged from architecture discussions held on March 28, 2026.

---

## Part 2: Link.Service Role & Responsibilities
<!-- Jira Epic: RLINK-2 | Synced: 2026-04-11 -->

### 2.1 Hardware Abstraction
<!-- Jira: RLINK-17,RLINK-19 | Epic: RLINK-2 | Synced: 2026-04-11 | IRecycler + RecyclerFactory -->

All recycler hardware communication, SDKs, and manufacturer-specific code is encapsulated entirely within Link.Service. Local UI clients have no direct knowledge of which recycler hardware they are connected to, nor any awareness of manufacturer SDKs. The client is agnostic to the underlying hardware — it communicates with Link.Service, which brokers all recycler operations.

> **Design Principle:** The client should not know or care which recycler backend it is connected to. Link.Service handles all hardware routing and state management.

### 2.2 Link.Service Deployment Model
<!-- Jira: RLINK-9 | Epic: RLINK-8 | Synced: 2026-04-11 -->

- One Link.Service instance per site at launch
- Link.Service manages all recyclers at that site
- Architecture must support multiple Link.Service instances per site as a future scaling option
- Link.Service must always be available for local clients to operate — it is a required dependency for all cash operations
- Link.Service handles all sync operations between the local site and the Cloud API

### 2.3 Link.Service Availability Requirement

Link.Service is a required dependency for local client operation. It is not optional. Offline capability (operation without internet) is supported, but Link.Service itself must be running and reachable on the local network. Clients cannot process cash transactions if Link.Service is unreachable.

---

## Part 3: Multi-Instance Link.Service Support
<!-- Jira: RLINK-43 | Epic: RLINK-7 | Synced: 2026-04-11 -->

### 3.1 Architecture Requirements

The architecture must support multiple Link.Service instances running at a single site without requiring major refactoring. While a single instance is the default deployment at launch, sites with high recycler counts may require additional instances for performance reasons.

### 3.2 Instance Configuration

| Parameter | Detail |
|---|---|
| Instance identifier | Each Link.Service instance has a unique service ID assigned at install time |
| Recycler ownership | Each recycler is explicitly assigned to one Link.Service instance via configuration |
| Client routing | Clients are configured to connect to a specific Link.Service instance based on recycler assignment |
| Sync isolation | Each Link.Service instance syncs independently for its assigned recyclers |
| License binding | Recycler hardware licenses (JWTs) are tied to the recycler hardware, not the Link.Service instance |

### 3.3 Recycler Capacity Tuning

The maximum number of recyclers managed per Link.Service instance is a configurable tuning parameter, not a hard-coded limit. The recommended starting guideline is 5–10 recyclers per instance. This should be adjusted based on observed performance metrics including memory usage, CPU load, and sync frequency.

> **Action Required:** Monitor per-instance metrics (recycler count, sync frequency, memory, CPU) in production to establish data-driven capacity guidelines.

---

## Part 4: Client ↔ Link.Service Communication
<!-- Jira: RLINK-31,RLINK-11,RLINK-32,RLINK-33 | Epic: RLINK-4 | Synced: 2026-04-11 -->

### 4.1 Network Topology

Link.Service and local UI clients are not required to run on the same machine. They communicate over the local area network (LAN) at the site. Named pipes and other same-machine IPC mechanisms are not viable.

### 4.2 Protocol Decision
<!-- Jira: RLINK-31,RLINK-11 | Epic: RLINK-4 | Synced: 2026-04-11 | gRPC chosen -->

| Channel | Protocol | Rationale |
|---|---|---|
| UI Client ↔ Link.Service | gRPC | Bidirectional streaming for real-time hardware events + request/response for commands. Strongly typed .proto contracts. Low latency over HTTP/2. |
| Link.Service ↔ Cloud API | REST (HTTPS) + SignalR (WebSocket) | REST for sync push/pull. SignalR for real-time config push notifications from Cloud API (recycler settings, user changes, site config). |

### 4.3 gRPC Communication Patterns

- **Request/response:** commands issued from client to Link.Service (start deposit, withdraw, get inventory, check recycler status)
- **Server streaming:** real-time hardware events pushed from Link.Service to connected clients (bill inserted, collection progress, recycler status changes, queue position updates)

### 4.4 Service Discovery
<!-- Jira: RLINK-33 | Epic: RLINK-4 | Synced: 2026-04-11 | mDNS -->

Clients use auto-discovery to find available Link.Service instances on the local network (mDNS or broadcast). On startup, a client discovers Link.Service instances, retrieves the list of available recyclers, and the user selects which recycler to operate. The selected recycler ID and its associated Link.Service endpoint are stored in local client configuration.

> Auto-discovery eliminates manual endpoint configuration and supports the multi-Link.Service scenario naturally.

---

## Part 5: Authentication Model
<!-- Jira: RLINK-38,RLINK-39 | Epic: RLINK-6 | Synced: 2026-04-11 | API key auth + rotation -->

### 5.1 Identity Layers

| Component | Auth Mechanism | Purpose |
|---|---|---|
| Recycler hardware | Hardware-bound JWT (per device) | License enforcement. Tied to device serial/MAC. Issued by Cloud API after billing validation. |
| Link.Service instance | API key (per service instance) | Service-to-Cloud API authentication. Tenant + site scoped. Rotatable independently. |
| UI client users | JWT (user identity) | Authenticates the operator. Not hardware-bound. Required before client can issue recycler operations. |

### 5.2 API Key per Link.Service

Each Link.Service instance is issued a unique API key scoped to its tenant and site. This key is used to authenticate all Cloud API calls made by that instance (transaction sync, user cache refresh, config pull, heartbeat). Benefits include per-instance audit trails, independent key rotation, and the ability to revoke a single instance without affecting others at the same site.

---

## Part 6: Recycler State Management & Queuing
<!-- Jira: RLINK-40,RLINK-53 | Epic: RLINK-7 | Synced: 2026-04-11 -->

### 6.1 Shared Resource Model

A recycler is a shared resource. Multiple clients may connect to the same recycler. Link.Service is the sole authority on recycler state and serializes all operations. No client may issue operations to a recycler without first acquiring permission from Link.Service.

### 6.2 Recycler States

| State | Description | Client Behavior |
|---|---|---|
| Idle | Recycler is available | Client may proceed with operation immediately |
| Busy | Recycler is processing a transaction for another client | Client joins queue; wait or fall back per config |
| Offline | Recycler hardware unreachable | Client falls back immediately per config |
| Error | Recycler hardware in error state | Client falls back immediately per config |

### 6.3 Queue Behavior

- Link.Service maintains a queue of pending operations per recycler
- When the current operation completes, Link.Service processes the next queued operation
- All connected clients receive real-time status updates via gRPC server streaming
- Clients see their queue position and are notified immediately when the recycler becomes available

---

## Part 7: Recycler Failover Configuration
<!-- Jira: RLINK-41,RLINK-42 | Epic: RLINK-7 | Synced: 2026-04-11 | Primary/fallback + failover metadata -->

### 7.1 Primary / Fallback Recycler

Each client may be configured with a primary recycler and an optional fallback recycler. Failover behavior is configurable per client. All failover settings are stored in local client configuration.

### 7.2 Client Configuration Parameters

| Config Parameter | Type | Description |
|---|---|---|
| PrimaryRecyclerId | GUID | The recycler this client prefers for all operations |
| FallbackRecyclerId | GUID (optional) | Recycler to use if primary is unavailable |
| AutoFallbackEnabled | Boolean | If true, client automatically falls back without prompting the user |
| WaitTimeoutMs | Integer (ms) | How long to wait in queue before triggering fallback. Applies to Busy state only. |

### 7.3 Failover Logic

- **Primary is Busy, client is next in queue:** wait up to `WaitTimeoutMs`, then fall back (if `AutoFallbackEnabled`) or prompt user
- **Primary is Offline:** fall back immediately (no wait)
- **Primary is in Error state:** fall back immediately (no wait)
- **`AutoFallbackEnabled` = false:** prompt operator before using fallback in all scenarios
- **Both primary and fallback unavailable:** fail operation, display error to operator

### 7.4 Transaction Recording

Every transaction record must capture which recycler was actually used. If a fallback recycler was used, the reason is also logged. This information is displayed to the operator at transaction completion and included on the printed receipt.

| Transaction Field | Description |
|---|---|
| ProcessedOnRecyclerId | The recycler that actually processed the transaction |
| FailoverReason | Nullable. Populated if fallback was used (Timeout, Offline, Error) |
| OriginalRecyclerId | Nullable. The primary recycler that was bypassed, if failover occurred |

---

## Part 8: Configuration Synchronization
<!-- Jira: RLINK-34,RLINK-36,RLINK-37 | Epic: RLINK-5 | Synced: 2026-04-11 | SignalR + config sync -->

### 8.1 Bidirectional Config Flow

| Direction | Trigger | Detail |
|---|---|---|
| Cloud → Link.Service | Initial install | Bootstrapper pulls recycler-specific config from Cloud API |
| Cloud → Link.Service | SignalR push | Cloud API pushes config change notifications in real time when admin updates settings in the Web Portal. Link.Service pulls updated config via REST immediately. |
| Cloud → Link.Service | Periodic fallback | Link.Service polls for config updates on a 24h fallback interval in case a SignalR notification was missed |
| Link.Service → Cloud | Post-setup | After local recycler registration and configuration, settings are pushed to Cloud API as the master record |
| Link.Service → Cloud | Local changes | Any local config changes sync up to Cloud API when connectivity is available |

> **Note:** The transaction sync interval (default 30s) is a **tenant-configurable parameter** set from the Cloud Admin Portal and pushed to Link.Service via SignalR config notification. This allows per-tenant tuning for performance or business requirements. On-demand sync trigger from the portal is a v2 nice-to-have.

---

## Part 9: Open Items

| Item | Status | Notes |
|---|---|---|
| gRPC .proto contract design | Not started | Define service contracts for recycler commands and event streams |
| Auto-discovery implementation | Not started | mDNS vs. broadcast — decide mechanism |
| Recycler capacity guidelines | Not defined | Establish via performance testing in production |
| WaitTimeoutMs default value | Not defined | Establish via testing during demo preparation |
| Multi-Link.Service sync coordination | Not needed at launch | Revisit if a site deploys more than one instance |
| On-demand sync trigger from Cloud Admin Portal | v2 nice-to-have | Admin button to trigger immediate transaction sync via SignalR |
