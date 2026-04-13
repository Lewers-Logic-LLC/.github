# Repository Structure Decisions

**Document Type:** Architecture Decision Record
**Updated:** March 2026
**Status:** Final
**Company:** Lewers Logic LLC
**Product:** Recycler.IQ

---

## Summary

This document captures the repository structure decisions for the Recycler.IQ platform. The core principle is independent release cycles — the Cloud API, local MAUI clients, Link.Service, and Simulator all version and deploy independently. Shared code is distributed via internal NuGet packages.

---

## 1. Repository Layout
<!-- Jira: RCORE-96 (core repo), RLINK-9 (link repo) | Synced: 2026-04-11 -->

**Decision:** 5 repositories + 1 private NuGet feed.

| Repository | Contents | Deploys To | Release Cycle |
|---|---|---|---|
| `recycleriq-core` | RecyclerIQ.Domain, RecyclerIQ.Common, RecyclerIQ.Protos | Private NuGet feed (Azure Artifacts or GitHub Packages) | On shared contract changes |
| `recycleriq-cloud` | RecyclerIQ.API, RecyclerIQ.Application, RecyclerIQ.Infrastructure, RecyclerIQ.Portal | Azure App Service | Cloud API + Portal releases |
| `recycleriq-clients` | RecyclerIQ.UI.TaxAuthority, RecyclerIQ.UI.RetailClient, RecyclerIQ.UI.WebClient, RecyclerIQ.UI.Shared | MAUI → Windows .exe; WebClient → Azure App Service | Client releases |
| `recycleriq-link` | RecyclerIQ.Link.Service, RecyclerIQ.Hardware | Cross-platform daemon (Windows service, Linux systemd, Docker) | Link.Service releases |
| `recycleriq-simulator` | RecyclerIQ.Simulator | Standalone process (local or cloud) | Simulator releases (potentially licensable to third parties) |

---

## 2. Shared Code Distribution

**Decision:** `recycleriq-core` publishes NuGet packages consumed by all other repos. Only truly shared contracts go here — libraries with a single consumer live in that consumer's repo as project references.

**NuGet Packages (recycleriq-core):**
- `RecyclerIQ.Domain` — Entities, enums, domain events, value objects (zero external dependencies)
- `RecyclerIQ.Common` — Shared utilities, extensions, constants, DTOs
- `RecyclerIQ.Protos` — gRPC .proto service definitions and generated C# client/server stubs (consumed by recycleriq-link for server stubs, recycleriq-clients for client stubs)

**Project References (not NuGet):**
- `RecyclerIQ.Hardware` — `IRecycler`, `ISimulatorControl`, `ILinkClient`, `IRecyclerFactory`, `SimulatorRecyclerClient`, `KisanRecycler` → lives in `recycleriq-link` (only consumer is Link.Service)
- `RecyclerIQ.UI.Shared` — Razor Class Library (shared Blazor components) → lives in `recycleriq-clients` (only consumers are TaxAuthority, RetailClient, WebClient)

**Versioning:** SemVer. Breaking interface changes (e.g., new property on a Domain entity) require a major version bump. Downstream repos pull updates on their own schedule — this forces backward compatibility discipline.

**Feed:** Azure Artifacts (if using Azure DevOps) or GitHub Packages (if using GitHub Actions). Single feed for all packages.

**Rationale for keeping Hardware and UI.Shared out of NuGet:** Each has only one consuming repo. Pushing them through NuGet would add a publish-update-restore cycle on every change with no benefit — project references give instant feedback during active development. If a second consumer appears (e.g., Web.Portal needs UI.Shared components), extract to NuGet at that point.

---

## 3. Rationale

### Why not a monorepo?
- The API, MAUI clients, Link.Service, and Simulator have independent release cycles — they will not always ship at the same time or on the same version number.
- A monorepo would require path-based CI/CD triggers and careful pipeline isolation. With a 3-person team, separate repos with clear boundaries are simpler to reason about.
- Deploying a UI fix to a MAUI client should not require building or testing the Cloud API.

### Why the Cloud Portal is with the API (not separate)?
- The Portal (Blazor) and API share the `RecyclerIQ.Application` layer directly via project references.
- Splitting them would mean either duplicating the Application layer or turning it into another NuGet package — unnecessary complexity for a 3-person team.
- They deploy to the same Azure App Service.
- If the team grows or the Portal needs independent scaling, it can be extracted later.

### Why the Simulator is standalone (not with Link.Service)?
- The Simulator is a general-purpose hardware simulator, not an internal-only tool.
- It may be licensed to third-party integrators, dealers, or hardware partners.
- It can be used with applications that don't need Link.Service (e.g., standalone testing tools, third-party integrations).
- Coupling it to Link.Service would artificially restrict its distribution.

### Why UI.Shared is with the clients (not in recycleriq-core)?
- Only the client apps (TaxAuthority, RetailClient, WebClient) consume UI.Shared. There's no cross-repo dependency.
- Pushing UI components through NuGet would add a publish-update-restore cycle on every component change — painful for active UI development.
- Project references give instant feedback. If the Web.Portal ever needs shared components, extract just those into a NuGet package at that point.

### Why Hardware is with Link.Service (not in recycleriq-core)?
- Only Link.Service consumes the Hardware library. The MAUI clients talk to hardware exclusively through Link.Service via IPC (`ILinkClient`).
- Same reasoning as UI.Shared — no point pushing through NuGet when there's one consumer.
- The `ILinkClient` interface (the IPC contract that clients use) is in Domain, which IS in NuGet — so the cross-repo contract is still shared properly.

### Why MAUI clients and WebClient are together (not separate repos)?
- UI.TaxAuthority, UI.RetailClient, and UI.WebClient all consume the same Razor components from `RecyclerIQ.UI.Shared` via project reference (same solution).
- UI.WebClient is a thin Blazor Server hosting wrapper — it has minimal code of its own (just `Program.cs` + routing). It exists so the same UI can be accessed via browser for cloud demos and potentially future web access.
- They can still be versioned independently within the same repo (separate project version numbers, separate CI pipelines triggered by path).
- If one client needs a radically different release cadence, it can be extracted later.

---

## 4. CI/CD Pipeline Overview
<!-- Jira: RCORE-97,RCORE-98 | Epic: RCORE-94 | Synced: 2026-04-11 -->

| Repository | CI Trigger | Artifacts | Deploy Target |
|---|---|---|---|
| `recycleriq-core` | Push to main | NuGet packages (Domain, Common) → private feed | NuGet feed |
| `recycleriq-cloud` | Push to main | Docker image or publish bundle | Azure App Service (staging → prod) |
| `recycleriq-clients` | Push to main | MAUI → Windows .exe installer; WebClient → Docker image or publish bundle | MAUI → distribution endpoint; WebClient → Azure App Service |
| `recycleriq-link` | Push to main | Windows installer (.msi or .exe), Linux tarball, Docker image | On-site installation (Windows, Linux, or Docker) |
| `recycleriq-simulator` | Push to main | Standalone .exe or Docker image | Local or cloud deployment |

**Shared package updates:** When `recycleriq-core` publishes a new NuGet version, downstream repos are notified (Dependabot, Renovate, or manual). Each downstream repo updates and tests on its own schedule.

---

## 5. Project-to-Repository Mapping

```
recycleriq-core/                                # NuGet packages only
├── RecyclerIQ.Domain/                          # Entities, enums, domain events, ILinkClient
└── RecyclerIQ.Common/                          # Utilities, DTOs, extensions

recycleriq-cloud/
├── RecyclerIQ.API/
├── RecyclerIQ.Application/
├── RecyclerIQ.Infrastructure/
└── RecyclerIQ.Portal/

recycleriq-clients/
├── RecyclerIQ.UI.TaxAuthority/                 # MAUI Blazor Hybrid — desktop client
├── RecyclerIQ.UI.RetailClient/                 # MAUI Blazor Hybrid — retail client
├── RecyclerIQ.UI.WebClient/                    # Blazor Server — browser-accessible (cloud demos, future web access)
└── RecyclerIQ.UI.Shared/                       # Razor Class Library — project reference, not NuGet

recycleriq-link/
├── RecyclerIQ.Link.Service/                    # Worker Service — one per site
└── RecyclerIQ.Hardware/                        # IRecycler, ISimulatorControl, IRecyclerFactory — project reference, not NuGet
    ├── IRecycler.cs
    ├── ISimulatorControl.cs
    ├── IRecyclerFactory.cs
    ├── SimulatorRecyclerClient.cs
    └── KisanRecycler.cs

recycleriq-simulator/
└── RecyclerIQ.Simulator/
```

---

## 6. Open Items

| Item | Status |
|---|---|
| NuGet feed provider (Azure Artifacts vs GitHub Packages) | Not decided |
| CI/CD platform (GitHub Actions vs Azure DevOps Pipelines) | Not decided |
| Simulator licensing model and distribution mechanism | Future — placeholder |
| Client installer technology (ClickOnce, MSIX, custom bootstrapper) | Not decided |
| Dependabot / Renovate for automated NuGet package updates | Not configured |
