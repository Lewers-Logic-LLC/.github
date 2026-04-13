# ADR: Identity Provider Architecture — IIdentityProvider vs Azure AD B2C
<!-- Jira: RCORE-109 | Epic: RCORE-95 | Synced: 2026-04-11 | IIdentityProvider decision -->

**Company:** Lewers Logic LLC
**Product:** Recycler.IQ
**Document Type:** Architecture Decision Record
**Date:** April 2026
**Status:** Final
**Supersedes:** None
**Related ADRs:** authentication-identity-decisions.md, database-architecture-decisions.md

---

## Context

Recycler.IQ is a multi-tenant SaaS platform serving the waste management and recycling industry. The platform has three deployment surfaces — a Blazor web portal, MAUI Blazor Hybrid local node clients, and a Cloud API — each with distinct authentication requirements.

The existing architecture uses a custom `IIdentityProvider` abstraction backed by ASP.NET Identity, supporting three authentication paths (Enterprise SSO, Social OAuth, Custom Credentials) and offline-capable local node authentication with SQLite caching.

Azure AD B2C was evaluated as an alternative to determine whether a managed identity platform would better serve the product's multi-tenant, multi-surface authentication needs.

### Requirements Driving This Decision

1. **Offline authentication** — Local node clients (MAUI Blazor Hybrid) must authenticate operators via PIN when disconnected from the cloud. New users cannot be added offline, but cached users must be able to log in.
2. **Device-bound tokens** — Hardware devices (cash recyclers) require JWTs cryptographically tied to device serial number and MAC address for license validation.
3. **Schema-per-tenant identity isolation** — Each tenant's ASP.NET Identity tables (`AspNetUsers`, `AspNetRoles`, etc.) live in a tenant-specific database schema, enforced via `DbContext.HasDefaultSchema` at runtime.
4. **Subdomain-per-tenant routing** — Tenant context is resolved from the subdomain (`*.recycleriq.com`) via middleware before any authentication flow begins.
5. **PIN-based operator login** — Operators authenticate with a 4-digit PIN on a shared device. This is the default authentication method at the point of sale.
6. **Multiple credential types** — The platform must support PIN, username/password, and future credential types (badge scan, biometric) through a single interface contract.
7. **Provider swappability** — Enterprise customers may federate with Azure Entra ID, Google Workspace, or Active Directory. The platform must support adding new providers without modifying business logic.

---

## Decision

**Use the `IIdentityProvider` abstraction with ASP.NET Identity. Do not use Azure AD B2C.**

All authentication flows — cloud and local — will continue to be managed through the polymorphic `IIdentityProvider` interface with ASP.NET Identity handling user management, roles, claims, and the permission bitmask.

---

## Rationale

### Why B2C Was Rejected

| Requirement | IIdentityProvider + ASP.NET Identity | Azure AD B2C |
|---|---|---|
| Offline PIN authentication | `LocalIdentityProvider` validates against SQLite cache. `ResilientIdentityProvider` decorator provides cloud-first with local fallback. | Cloud-only. No offline authentication story. Would require a parallel local auth system anyway. |
| Device-bound JWTs | Self-issued JWTs from `POST /api/v1/auth/login` with custom claims (`deviceId`, `storeId`, `tenantId`, hardware binding). | B2C issues tokens from its own authority. Custom claims require policy XML. Device-binding requires custom token issuance B2C doesn't support. |
| Schema-per-tenant isolation | ASP.NET Identity tables scoped per tenant schema (`tenant_a.AspNetUsers`). DbContext schema set dynamically at runtime. Full data isolation. | B2C uses a shared directory. Tenant isolation is logical (custom attributes), not physical. Does not support schema-per-tenant. |
| Subdomain-per-tenant routing | Middleware extracts subdomain, resolves tenant from master DB, sets `HttpContext.Items["TenantId"]` before auth. Clean separation. | B2C tenant disambiguation requires custom policies or multiple B2C tenants. Adding complexity with no benefit. |
| PIN-based login | `PinCredentials` record handled natively by `IIdentityProvider.AuthenticateAsync`. | B2C has no PIN flow. Would require Resource Owner Password Credentials (ROPC) grant with a custom policy — fragile and discouraged by Microsoft. |
| Provider swappability | New providers require only a new `IIdentityProvider` implementation in the Infrastructure layer. Business logic unchanged. | B2C handles this well via identity provider federation. However, the abstraction already provides this without B2C's overhead. |
| Cost | ASP.NET Identity is free. Infrastructure cost is Azure SQL (already provisioned). | B2C pricing per authentication. At scale with high-frequency PIN logins on local nodes, cost is non-trivial and unpredictable. |
| Complexity | Standard .NET patterns. Team has full control over auth flows, token issuance, and claims. | Custom Policy XML (Identity Experience Framework) for any non-standard flow. Steep learning curve. Debugging is painful. |

### Why B2C Was Considered

- **Enterprise SSO federation** — B2C simplifies adding external identity providers. However, direct OIDC integration with Azure Entra ID / Google Workspace is already documented and implemented via the Enterprise SSO authentication path.
- **Built-in MFA, password reset, email verification** — Useful managed features. ASP.NET Identity handles user management; MFA is identified as a gap to address separately (see Action Items).
- **Microsoft-managed security patching** — Valid benefit, but the custom architecture uses well-established ASP.NET Identity patterns with standard JWT issuance. The attack surface is comparable.

### Separate Product Consideration

Lewers Logic LLC operates a separate legal SaaS product (CourtListener MCP Server) where Azure AD B2C **is** the appropriate choice:

- Cloud-only — no offline requirements
- No device-bound tokens
- Enterprise law firm customers likely already on Azure AD
- Standard OAuth/OIDC flows are sufficient

**These will be completely separate B2C instances with no shared identity plane.** The Recycler.IQ identity architecture and the legal product's B2C tenant are fully independent.

---

## Consequences

### Positive

- Full control over authentication flows, token issuance, and claims across all deployment surfaces (cloud, local online, local offline).
- Schema-per-tenant identity isolation enforced at the database level — stronger than B2C's logical separation.
- No vendor lock-in to Azure AD B2C pricing or custom policy XML.
- The `IIdentityProvider` abstraction enables future provider additions (badge, biometric) without modifying the interface contract.
- The `ResilientIdentityProvider` decorator pattern cleanly handles the online/offline transition.
- Team maintains full debuggability — no opaque B2C policy execution to troubleshoot.

### Negative

- The team is responsible for implementing MFA, password reset flows, email verification, and account lockout — features B2C provides out of the box.
- Security patching and vulnerability response for auth flows is the team's responsibility.
- Enterprise SSO federation requires manual OIDC configuration per provider (vs. B2C's built-in federation UI).

### Neutral

- Token refresh, rotation, and revocation must be designed and implemented (would also need customization in B2C for device-bound scenarios).
- Rate limiting on auth endpoints is the team's responsibility regardless of B2C usage.

---

## Action Items — Authentication Gaps

The following gaps were identified during this evaluation and must be addressed in subsequent ADRs or PRD updates:

### 1. Refresh Token Rotation and Revocation

**Status:** Not documented
**Priority:** High
**Description:** JWTs and refresh tokens are documented in the Cloud API PRD, but there is no strategy for refresh token rotation (issuing a new refresh token on each use), token blacklisting, or server-side revocation. A compromised refresh token currently has no revocation path.
**Recommendation:** Implement sliding-window refresh token rotation with server-side token family tracking. Revoke all tokens in a family if a previously-used refresh token is replayed (indicates theft).

### 2. SQLite Cache Expiration

**Status:** TBD in Cloud API PRD
**Priority:** High
**Description:** The offline authentication cache expiration is undecided. The PRD suggests 7–14 days, configurable per tenant.
**Recommendation:** Default to 7 days for standard tenants, configurable up to 14 days for tenants with extended offline requirements (e.g., rural sites with intermittent connectivity). Enforce re-authentication against the cloud API when the cache expires.

### 3. PIN Lockout Policy

**Status:** TBD in MAUI PRD
**Priority:** Medium
**Description:** The MAUI PRD specifies a 3-attempt limit with lockout duration TBD.
**Recommendation:** 3 failed attempts → 5-minute lockout. 3 consecutive lockouts → require admin unlock. Lockout state stored in SQLite and synced to cloud on reconnection.

### 4. Multi-Factor Authentication (MFA)

**Status:** Not mentioned in any document
**Priority:** High
**Description:** MFA is not documented anywhere in the platform architecture. Tax authority customers may require MFA for compliance (government data handling, PCI-adjacent requirements for cash management).
**Recommendation:** Implement TOTP-based MFA (RFC 6238) for web portal login. MFA should be tenant-configurable (required, optional, disabled). Local node PIN login is exempt — the physical device presence serves as a factor. Admin mode on local nodes should support MFA when online.

### 5. Rate Limiting on Auth Endpoints

**Status:** Not documented
**Priority:** Medium
**Description:** No rate limiting is documented for authentication endpoints (`/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/switch-tenant`).
**Recommendation:** Implement ASP.NET Core rate limiting middleware. Suggested limits: 10 login attempts per IP per minute, 5 failed attempts per account per 15 minutes (triggers temporary lockout), 30 token refresh requests per device per hour.

### 6. Token Storage in Blazor Portal

**Status:** Ambiguous — docs say "localStorage or SessionStorage"
**Priority:** High
**Description:** The Blazor Portal PRD does not specify which browser storage mechanism to use for JWTs, nor does it address XSS mitigation. `localStorage` is accessible to any JS running on the page.
**Recommendation:** Use `HttpOnly`, `Secure`, `SameSite=Strict` cookies for refresh tokens. Access tokens can remain in memory (JS variable) with short expiry (15 minutes). Never store tokens in `localStorage`.

### 7. Audit Logging for Auth Events

**Status:** Partially documented (tenant switching has audit trail)
**Priority:** Medium
**Description:** Tenant switching audit logging is mentioned in the Blazor Portal PRD, but comprehensive auth event logging is not documented. Login, logout, failed attempts, token refresh, MFA challenges, password resets, and permission changes should all be auditable.
**Recommendation:** Implement structured auth event logging to a dedicated audit table. Events should include: timestamp, user ID, tenant ID, event type, IP address, device ID (if applicable), success/failure, and failure reason. Retention policy TBD per tenant compliance requirements.

---

## References

- `authentication-identity-decisions.md` — Core identity provider abstraction and authentication paths
- `database-architecture-decisions.md` — Schema-per-tenant isolation and master/registry database
- `PRD_CloudAPI.md` — Sections 5.1–5.5 (Identity, Subdomain Routing, Offline Auth, JWT, RBAC)
- `PRD_BlazorPortal.md` — Sections 2, 5 (Authentication Flow, Authorization)
- `PRD_MAUIBlazorHybrid.md` — Sections 3.2.1, 4.3.1, 6.1 (PIN Login, SQLite Schema)
- `Master_PRD_v3.md` — Section 6 (Roles & Permissions)
