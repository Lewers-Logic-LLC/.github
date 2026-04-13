# Recycler.IQ — Architecture Decision Records
## Local Architecture & Multi-Recycler Operations
**March 28, 2026**
**Company:** Lewers Logic LLC
**Copyright:** © 2026 Lewers Logic LLC. All rights reserved.

**Status:** Final

> This document records architectural decisions made on March 28, 2026 covering the local site architecture, Link.Service design, and client communication protocols. These decisions supplement the existing ADR set and Master PRD v3.0.

---

## ADR-001: Hardware Abstraction in Link.Service
<!-- Jira: RLINK-17,RLINK-19,RLINK-20,RLINK-21,RLINK-22 | Epic: RLINK-2 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-001 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

The original architecture had hardware SDK references in the local client projects. As the platform evolved to support multiple recycler manufacturers and multi-client scenarios, it became clear that hardware knowledge in the UI created tight coupling and complexity.

### Decision

All recycler hardware communication, manufacturer SDKs, and hardware-specific code are encapsulated entirely within `RecyclerIQ.Link.Service`. Local UI clients communicate with Link.Service only. Clients have no direct knowledge of which recycler hardware or manufacturer SDK is in use.

### Consequences

- UI clients are dramatically simpler — no hardware SDK dependencies
- Manufacturer changes or additions require no UI changes
- Link.Service becomes the single point of hardware truth for the site
- gRPC contract between client and Link.Service defines a clean hardware-agnostic interface

---

## ADR-002: gRPC for UI Client ↔ Link.Service Communication
<!-- Jira: RLINK-31,RLINK-11,RLINK-32 | Epic: RLINK-4 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-002 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

Local UI clients and Link.Service may run on different machines on the same LAN. Communication requires both request/response (commands) and real-time push (hardware events, queue status). SignalR was evaluated as a known technology. gRPC was evaluated as the alternative.

### Decision

gRPC is selected as the communication protocol between local UI clients and Link.Service.

| Requirement | gRPC Support |
|---|---|
| Request/response commands | Native unary RPC |
| Real-time hardware event push | Native server streaming |
| Bidirectional communication | Native bidirectional streaming |
| Strongly typed contracts | Yes — .proto files |
| LAN (non-localhost) support | Yes — HTTP/2 over network |
| .NET 10 support | First-class |

### Alternatives Considered

- **SignalR:** Familiar, JSON-based, mature. Rejected because gRPC's strongly typed contracts and native streaming are better suited for hardware event-driven communication.
- **REST only:** Too limited — no push capability without polling.
- **Named Pipes:** Local IPC only, does not support LAN topology.

### Consequences

- `.proto` contract defines the exact API surface between UI and Link.Service
- Mismatches are caught at compile time, not runtime
- All hardware events (bill inserted, inventory change, recycler status) are pushed via server streaming
- Learning curve for team members unfamiliar with gRPC

---

## ADR-003: REST for Link.Service ↔ Cloud API Communication
<!-- Jira: RLINK-34,RLINK-35,RLINK-36,RLINK-37 | Epic: RLINK-5 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-003 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

Link.Service must push transactions and inventory to the Cloud API, and pull user cache and config. The sync model is primarily scheduled (30s interval) or event-triggered (immediate after transaction). Real-time push from Cloud to Link.Service is not required at launch.

### Decision

REST (HTTPS) is retained for all sync endpoints (transactions, inventory, users, config). SignalR is added at launch for real-time config push notifications from Cloud API to Link.Service.

### SignalR Config Push (At Launch)

Cloud API pushes config change notifications to Link.Service instances via SignalR immediately when an admin updates settings in the Web Portal (recycler config, user accounts, site settings, sync interval). Link.Service receives the notification and triggers an immediate config pull via the existing REST endpoints. The 24h interval-based config poll remains as a fallback.

The transaction sync interval (default 30s) is a **tenant-configurable parameter** set from the Cloud Admin Portal and pushed to Link.Service via SignalR. This allows per-tenant tuning for performance or business needs.

### Future State (v2)

On-demand transaction sync trigger from the Cloud Admin Portal — admin button to force immediate sync rather than waiting for the next interval. Nice-to-have, not required for v1.

### Consequences

- REST sync endpoints remain unchanged — SignalR is additive
- Config changes propagate to Link.Service in near-real time (not waiting for 24h poll)
- Link.Service maintains a persistent SignalR WebSocket connection to Cloud API with auto-reconnect
- SignalR connection authenticated via the Link.Service API key (same key used for REST)
- Sync interval is no longer hardcoded — Cloud Admin Portal controls it per tenant

---

## ADR-004: Multi-Instance Link.Service Architecture
<!-- Jira: RLINK-43 | Epic: RLINK-7 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-004 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

Sites with large numbers of recyclers may experience performance degradation from a single Link.Service instance managing too many hardware connections and sync operations simultaneously. The architecture must accommodate this without requiring major refactoring.

### Decision

The architecture supports multiple Link.Service instances per site. Launch deployment is one instance per site. Adding instances is a configuration and deployment operation, not a code change.

| Architectural Requirement | Implementation |
|---|---|
| Recycler ownership | Each recycler config explicitly assigns it to a Link.Service instance by service ID |
| Client routing | Clients are configured to connect to a specific Link.Service endpoint based on recycler assignment |
| Sync isolation | Each instance syncs independently for its assigned recyclers |
| License binding | Recycler JWTs are tied to hardware, not to the Link.Service instance |
| Capacity guideline | 5–10 recyclers per instance (configurable tuning parameter, not hard limit) |

### Consequences

- Recycler config schema must include a Link.Service instance ID field
- Client config must support specifying the Link.Service endpoint
- Auto-discovery must enumerate multiple Link.Service instances when present
- Cloud API audit trail captures which Link.Service instance pushed each transaction

---

## ADR-005: Recycler Auto-Discovery via Link.Service
<!-- Jira: RLINK-33 | Epic: RLINK-4 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-005 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

Clients need to know which Link.Service instance to connect to and which recycler to operate. Manual endpoint configuration is error-prone and does not scale well in multi-instance deployments.

### Decision

Clients use auto-discovery (mDNS or broadcast) to find available Link.Service instances on the local network. The client presents the operator with a list of available recyclers and the operator selects which one to use. The selection is persisted in local client configuration.

### Consequences

- No manual IP/port configuration required during client setup
- Multiple Link.Service instances are discovered and presented naturally
- Client config stores: selected recycler ID, fallback recycler ID (optional), associated Link.Service endpoint
- mDNS vs. broadcast mechanism decision is deferred to implementation

---

## ADR-006: Recycler State Management & Operation Queuing
<!-- Jira: RLINK-40,RLINK-53 | Epic: RLINK-7 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-006 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

Multiple clients may attempt to use the same recycler simultaneously. Without centralized state management and queuing, concurrent operations would corrupt hardware state. Link.Service, as the hardware broker, is the natural location for this logic.

### Decision

Link.Service maintains authoritative state for each recycler (Idle, Busy, Offline, Error) and a queue of pending operations. All clients receive real-time state updates via gRPC streaming. A client may only proceed with an operation when Link.Service grants it.

Client/recycler relationships are not 1:1 — multiple clients may connect to and operate the same recycler at different times.

### Consequences

- Link.Service is the single point of truth for recycler availability
- Clients must handle queue position updates and wait states in the UI
- Receipt and transaction records include which recycler processed the operation
- Hardware event streams (bill inserted, etc.) are broadcast to the active client only

---

## ADR-007: Primary / Fallback Recycler with Configurable Failover
<!-- Jira: RLINK-41,RLINK-42 | Epic: RLINK-7 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-007 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

Sites with multiple recyclers benefit from resilience when a primary recycler is temporarily unavailable. Rather than blocking an operator entirely, the system can route to a fallback recycler. Different sites have different preferences on whether this should be automatic or operator-confirmed.

### Decision

Each client may be configured with a primary and optional fallback recycler. Failover behavior is configurable via client settings.

| Scenario | Behavior |
|---|---|
| Primary is Busy, client is next in queue | Wait up to `WaitTimeoutMs`, then fall back (if `AutoFallbackEnabled`) or prompt user |
| Primary is Offline | Fall back immediately (no wait) |
| Primary is in Error state | Fall back immediately (no wait) |
| `AutoFallbackEnabled` = false | Prompt operator before using fallback in all scenarios |
| Both primary and fallback unavailable | Fail operation, display error to operator |

### Transaction Recording

All transactions record the actual recycler used (`ProcessedOnRecyclerId`). If failover occurred, `OriginalRecyclerId` and `FailoverReason` are also recorded. This information appears on the receipt and in the transaction log.

### Consequences

- `WaitTimeoutMs` and `AutoFallbackEnabled` are configurable per client installation
- Default values for `WaitTimeoutMs` to be determined during testing
- Receipt template must be updated to show actual recycler used when failover occurs
- Transaction entity requires three new fields: `ProcessedOnRecyclerId`, `OriginalRecyclerId`, `FailoverReason`

---

## ADR-008: API Key Authentication for Link.Service ↔ Cloud API
<!-- Jira: RLINK-38,RLINK-39 | Epic: RLINK-6 | Synced: 2026-04-11 -->

| Field | Value |
|---|---|
| ADR ID | ADR-008 |
| Status | Accepted |
| Date | March 28, 2026 |
| Author | Tommy (Founder / Lead Developer) |
| Product | Recycler.IQ — Lewers Logic LLC |

### Context

Link.Service must authenticate itself to the Cloud API when pushing sync data. The existing licensing model (hardware-bound JWTs) is designed for recycler hardware, not for service-to-service authentication. A separate mechanism is needed for Link.Service.

### Decision

Each Link.Service instance is issued a unique API key scoped to its tenant and site. This key authenticates all Cloud API calls made by that instance.

| Auth Mechanism | Scope | Purpose |
|---|---|---|
| Hardware-bound JWT | Per recycler device | License enforcement. Proves recycler is licensed and paid. |
| API key | Per Link.Service instance | Service-to-Cloud API authentication. Not a license — an identity credential. |
| User JWT | Per operator session | Authenticates the human operator. Required before issuing recycler operations. |

### Consequences

- Cloud API can audit, throttle, and revoke per Link.Service instance independently
- API keys are rotatable without affecting recycler licenses or user sessions
- Key provisioning is part of the Link.Service installation flow
- Cloud API logs all sync operations tagged with the originating Link.Service instance ID
