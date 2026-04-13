# Authentication & Identity Decisions

**Company:** Lewers Logic LLC

**Document Type:** Architecture Decision Record
**Updated:** March 2026
**Status:** Final

---

## Summary

This document captures the authentication and identity architecture decisions made for the platform. The core principle is flexibility — no hard coupling to any single identity provider, and support for customers ranging from single-operator small businesses to large enterprises with existing corporate directories.

---

## 1. Identity Provider Abstraction
<!-- Jira: RCORE-109 | Epic: RCORE-95 | Synced: 2026-04-11 -->

**Decision:** Abstract all authentication behind an `IIdentityProvider` interface using a polymorphic credentials model.

**Rationale:** Avoids tight coupling to any specific provider (e.g., Azure Entra ID, Google, Auth0). Switching providers or adding new ones only requires a new Infrastructure layer implementation. Business logic and Application layer remain agnostic.

**Credentials Model:** The interface accepts an abstract `AuthCredentials` type, allowing different credential types without changing the contract:

```csharp
public abstract record AuthCredentials;
public record PinCredentials(string Username, string Pin) : AuthCredentials;
public record PasswordCredentials(string Username, string Password) : AuthCredentials;
// Future: BadgeCredentials, BiometricCredentials, etc.

public interface IIdentityProvider
{
    Task<AuthResult> AuthenticateAsync(AuthCredentials credentials);
    Task<UserClaims?> GetCachedUserAsync(Guid userId);
}
```

This design supports PIN-based operator login, username/password admin login, and future credential types (badge scan, biometric) without modifying the interface.

---

## 2. Authentication Paths

Three authentication paths are supported. The tenant's configuration at onboarding determines which path is used.

### Path 1: Enterprise SSO (Corporate Directory Federation)
- Tenant federates with their own corporate identity directory
- Supported providers: Azure Entra ID, Google Workspace, Active Directory
- Users authenticate through their existing corporate login
- Your platform validates the token, confirms tenant membership, issues your device-bound JWT
- Admins manage users and groups entirely within their own directory — no duplicate user management in your platform

### Path 2: Social / OAuth Login (Non-SSO)
- Users log in with an existing third-party account
- Supported providers: Microsoft Account, Google Account, and others as needed
- Platform validates the OAuth token, maps to local user record, assigns roles
- Suitable for enterprise customers who do not have or do not want SSO federation

### Path 3: Custom Credentials (Username / Password)
- Username and hashed password stored in your database
- Managed via ASP.NET Identity
- Suitable for small customers — single location, one or two operators
- No external provider dependency

**Note:** All three paths feed into ASP.NET Identity's authorization layer. The `[Authorize]` and role-based attributes work identically regardless of which path authenticated the user.

---

## 3. ASP.NET Identity Role

**Decision:** Use ASP.NET Identity for authorization across all authentication paths.

- Handles roles, claims, and permission bitmask
- Custom credential management (Path 3) uses ASP.NET Identity natively
- Social and SSO paths (Paths 1 & 2) validate external tokens, then map to a local ASP.NET Identity user record with roles assigned
- `[Authorize]`, `[Authorize(Roles = "Admin")]` etc. work consistently across all paths

---

## 4. Offline Authentication (Local Node Clients)
<!-- Jira: RLINK-46 | Epic: RLINK-3 | Synced: 2026-04-11 | UserSyncService for offline PIN -->

**Decision:** Cache authenticated user credentials and permissions locally for offline operation. The same `LocalIdentityProvider` implementation serves both offline production and demo mode.

**Flow:**
1. Operator authenticates online via their configured path (SSO, social, or custom credentials)
2. Authenticated user record and permissions/roles are cached locally in SQLite with an expiration window
3. When offline, operator logs in against the local cache
4. When connectivity is restored, cache is refreshed from the Cloud API

**Key Rules:**
- New users cannot be added while offline — they must wait until connectivity is restored and sync completes
- Permission changes (e.g., role revocation) take effect on next sync
- This is an acceptable trade-off — user permissions and group assignments do not change frequently enough to require real-time validation

**Shared Implementation — Demo & Offline Production:**
The `LocalIdentityProvider` validates credentials against local SQLite. In production offline mode, the SQLite cache was populated by a prior cloud sync. In demo mode, it was populated by `DemoDataSeeder`. The provider does not know or care which path seeded the data — the validation logic is identical. This means demo mode exercises the real offline auth code path.

---

## 5. Local Client Identity Providers
<!-- Jira: RCORE-107,RCORE-108,RCORE-109 | Epic: RCORE-95 | Synced: 2026-04-11 -->

**Decision:** Three `IIdentityProvider` implementations compose to cover all local client scenarios.

| Implementation | Purpose | Used When |
|---|---|---|
| `LocalIdentityProvider` | Validates credentials against local SQLite cache | Demo mode (always); Production offline fallback |
| `CloudIdentityProvider` | Validates credentials against Cloud API | Production online |
| `ResilientIdentityProvider` | Decorator — tries `CloudIdentityProvider` first, falls back to `LocalIdentityProvider` | Production mode (wraps both) |

```csharp
// Production: cloud-first with offline fallback
public class ResilientIdentityProvider : IIdentityProvider
{
    private readonly CloudIdentityProvider _cloud;
    private readonly LocalIdentityProvider _local;
    private readonly IConnectivityService _connectivity;

    public async Task<AuthResult> AuthenticateAsync(AuthCredentials credentials)
    {
        if (_connectivity.IsOnline)
        {
            try
            {
                var result = await _cloud.AuthenticateAsync(credentials);
                await _local.CacheUserAsync(result.User); // sync to local cache
                return result;
            }
            catch { /* fall through to local */ }
        }
        return await _local.AuthenticateAsync(credentials);
    }
}
```

**DI Wiring (MauiProgram.cs):**

```csharp
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
```

`RiqAuthenticationStateProvider` is a thin Blazor wrapper that translates `AuthResult` → `ClaimsPrincipal` → `AuthenticationState`. It consumes whichever `IIdentityProvider` is injected. `[Authorize]` and `<AuthorizeView>` work identically in both modes.

---

## 6. Tenant-Configurable Site Authentication Method
<!-- Jira: RCORE-108 | Epic: RCORE-95 | Synced: 2026-04-11 -->

**Decision:** The tenant admin configures a single authentication method per site for operator login. The admin mode always uses username/password regardless of site config.

```csharp
public enum SiteAuthMethod { Pin, Password, Badge /* future */ }
```

This setting is stored in the tenant's site configuration (synced to local SQLite in production, seeded by `DemoDataSeeder` in demo mode). The login page reads `SiteAuthMethod` and renders the appropriate input (PIN pad, username/password form, etc.).

**Default:** `SiteAuthMethod.Pin` — fast numeric entry suitable for cashier/operator workflows.

---

## 7. Local Client Launch Modes

**Decision:** The MAUI local client supports two launch modes controlled by a startup flag.

| Mode | Launch | Login UX | Access |
|---|---|---|---|
| **Operator mode** (default) | Normal launch | Site's configured auth method (PIN, password, etc.) | Operator and admin pages based on role |
| **Admin mode** | `--admin` flag or separate shortcut | Always username/password | System configuration, tenant settings, diagnostics |

**Admin mode** is for system-level functions: tenant configuration, auth method settings, device management, diagnostics. It always requires username/password authentication regardless of the site's operator auth setting.

**Note:** Demo-specific functions like Reset Demo and Create New Demo are **not** admin-mode functions. They are accessible from normal operator mode, guarded by the `TenantAdmin` role, and only visible when `IsDemoMode = true`. This ensures a trade show operator can quickly reset a demo without relaunching the app.

---

## 8. Session Scope for Web Portal vs. Local Clients

| Client | Auth Method | Offline Support |
|---|---|---|
| Web Portal | SSO, Social, or Custom Credentials | No — requires connectivity |
| Local Node — Operator mode | Tenant-configured method (PIN, password, etc.) | Yes — operates fully offline |
| Local Node — Admin mode | Username / Password (always) | Yes — validates against local cache |

---

## 9. Hosting & SSL

**Decision:** Subdomain-per-tenant URL structure.

- Format: `tenantname.recycleriq.com`
- All subdomains point to the same Azure App Service instance
- Tenant is resolved from the subdomain before login — no need to identify tenant at credential entry time
- Username uniqueness is scoped per tenant, not globally

**SSL:** Single wildcard certificate (`*.recycleriq.com`) managed by Azure App Service.
- Covers all tenant subdomains automatically
- Azure handles provisioning and auto-renewal
- No per-tenant certificates required
- No third-party SSL provider needed (GoDaddy, etc.)

---

## 10. Company Website & App Hosting

**Decision:** Host company website and SaaS app in the same Azure App Service.

- Company website: `yourcompanyname.com`
- SaaS application: `recycleriq.com` (and `*.recycleriq.com` for tenant subdomains)
- Both domains bound to the same App Service
- One wildcard SSL cert covers all subdomains for `recycleriq.com`
- Separate SSL cert for company domain
- Economical — no additional hosting cost since App Service is already running

---

## 11. Open Items

| Item | Status |
|---|---|
| Third-party OAuth providers beyond Microsoft and Google | To be determined as needed |
| Cache expiration window duration | Not yet defined |
| SSO federation protocols supported (OpenID Connect, SAML) | To be confirmed |
| Badge/biometric credential types — requirements and timeline | Future — placeholder in AuthCredentials model |
| Admin mode page inventory — which functions require `--admin` launch | To be defined |
