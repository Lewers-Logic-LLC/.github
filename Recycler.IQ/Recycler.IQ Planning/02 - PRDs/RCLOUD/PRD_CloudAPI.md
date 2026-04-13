# Recycler.IQ Cloud API — Sub-PRD

**Company:** Lewers Logic LLC

**Document Version:** 1.0
**Date Created:** 2026-03-22
**Owner:** Engineering Team
**Status:** Final

---

## 1. Overview

### Purpose
The **Recycler.IQ Cloud API** is the central backend service that powers the Recycler.IQ cash recycler management platform. It provides:
- **Real-time data synchronization** between edge devices (cash recyclers) and the cloud
- **Multi-tenant isolation** for Retail and Tax Authority customers
- **Regulatory compliance** through audit logging, transaction tracking, and tax collection workflows
- **Operational intelligence** via reporting, analytics, and ML-driven forecasting
- **Device lifecycle management** (registration, configuration, licensing)
- **Billing & license issuance** for SaaS monetization

The API is consumed by:
1. **Edge Devices** (cash recyclers): push transactions, inventory, heartbeats; pull config, licenses, user updates
2. **Admin Portal** (Blazor WASM): tenant & user management, reporting, analytics
3. **Mobile App** (MAUI Hybrid): field operations for CIT coordinators, store managers
4. **Installer Service**: fetch deployment packages, register new devices
5. **Internal Tools**: billing reconciliation, support dashboards

### References
- **Master PRD:** Master_PRD_v3.docx (in Recycler.IQ project folder)
- **Tech Stack:** ASP.NET Core 10, Azure App Service, Azure SQL, EF Core 10, MediatR, Azure Service Bus, Serilog, OpenTelemetry
- **Team:** 3 developers
- **Go-to-Market Priority:** Tax Authority first, Retail second

---

## 2. Architecture

### 2.1 Clean Architecture Layers
<!-- Jira: RCLOUD-11 | Epic: RCLOUD-1 | Synced: 2026-04-11 | Note: Scaffold repo -->

```
┌─────────────────────────────────────────────────────────┐
│  API Layer (REST Endpoints, Middleware, Auth)           │
│  → [ProductName].API                                      │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Application Layer (CQRS, MediatR Handlers, DTOs)       │
│  → [ProductName].Application                              │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Domain Layer (Entities, Aggregates, Events)            │
│  → [ProductName].Domain                                   │
└─────────────────────┬───────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────┐
│  Infrastructure Layer (EF Core, Service Bus, Key Vault)  │
│  → [ProductName].Infrastructure                           │
│  ← Depends on Application & Domain (inversion of control)│
└─────────────────────────────────────────────────────────┘

Cross-cutting: [ProductName].Common (constants, helpers)
```

### 2.2 Project Responsibilities

#### **[ProductName].API**
- ASP.NET Core 10 REST endpoints
- Middleware: tenant context extraction, JWT validation, error handling, logging
- HTTPS enforcement, CORS policies
- OpenAPI/Swagger documentation
- Health checks, readiness probes for Azure App Service
- Request/response logging via Serilog
- OpenTelemetry instrumentation (outbound calls to Service Bus, SQL, etc.)

#### **[ProductName].Application**
- MediatR CQRS command/query handlers
- Business logic orchestration
- DTOs for API contracts
- Validation rules (FluentValidation)
- Mapper configurations (AutoMapper)
- Service abstractions: `IBillingService`, `ILicenseService`, `IReportingService`, `IForecastingService`
- Background job scheduling (if needed: Hangfire, Service Bus message handlers)

#### **[ProductName].Domain**
- Core domain entities: Tenant, Store, Device, Transaction, License, User, etc.
- Value objects: TenantId, DeviceId, TransactionId, permission bitmasks
- Domain events (soft, no event sourcing — only for audit trail)
- Enums: TenantType, TransactionType, UserRole, DeviceStatus, LicenseStatus
- **ZERO external dependencies** — framework-agnostic

#### **[ProductName].Infrastructure**
- EF Core DbContext & migrations
- Repository pattern implementations
- Azure Service Bus messaging client
- Azure Key Vault secrets access
- Serilog/OpenTelemetry sink configurations
- `IBillingService` platform-specific implementations (QuickBooks / Salesforce adapters)
- Email service, SMS service (if needed)

#### **[ProductName].Common**
- Global enums, constants, exceptions
- Extension methods, helper utilities
- Pagination, filtering DTOs
- Standard API response wrappers

### 2.3 Dependency Flow

```
API → Application ↗
         ↓         ↖ Domain
Infrastructure → Application
        ↓
     Domain

Key Rule: Domain has NO external dependencies.
```

---

## 3. API Endpoints

All endpoints require **Bearer JWT token** (self-issued by API).
All responses follow standard format:
```json
{
  "success": true,
  "data": { ... },
  "errors": [ ... ]
}
```

### 3.1 Sync Endpoints (Edge → Cloud)
<!-- Jira: RCLOUD-45,RCLOUD-46,RCLOUD-47,RCLOUD-48,RCLOUD-49,RCLOUD-50,RCLOUD-51,RCLOUD-52,RCLOUD-53 | Epic: RCLOUD-6 | Synced: 2026-04-11 -->

**Base Path:** `/api/v1/sync`

| Endpoint | Method | Purpose | Auth | Rate Limit |
|----------|--------|---------|------|-----------|
| `/sync/transactions` | POST | Batch upload transactions from device | Device JWT | ⚠ TBD |
| `/sync/inventory` | POST | Upload inventory snapshot (cash, coins, media) | Device JWT | ⚠ TBD |
| `/sync/heartbeat` | POST | Device keep-alive & status report | Device JWT | ⚠ TBD |

**Request Example (Transactions):**
```json
{
  "deviceId": "DEV-12345",
  "storeId": "STORE-001",
  "timestamp": "2026-03-22T15:30:00Z",
  "transactions": [
    {
      "id": "TXN-UUID",
      "type": "Deposit",
      "amount": 500.00,
      "currency": "USD",
      "denomination": { "notes": { "100": 2, "20": 5 }, "coins": { "1": 0 } },
      "operator": "OPR-001",
      "timestamp": "2026-03-22T15:25:00Z",
      "metadata": { "shift": "morning", "batch": 3 }
    }
  ],
  "clientTimestamp": "2026-03-22T15:30:00Z"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "syncId": "SYNC-UUID",
    "recordsAccepted": 5,
    "recordsRejected": 0,
    "nextSyncWindow": "2026-03-22T16:00:00Z",
    "conflicts": []
  }
}
```

---

### 3.2 Cloud → Device Endpoints
<!-- Jira: RCLOUD-42,RCLOUD-43 | Epic: RCLOUD-5 | Synced: 2026-04-11 -->

**Base Path:** `/api/v1/sync`

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/sync/users/{storeId}` | GET | Fetch user list for store | Device JWT |
| `/sync/users/{storeId}` | PUT | Update user access (batch) | Device JWT |

**Response (Fetch Users):**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "USR-001",
        "name": "John Operator",
        "email": "john@store.com",
        "role": "Operator",
        "permissions": 255,
        "status": "Active",
        "lastModified": "2026-03-20T08:00:00Z"
      }
    ],
    "lastSyncToken": "TOKEN-XYZ",
    "timestamp": "2026-03-22T15:30:00Z"
  }
}
```

---

### 3.3 Device Configuration Endpoints
<!-- Jira: RCLOUD-39,RCLOUD-42 | Epic: RCLOUD-5 | Synced: 2026-04-11 -->

**Base Path:** `/api/v1/devices`

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/devices/register` | POST | Register new device (installer) | ⚠ API Key or Basic Auth |
| `/devices/{deviceId}/config` | GET | Fetch device configuration | Device JWT |
| `/devices/{deviceId}/config` | PATCH | Update device settings | Tenant Admin JWT |
| `/devices/{deviceId}/status` | GET | Check device status & health | Device JWT |

**Register Request (from Installer):**
```json
{
  "serialNumber": "RCL-A2026-0001",
  "model": "RCL-5000",
  "storeId": "STORE-001",
  "storeName": "Downtown Branch",
  "region": "US-West-2",
  "installerKey": "INST-KEY-XXXXX",
  "deviceMetadata": {
    "hostname": "rcl-5000-001.local",
    "osVersion": "10.0.19045",
    "apiVersion": "1.0.0"
  }
}
```

**Config Response:**
```json
{
  "success": true,
  "data": {
    "deviceId": "DEV-12345",
    "storeId": "STORE-001",
    "syncInterval": 300,
    "reportingInterval": 3600,
    "maxOfflineWindow": 86400,
    "denomination": {
      "notes": ["100", "50", "20", "10", "5", "1"],
      "coins": ["1", "0.25", "0.10", "0.05", "0.01"]
    },
    "encryptionKey": "ENC-KEY-XXXXX",
    "tlsCertificate": "CERT-XXXXX"
  }
}
```

---

### 3.4 License & Validation Endpoints
<!-- Jira: RCLOUD-54,RCLOUD-55,RCLOUD-56,RCLOUD-57 | Epic: RCLOUD-7 | Synced: 2026-04-11 -->

**Base Path:** `/api/v1/license`

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/license/validate` | POST | Validate device license (from edge) | Device JWT |
| `/license/issue` | POST | Issue new license (internal) | Tenant Admin JWT |
| `/license/{licenseId}` | GET | Fetch license details | Tenant Admin JWT |

**Validate Request:**
```json
{
  "deviceId": "DEV-12345",
  "licenseId": "LIC-UUID",
  "timestamp": "2026-03-22T15:30:00Z"
}
```

**Validate Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "licenseId": "LIC-UUID",
    "expiresAt": "2026-12-31T23:59:59Z",
    "features": ["edge_sync", "transaction_reporting", "tax_collection"],
    "nextValidationRequired": "2026-03-29T15:30:00Z"
  }
}
```

---

### 3.5 Reporting Endpoints
<!-- Jira: RCLOUD-44 | Epic: RCLOUD-5 | Synced: 2026-04-11 -->

**Base Path:** `/api/v1/reports`

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/reports/transactions` | GET | Query transactions (filters, pagination) | Tenant Admin JWT |
| `/reports/inventory` | GET | Inventory summary by store/device | Tenant Admin JWT |
| `/reports/cash-in-transit` | GET | CIT event log with status | TaxAuthorityProfile or Operator |
| `/reports/audit-log` | GET | Compliance audit trail | System Admin, Regional Manager |
| `/reports/forecast` | GET | ML-driven cash demand forecast | Tenant Admin JWT |

**Query Example (Transactions):**
```
GET /api/v1/reports/transactions?storeId=STORE-001&startDate=2026-03-01&endDate=2026-03-22&transactionType=Deposit&pageSize=50&pageNumber=1
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "TXN-UUID",
        "deviceId": "DEV-12345",
        "storeId": "STORE-001",
        "type": "Deposit",
        "amount": 500.00,
        "operator": "OPR-001",
        "timestamp": "2026-03-22T15:25:00Z",
        "syncedAt": "2026-03-22T15:30:00Z"
      }
    ],
    "totalCount": 1250,
    "pageSize": 50,
    "pageNumber": 1,
    "totalPages": 25
  }
}
```

---

### 3.6 Installer & Package Distribution Endpoints

**Base Path:** `/api/v1/installer`

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/installer/package` | GET | Download latest device firmware/app | API Key or Installer Token |
| `/installer/package/{version}` | GET | Fetch specific version | API Key |
| `/installer/status` | GET | Latest package metadata & version | Public or API Key |

**Package Response:**
```json
{
  "success": true,
  "data": {
    "packageId": "PKG-v1.2.0",
    "version": "1.2.0",
    "releaseDate": "2026-03-20T00:00:00Z",
    "downloadUrl": "https://api.recycler-iq.com/packages/installer-v1.2.0.zip",
    "checksum": "SHA256:XXXXX",
    "changelog": "...",
    "requiredVersion": "1.0.0",
    "deprecated": false
  }
}
```

---

## 4. Multi-Tenancy & Data Isolation (ADR 2)
<!-- Jira: RCLOUD-17,RCLOUD-18,RCLOUD-19,RCLOUD-20,RCLOUD-21,RCLOUD-22,RCLOUD-23 | Epic: RCLOUD-2 | Synced: 2026-04-11 -->

### 4.1 Hybrid Multi-Tenancy Architecture

**Strategy:** System supports two database deployment models to balance cost, performance, and compliance:

#### **Shared Database (Standard Tier)**
- **Default deployment** for most tenants (Retail, Tax Authority, startups)
- Single Azure SQL instance
- Each tenant gets dedicated schema: `[tenant_001]`, `[tenant_002]`, etc.
- **Pros:** Lower cost, shared infrastructure, easy onboarding
- **Cons:** Slight performance noisy-neighbor risk, regulatory constraints (all data in same DB)

#### **Dedicated Database (Enterprise/Upgraded)**
- Tenants can opt into dedicated Azure SQL instance (paid upgrade)
- **Pros:** Guaranteed performance isolation, strict regulatory compliance (full data segregation), easier backup/restore per tenant
- **Cons:** Higher cost, separate infrastructure management
- **Candidates:** Large Tax Authority customers, enterprises with data residency requirements

**Master/Registry Database (Always Accessible):**
- Central database that exists independently of shared/dedicated DB choices
- **Purpose:** Tenant registry, routing config, subscription management
- **Access:** Queried BEFORE DbContext instantiation (no tenant-specific schema needed)
- **Schema (master DB):**
  ```sql
  CREATE TABLE Tenants (
    TenantId NVARCHAR(50) PRIMARY KEY,
    Name NVARCHAR(255),
    Subdomain NVARCHAR(100) UNIQUE,  -- For URL routing
    SubscriptionTier NVARCHAR(50),   -- Starter, Pro, Enterprise
    DatabaseType NVARCHAR(20),       -- 'Shared' or 'Dedicated'
    ConnectionString NVARCHAR(500),  -- Points to shared or dedicated DB
    SchemaName NVARCHAR(50),         -- e.g., 'tenant_001'
    MigrationStatus NVARCHAR(50),    -- 'Pending', 'InProgress', 'Completed'
    Active BIT,
    CreatedAt DATETIME,
    DeactivatedAt DATETIME
  );
  ```

### 4.2 Tenant-Specific Schemas (Shared Database)
<!-- Jira: RCLOUD-30,RCLOUD-31,RCLOUD-32,RCLOUD-33,RCLOUD-34,RCLOUD-35,RCLOUD-36 | Epic: RCLOUD-4 | Synced: 2026-04-11 -->

**Schema Naming Convention:**
```
[tenant_001]    // TenantId "TENANT-001"
[tenant_002]    // TenantId "TENANT-002"
[tenant_tax_au_01]  // Tax Authority: "TAX-AU-01"
```

**Why:** Regulatory isolation (Tax Authority vs Retail), compliance audits per schema, potential future migration per tenant, separate backup/restore capability.

**ASP.NET Identity Tables (Schema-Per-Tenant):**
- `[tenant_001].[AspNetUsers]`
- `[tenant_001].[AspNetRoles]`
- `[tenant_001].[AspNetUserRoles]`
- `[tenant_001].[AspNetRoleClaims]`
- (All schema-scoped, not globally unique)

**Username Uniqueness (Scoped Per Tenant):**
- Username `admin@example.com` can exist in `[tenant_001].[AspNetUsers]` AND `[tenant_002].[AspNetUsers]`
- **Unique constraint:** `UNIQUE(TenantId, Email)` not `UNIQUE(Email)` globally
- **Example:** Both "Retail Chain A" and "Retail Chain B" can have an "admin@example.com" account

### 4.3 Tenant Context Resolution & Routing (ADR 2)

**Routing Flow:**

```
1. HTTP Request arrives at App Service
2. Middleware extracts subdomain from Host header
   Example: From "retailchain.recycleriq.com" → "retailchain"
3. Query Master Database (always accessible)
   SELECT * FROM Tenants WHERE Subdomain = 'retailchain'
4. Retrieve:
   - TenantId = "TENANT-001"
   - DatabaseType = "Shared" or "Dedicated"
   - ConnectionString (points to correct Azure SQL instance)
   - SchemaName = "tenant_001"
5. Store in HttpContext.Items:
   - HttpContext.Items["TenantId"] = "TENANT-001"
   - HttpContext.Items["SchemaName"] = "tenant_001"
   - HttpContext.Items["ConnectionString"] = "..."
6. DbContext Factory instantiates DbContext with resolved connection & schema
7. All EF Core queries automatically scope to [tenant_001] schema via HasQueryFilter()
```

**ITenantConnectionResolver Interface:**
```csharp
public interface ITenantConnectionResolver
{
    Task<TenantResolutionResult> ResolveTenantAsync(string subdomain);
}

public class TenantResolutionResult
{
    public string TenantId { get; set; }
    public string SchemaName { get; set; }
    public string ConnectionString { get; set; }
    public TenantDatabaseType DatabaseType { get; set; }  // Shared or Dedicated
    public bool IsActive { get; set; }
}

public enum TenantDatabaseType
{
    Shared = 1,      // Uses shared Azure SQL instance
    Dedicated = 2    // Uses dedicated Azure SQL instance
}
```

**DbContext Registration (Scoped, Never Singleton):**
```csharp
// In Program.cs
services.AddScoped<ITenantConnectionResolver, TenantConnectionResolver>();
services.AddScoped(provider =>
{
    var tenantId = httpContextAccessor.HttpContext?.Items["TenantId"];
    var schemaName = httpContextAccessor.HttpContext?.Items["SchemaName"];
    var connectionString = httpContextAccessor.HttpContext?.Items["ConnectionString"];

    var dbContext = new ApplicationDbContext(
        new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connectionString)
            .Build()
    );
    dbContext.TenantId = tenantId;
    dbContext.SchemaName = schemaName;
    return dbContext;
});
```

**Critical:** DbContext is ALWAYS Scoped, never Singleton. This ensures:
- Each request gets isolated tenant context
- No cross-tenant data leakage
- Proper disposal per request lifecycle

### 4.4 TenantType Enum

```csharp
public enum TenantType
{
    Retail = 1,          // Cash-heavy retail chains, restaurants
    TaxAuthority = 2     // Government tax collection agencies
}
```

**Implications:**
- **Retail:** Standard transaction reporting, forecasting, device management
- **TaxAuthority:** Stricter audit requirements, Cash-In-Transit (CIT) coordination, immutable transaction logs

### 4.5 Data Isolation Guarantees (Multi-Layer Defense)

**Layer 1: Subdomain + JWT Extraction**
- Subdomain extracted to identify tenant
- JWT validated, tenantId claim verified
- Both must match for request to proceed

**Layer 2: Schema-Level Isolation (EF Core HasQueryFilter)**
- All DbSet<TenantAwareEntity> include automatic filter:
  ```csharp
  modelBuilder.Entity<Transaction>()
      .HasQueryFilter(t => t.TenantId == _currentTenantId);
  ```
- Applied transparently to all LINQ queries
- Prevents accidental cross-tenant data leakage

**Layer 3: Insert/Update Validation**
- Before SaveChanges(), validate all entities match TenantId context
- Reject any entity with mismatched TenantId with 400 BadRequest
- Log attempt with TenantId + UserId for audit

**Layer 4: Authorization Middleware**
- Cross-tenant API calls (e.g., GET /stores/STORE-002 when user only has access to STORE-001) rejected with 403 Forbidden
- StoreIds in JWT claims enforced by controller/handler
- Report queries scoped to authorized stores

**Layer 5: Audit Logging**
- Every operation logs: TenantId, UserId, Action, EntityType, EntityId, OldValues, NewValues, Timestamp, IpAddress
- Immutable audit trail (soft-deleted records marked but never hard-deleted)
- Enables compliance audits per tenant

**Tenant Migration Workflow (Shared → Dedicated):**
- Tenant request upgrade (or auto-triggered by size threshold)
- Provision dedicated Azure SQL instance
- Live migration process:
  1. Create new schema in dedicated DB
  2. Sync data from shared → dedicated (incremental, non-blocking)
  3. Update Master DB routing to point to dedicated instance
  4. Real-time progress visible to tenant via dashboard
  5. Local nodes continue working during migration (no downtime)
  6. After migration, old shared schema can be archived or dropped
- **Rollback:** If migration fails, reroute back to shared DB
- **Open items:** Grace period for rollback TBD, sync conflict resolution strategy TBD, geographic placement TBD, dedicated DB pricing TBD

---

## 5. Authentication & Authorization
<!-- Jira: RCLOUD-24,RCLOUD-25,RCLOUD-26,RCLOUD-27,RCLOUD-28,RCLOUD-29 | Epic: RCLOUD-3 | Synced: 2026-04-11 -->

### 5.1 Identity Provider Abstraction (ADR 1)

**Architecture:** The system uses `IIdentityProvider` interface to abstract identity provider implementations. This eliminates hard coupling to any single identity system and enables multi-provider authentication paths.

**Three Authentication Paths:**

#### **1. Enterprise SSO (OAuth 2.0 / OIDC)**
- Supported providers: Azure Entra ID, Google Workspace, Active Directory
- Flow: Tenant admin configures provider via dashboard, users authenticate via provider's login page
- Tenant context: **Resolved via subdomain** before login (`tenantname.recycleriq.com`)
- Benefits: Enterprise-grade security, no password management, federated identity

#### **2. Social OAuth (Consumer Accounts)**
- Supported providers: Microsoft Account, Google Account (additional OAuth providers TBD)
- Flow: User selects provider, authenticates, returns to app
- Use case: Retail operators, field staff, CIT coordinators
- Scoping: Tenant-scoped — username must be unique within tenant (not globally)

#### **3. Custom Credentials (Username/Password)**
- Backend: ASP.NET Identity (`AspNetUsers`, `AspNetRoles`)
- Flow: Users create account with email + password, login via `/api/v1/auth/login`
- Use case: Test accounts, offline-first scenarios, legacy systems
- Scoping: Username unique per tenant (not globally)

**Authorization Across All Paths:**
- ASP.NET Identity manages all user accounts, roles, and claims regardless of authentication source
- Each authenticated user lands in the same role/permission system (roles, permission bitmasks)
- Claims from SSO providers mapped to ASP.NET roles automatically

### 5.2 Subdomain-Per-Tenant Resolution
<!-- Jira: RCLOUD-27,RCLOUD-28 | Epic: RCLOUD-3 | Synced: 2026-04-11 -->

**Domain Structure:**
```
*.recycleriq.com
├─ retailchain.recycleriq.com         (Retail tenant)
├─ taxauth-ca.recycleriq.com          (Tax Authority tenant)
├─ mystore.recycleriq.com             (Retail tenant)
└─ yourcompanyname.com                (Company website, same App Service)
```

**SSL/TLS:**
- Wildcard certificate `*.recycleriq.com` managed by Azure App Service
- All subdomains covered by single cert
- Renews automatically via Azure

**Tenant Resolution Flow:**
1. User navigates to `retailchain.recycleriq.com`
2. Middleware extracts subdomain → `retailchain`
3. Query master database: `SELECT TenantId FROM Tenants WHERE Subdomain = 'retailchain'`
4. Store `TenantId` in `HttpContext.Items["TenantId"]`
5. All subsequent requests use this context for schema selection & data filtering

**Edge Cases:**
- Root domain (`recycleriq.com`) → Company landing page (no tenant context)
- Invalid subdomain → 404 or redirect to company site
- Multiple subdomains per tenant → Not supported in v1 (future feature)

### 5.3 Offline Authentication (SQLite Cache)

**Scenario:** Store device or mobile app loses internet connection but users need to continue operations.

**Cached Credentials Storage (Local SQLite):**
- Device/mobile app maintains encrypted SQLite database of recently-authenticated users
- Cached fields: UserId, Email, DisplayName, Role, PermissionBitmask, TenantId
- Cache expiration: TBD (recommend 7–14 days, configurable per tenant)
- **Constraint:** New users cannot be added offline; only pre-cached users can authenticate

**Cache Update Flow:**
1. User logs in online → credentials stored in SQLite with timestamp
2. Internet lost → app checks SQLite for cached user
3. If found & not expired → grant access with cached permissions
4. If found but expired → deny login, show "online required" message
5. If not found → deny login
6. When online again → refresh cache, sync permission changes

**Security:**
- Cached passwords: Never stored (use token-based session instead)
- Cached tokens: Encrypted with device-specific key (not in plain text)
- Token validation: Device still validates expiration even offline
- Clear mechanism: Tenant admin can trigger cache clear on all devices (next sync)

### 5.4 JWT Issuance (Self-Issued, Internal Only)

**All authentication paths** (SSO, OAuth, Username/Password) ultimately issue bearer JWTs from the API after successful authentication.

**Issuance Endpoint (Username/Password):**
```
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "admin@retailchain.com",
  "password": "SecurePassword123",
  "tenantId": "TENANT-001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  }
}
```

**Token Claims (User/Admin):**
```json
{
  "tenantId": "TENANT-001",
  "tenantType": "Retail",
  "userId": "USR-001",
  "email": "admin@retailchain.com",
  "role": "TenantAdmin",
  "storeIds": ["STORE-001", "STORE-002"],
  "permissions": 255,
  "iat": 1711099200,
  "exp": 1711185600
}
```

**Device JWT (Self-Issued via Registration):**
```
POST /api/v1/auth/device-login
Content-Type: application/json

{
  "deviceId": "DEV-12345",
  "storeId": "STORE-001",
  "serialNumber": "RCL-A2026-0001",
  "activationCode": "XXXX-XXXX-XXXX"
}
```

**Token Contents (Device):**
```json
{
  "deviceId": "DEV-12345",
  "storeId": "STORE-001",
  "tenantId": "TENANT-001",
  "deviceType": "CashRecycler",
  "permissions": 15,
  "iat": 1711099200,
  "exp": 1711185600
}
```

### 5.2 Role-Based Access Control (RBAC) v1

**Fixed Roles (v1 approach):**

| Role | Domain | Permissions |
|------|--------|-------------|
| **SystemAdmin** | Global | All operations, audit log access, license issuance, billing |
| **TenantAdmin** | Tenant | Tenant config, user mgmt, reporting, forecasting, store mgmt |
| **RegionalManager** | Region | Multi-store oversight, reporting, user creation for stores |
| **StoreManager** | Store | Store config, device mgmt, operator oversight, daily reporting |
| **CITCoordinator** | Store (Tax Authority) | CIT event log, pickup scheduling, delivery confirmation |
| **Operator** | Device | Local transaction entry, shift management, basic reporting |
| **Device** | Edge | Sync operations, config pull, license validation |

**Permission Bitmask (v1):**
```csharp
[Flags]
public enum Permission : byte
{
    None = 0,
    SyncRead = 1,          // Read config, users, licenses
    SyncWrite = 2,         // Push transactions, inventory
    ReportRead = 4,        // Query reports
    AuditLog = 8,          // Access audit trail
    UserManagement = 16,   // Create/update/delete users
    TenantConfig = 32,     // Modify tenant settings
    LicenseManagement = 64,// Issue/revoke licenses
    BillingManagement = 128 // View billing, invoices
}
```

**Access Control Flow:**
```
1. JWT validated (signature, expiry)
2. Extract tenantId, userId, role, permissions
3. Set HttpContext.Items for downstream handlers
4. Authorization filter checks role & permissions
5. Query filters enforce TenantId context

Example: [Authorize(Roles = "TenantAdmin,SystemAdmin")]
         [Permission(Permission.ReportRead)]
```

### 5.5 EF Core Migrations Strategy (ADR 2)

**Shared Database Migrations:**
- Single set of EF Core migrations covers ALL tenant schemas
- Migration script applies to each schema automatically (e.g., `ALTER SCHEMA [tenant_001]...`)
- Example: Adding a new column to Transactions applies to `[tenant_001].[Transactions]`, `[tenant_002].[Transactions]`, etc.
- **Tool:** Custom migration executor that iterates over all active tenants in Master DB

**Dedicated Database Migrations:**
- Each dedicated DB migrated individually using standard EF Core migration tooling
- Decoupled from shared DB migration schedule
- Tenant can choose migration timing (immediate or scheduled maintenance window)

**SQLite Local Storage (Offline & Caching):**
- Device/mobile app maintains local SQLite database for:
  - **Transaction queue:** Pending syncs (encrypted)
  - **Cached users:** Recently-authenticated users (encrypted, with expiration)
  - **Cached config:** Device settings & feature flags
- **Encryption:** Device-specific key stored in secure storage (OS-managed)
- **Cleanup:** Stale entries pruned automatically (configurable retention window)
- **Sync:** When online, local queue replayed to cloud in FIFO order (idempotency ensures no duplicates)

### 5.6 ⚠ Permission Matrix (UNDEFINED)

**Status:** Not yet defined by product team.

**TODO:**
- Map each role to specific permission bitmask values
- Define edge cases (e.g., can RegionalManager modify StoreManager accounts?)
- Document cross-tenant visibility rules
- Finalize device-to-store binding security constraints

---

## 6. Domain Model
<!-- Jira: RCLOUD-37,RCLOUD-38,RCLOUD-39,RCLOUD-40,RCLOUD-41 | Epic: RCLOUD-5 | Synced: 2026-04-11 -->

### 6.1 Core Entities
<!-- Jira: See RCORE-100 through RCORE-110 for domain entity stories (recycleriq-core repo) | Synced: 2026-04-11 -->

#### **Tenant**
```csharp
public class Tenant : AggregateRoot
{
    public TenantId Id { get; set; }
    public string Name { get; set; }
    public TenantType Type { get; set; }
    public string SchemaName { get; set; }
    public bool Active { get; set; }
    public RetailProfile? RetailProfile { get; set; }
    public TaxAuthorityProfile? TaxAuthorityProfile { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? DisabledAt { get; set; }
    public List<User> Users { get; set; }
    public List<Region> Regions { get; set; }
}
```

#### **RetailProfile**
```csharp
public class RetailProfile
{
    public TenantId TenantId { get; set; }
    public int StoreCount { get; set; }
    public int DeviceCount { get; set; }
    public BillingTier BillingTier { get; set; }  // Starter, Pro, Enterprise
    public decimal MonthlyForecastedCash { get; set; }
    public DateTime ContractStartDate { get; set; }
    public DateTime ContractEndDate { get; set; }
}
```

#### **TaxAuthorityProfile**
```csharp
public class TaxAuthorityProfile
{
    public TenantId TenantId { get; set; }
    public string GovernmentId { get; set; }
    public string JurisdictionRegion { get; set; }  // e.g., "California", "Texas"
    public int CITPickupFrequency { get; set; }  // Days between pickups
    public bool RequiresPhotoProof { get; set; }
    public AuditLevel ComplianceLevel { get; set; }  // Standard, Enhanced, Strict
    public DateTime LastAudit { get; set; }
}
```

#### **Region**
```csharp
public class Region
{
    public RegionId Id { get; set; }
    public TenantId TenantId { get; set; }
    public string Name { get; set; }
    public string Code { get; set; }  // US-West-2, EU-Central, etc.
    public bool Active { get; set; }
    public List<Store> Stores { get; set; }
    public RegionalManager? Manager { get; set; }
}
```

#### **Store**
```csharp
public class Store : AggregateRoot
{
    public StoreId Id { get; set; }
    public TenantId TenantId { get; set; }
    public RegionId RegionId { get; set; }
    public string Name { get; set; }
    public string Address { get; set; }
    public string City { get; set; }
    public string PostalCode { get; set; }
    public string Country { get; set; }
    public List<Device> Devices { get; set; }
    public List<User> StaffUsers { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool Active { get; set; }
}
```

#### **Device**
```csharp
public class Device : AggregateRoot
{
    public DeviceId Id { get; set; }
    public TenantId TenantId { get; set; }
    public StoreId StoreId { get; set; }
    public string SerialNumber { get; set; }
    public string Model { get; set; }
    public DeviceStatus Status { get; set; }  // Active, Inactive, Offline, Error
    public DateTime? LastHeartbeat { get; set; }
    public License? CurrentLicense { get; set; }
    public List<Transaction> Transactions { get; set; }
    public DateTime RegisteredAt { get; set; }
    public string? FirmwareVersion { get; set; }
    public string? OSVersion { get; set; }
}

public enum DeviceStatus
{
    Pending = 0,
    Active = 1,
    Inactive = 2,
    Offline = 3,
    Error = 4,
    Decommissioned = 5
}
```

#### **Transaction**
```csharp
public class Transaction : Entity
{
    public TransactionId Id { get; set; }
    public TenantId TenantId { get; set; }
    public DeviceId DeviceId { get; set; }
    public StoreId StoreId { get; set; }
    public TransactionType Type { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; }  // ISO 4217 code
    public DenominationSnapshot Denomination { get; set; }
    public UserId OperatorId { get; set; }
    public DateTime OccurredAt { get; set; }
    public DateTime SyncedAt { get; set; }
    public TransactionStatus Status { get; set; }  // Pending, Synced, Verified, Rejected
    public string? ConflictResolutionNotes { get; set; }
    public Dictionary<string, string> Metadata { get; set; }  // shift, batch, etc.
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public enum TransactionType
{
    Deposit = 1,
    Withdrawal = 2,
    Transfer = 3,
    ShiftOpen = 4,
    ShiftClose = 5,
    TaxCollection = 6
}

public enum TransactionStatus
{
    Pending = 0,
    Synced = 1,
    Verified = 2,  // Tax Authority: CIT verified
    Rejected = 3,
    Reversed = 4
}
```

#### **DenominationSnapshot**
```csharp
public class DenominationSnapshot
{
    public Dictionary<string, int> Notes { get; set; }  // "100" -> 5, "50" -> 2, etc.
    public Dictionary<string, int> Coins { get; set; }  // "1" -> 10, "0.25" -> 4, etc.
    public DateTime CapturedAt { get; set; }
    public string Source { get; set; }  // "Device", "Manual", "Reconciliation"
}
```

#### **License**
```csharp
public class License : AggregateRoot
{
    public LicenseId Id { get; set; }
    public TenantId TenantId { get; set; }
    public DeviceId? DeviceId { get; set; }  // Null = tenant-level license
    public string LicenseKey { get; set; }  // Activation key
    public LicenseType Type { get; set; }  // Device, Store, Tenant
    public List<string> Features { get; set; }  // "edge_sync", "forecasting", "tax_collection"
    public int MaxDeviceCount { get; set; }  // For tenant-level licenses
    public DateTime IssuedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public LicenseStatus Status { get; set; }  // Active, Expired, Revoked, Suspended
    public string? RevokedReason { get; set; }
    public DateTime? RevokedAt { get; set; }
}

public enum LicenseStatus
{
    Active = 1,
    Expired = 2,
    Revoked = 3,
    Suspended = 4
}
```

#### **User**
```csharp
public class User : AggregateRoot
{
    public UserId Id { get; set; }
    public TenantId TenantId { get; set; }
    public StoreId? StoreId { get; set; }  // Null = tenant-level user
    public string Email { get; set; }
    public string DisplayName { get; set; }
    public byte PermissionBitmask { get; set; }
    public UserRole Role { get; set; }
    public UserStatus Status { get; set; }  // Active, Inactive, Suspended
    public string PasswordHash { get; set; }
    public bool MfaEnabled { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public DateTime? DeactivatedAt { get; set; }
}

public enum UserRole
{
    SystemAdmin = 1,
    TenantAdmin = 2,
    RegionalManager = 3,
    StoreManager = 4,
    CITCoordinator = 5,
    Operator = 6,
    Device = 7  // For edge device service accounts
}

public enum UserStatus
{
    Active = 1,
    Inactive = 2,
    Suspended = 3
}
```

#### **CITEvent** (Cash-In-Transit)
```csharp
public class CITEvent : AggregateRoot
{
    public CITEventId Id { get; set; }
    public TenantId TenantId { get; set; }
    public List<StoreId> StoreIds { get; set; }  // Pickup from multiple stores
    public CITStatus Status { get; set; }  // Scheduled, InTransit, Delivered, Disputed
    public decimal TotalAmount { get; set; }
    public DateTime ScheduledPickupAt { get; set; }
    public DateTime? ActualPickupAt { get; set; }
    public DateTime? DeliveredAt { get; set; }
    public string CITProvider { get; set; }  // Brink's, G4S, etc.
    public string TrackingNumber { get; set; }
    public List<string> PhotoProofUrls { get; set; }  // For Tax Authority
    public UserId? CoordinatorId { get; set; }
    public string? DisputeReason { get; set; }
}

public enum CITStatus
{
    Scheduled = 1,
    InTransit = 2,
    Delivered = 3,
    Disputed = 4,
    Cancelled = 5
}
```

#### **AuditLog**
```csharp
public class AuditLog : Entity
{
    public AuditLogId Id { get; set; }
    public TenantId TenantId { get; set; }
    public UserId? UserId { get; set; }
    public string Action { get; set; }  // "User.Create", "Transaction.Sync", "License.Revoke"
    public string EntityType { get; set; }  // Domain entity name
    public string EntityId { get; set; }
    public string? OldValues { get; set; }  // JSON before change
    public string NewValues { get; set; }  // JSON after change
    public string? Reason { get; set; }
    public string IpAddress { get; set; }
    public string UserAgent { get; set; }
    public DateTime Timestamp { get; set; }
    public bool Success { get; set; }
}
```

#### **BillingRecord**
```csharp
public class BillingRecord : Entity
{
    public BillingRecordId Id { get; set; }
    public TenantId TenantId { get; set; }
    public BillingPeriod Period { get; set; }  // 2026-03 or 2026-Q1
    public decimal AmountDue { get; set; }
    public decimal AmountPaid { get; set; }
    public BillingStatus Status { get; set; }  // Draft, Sent, Paid, Overdue, Cancelled
    public string ExternalInvoiceId { get; set; }  // From QuickBooks/Salesforce
    public DateTime CreatedAt { get; set; }
    public DateTime DueAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentMethod { get; set; }
    public BillingLineItem[] LineItems { get; set; }  // Device count, features, support
}

public enum BillingStatus
{
    Draft = 1,
    Sent = 2,
    Paid = 3,
    Overdue = 4,
    Cancelled = 5
}
```

#### **Alert**
```csharp
public class Alert : Entity
{
    public AlertId Id { get; set; }
    public TenantId TenantId { get; set; }
    public string AlertType { get; set; }  // "DeviceOffline", "LicenseExpiring", "AnomalousActivity"
    public string Message { get; set; }
    public AlertSeverity Severity { get; set; }
    public string? TriggeredByEntityType { get; set; }
    public string? TriggeredByEntityId { get; set; }
    public bool Resolved { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ResolvedAt { get; set; }
}

public enum AlertSeverity
{
    Info = 1,
    Warning = 2,
    Critical = 3
}
```

### 6.2 Entity Relationships (Conceptual ER Diagram)

```
Tenant (1) ──── (N) Region
   │
   ├─ (1) ──── (1) RetailProfile
   ├─ (1) ──── (1) TaxAuthorityProfile
   ├─ (1) ──── (N) User
   ├─ (1) ──── (N) Store
   ├─ (1) ──── (N) License
   ├─ (1) ──── (N) CITEvent
   ├─ (1) ──── (N) AuditLog
   ├─ (1) ──── (N) BillingRecord
   └─ (1) ──── (N) Alert

Region (1) ────── (N) Store

Store (1) ────── (N) Device
  │
  └─ (1) ────── (N) User (StaffUsers)

Device (1) ────── (1) License
   │
   └─ (1) ────── (N) Transaction

Transaction
   ├─ FK: DeviceId, StoreId, TenantId, OperatorId
   └─ Contains: DenominationSnapshot (value object)

License (1) ────── (0..1) Device

User (1) ────── (N) AuditLog (UserId as actor)

CITEvent (1) ────── (N) Store (junction: CITEvent.StoreIds)
```

---

## 7. Sync Engine
<!-- Jira: RCLOUD-45,RCLOUD-46,RCLOUD-47,RCLOUD-48,RCLOUD-49 | Epic: RCLOUD-6 | Synced: 2026-04-11 -->

### 7.1 Overview

The **Sync Engine** maintains consistency between edge devices and cloud, handling:
- **Uplink (Device → Cloud):** Transactions, inventory snapshots, device status
- **Downlink (Cloud → Device):** User lists, configuration updates, licenses, feature flags
- **Offline handling:** Grace period for device downtime before alerts/penalties
- **Conflict resolution:** When device and cloud have divergent data states

### 7.2 Sync Rules

#### **Uplink Transactions (Device → Cloud)**
1. **Batching:** Device accumulates transactions, syncs every 5 minutes (configurable)
2. **Deduplication:** Client-side unique ID (TXN-UUID). Cloud rejects duplicate `(deviceId, TxnId)` pairs
3. **Validation:**
   - Amount > 0
   - TransactionType in enum
   - Denomination sum matches amount (within tolerance)
   - OccurredAt <= ClientTimestamp <= Now + 30s (clock skew tolerance)
4. **Idempotency:** Sync request with same `syncId` returns 200 OK with cached result
5. **Partial Success:** If 3 of 5 transactions are invalid, accept valid 3, return details of rejected 2

#### **Uplink Inventory (Device → Cloud)**
1. **Snapshot model:** Device sends complete denomination state every sync
2. **Reconciliation:** Cloud compares against previous snapshot → detects unaccounted-for cash (discrepancies)
3. **Flagging:** Discrepancy > 5% triggers audit alert

#### **Uplink Heartbeat (Device → Cloud)**
1. **Payload:** `{ deviceId, timestamp, status, lastSyncAt, uptime, errorCount }`
2. **Offline detection:** If no heartbeat for > `maxOfflineWindow` (default 24h), mark device Offline
3. **Grace period:** ⚠ TBD — how long before enforcement (suspend license, alert tenant)?

#### **Downlink Users (Cloud → Device)**
1. **Change tracking:** Cloud sends only diffs (added, modified, deleted users)
2. **LastSyncToken:** Device stores `lastSyncToken` from previous pull. Next request includes it for delta fetch
3. **Full resync:** If `lastSyncToken` invalid/expired, cloud returns all users
4. **Deletion propagation:** Deleted users marked with `status = Inactive` (soft delete)

#### **Downlink Config (Cloud → Device)**
1. **Triggering:** Manual update by TenantAdmin, or automatic (version bump, feature rollout)
2. **Delivery:** Device polls `/devices/{deviceId}/config`, cloud checks last-modified timestamp
3. **Caching:** Device caches config with ETag, avoids re-download if unchanged
4. **Rollback:** If config invalid, device reverts to previous version + alerts tenant

### 7.3 ⚠ Conflict Resolution (UNDEFINED)

**Status:** Not yet defined.

**Open Questions:**
1. **Transaction timestamp mismatch:** Device reports OccurredAt = 10:00, but syncs at 14:00 (4h later). Cloud creates at sync time or device time?
   - **Current assumption:** Use `OccurredAt` (device time) as source-of-truth
   - **Fallback:** If `OccurredAt > now()`, reject with 400 BadRequest

2. **Inventory discrepancy (cash mysteriously gone):**
   - **Current approach:** Log alert, flag for manual audit, do NOT auto-correct
   - **Alternative:** Implement fuzzy tolerance (2–5%) before flagging

3. **Device offline > grace period, then comes back online with pending syncs:**
   - **Current assumption:** Accept all pending syncs (idempotency ensures no duplicates)
   - **Question:** Should old syncs be timestamped or discarded?

4. **Duplicate detection with clock skew:**
   - If device sends same transaction twice (clock drift), both have different `OccurredAt`
   - **Current:** Rely on client-generated `TxnId` (UUID), NOT timestamp

**TODO:** Define explicit conflict resolution rules per entity type, get product sign-off.

### 7.4 Offline Handling

**Device Offline Definition:** No successful heartbeat for > 24 hours.

**Actions Upon Detection:**
1. **Hour 1–24:** Grace period. Device continues operating locally, accumulates sync queue
2. **Hour 24:** Cloud marks device `status = Offline`, alerts TenantAdmin
3. **Hour 24–72:** Device can still attempt syncs; if successful, resumes syncing
4. **Hour 72+:** ⚠ License validation failure on next heartbeat. Device may suspend operations (configurable)
5. **Sync Queue:** When device comes back online, replay accumulated syncs in order (FIFO)

**Grace Period Details:**
- ⚠ TBD: Should there be a "grace period" after 24h offline where device can still receive new commands? Or is 24h hard cutoff?
- ⚠ TBD: If device offline > 72h, can tenant still view it in dashboard, or is it archived?

---

## 8. Reporting Engine
<!-- Jira: RCLOUD-44 | Epic: RCLOUD-5 | Synced: 2026-04-11 -->

### 8.1 Overview

The **Reporting Engine** provides multi-dimensional analytics on transactions, devices, inventory, forecasting, and compliance.

### 8.2 Query Capabilities

#### **Transaction Reports**
- **Filters:** Store, Device, Date Range, TransactionType, OperatorId, TenantId
- **Aggregations:** Sum amount, count by type, count by operator
- **Time Series:** Daily, weekly, monthly rollups
- **Export:** CSV, JSON

#### **Inventory Reports**
- **Current Snapshot:** Latest denomination state by device/store
- **Historical Trends:** Denomination changes over time (cash growth/reduction)
- **Discrepancy Report:** Unaccounted-for amounts (cash vs. cloud records mismatch)

#### **CIT Reports** (Tax Authority)
- **Pickup Schedule:** Upcoming CIT events, actual vs. scheduled pickup times
- **Amount Tracking:** Cash delivered to authority per pickup
- **Photo Audit Trail:** Links to photo proof per CIT event
- **Dispute Log:** Unresolved discrepancies between cash-in-transit and recorded amounts

#### **Audit Log**
- **All changes:** User creation, transaction edits, license revokes, config changes
- **Immutable:** Soft-deleted logs marked, never hard-deleted
- **Export:** For compliance audits (XLSX, PDF)

#### **Alerts & Anomalies**
- **Device health:** Offline devices, license expiring, sync failures
- **Cash anomalies:** Large deposits/withdrawals, unusual patterns
- **Forecast variance:** Predicted vs. actual cash (ML model evaluation)

### 8.3 Performance Targets

⚠ **NOT YET DEFINED** — needs SQL query optimization & caching strategy.

**Assumed targets (to be confirmed):**
- Simple report (single store, single day): < 500ms
- Complex report (multi-store, multi-month): < 2s
- Forecast query: < 1s
- Real-time dashboard refresh: < 2s

---

## 9. Billing Integration

### 9.1 IBillingService Abstraction

```csharp
public interface IBillingService
{
    /// <summary>
    /// Create invoice for tenant in external billing system.
    /// </summary>
    Task<BillingResult> CreateInvoiceAsync(
        TenantId tenantId,
        BillingPeriod period,
        List<BillingLineItem> items,
        CancellationToken ct
    );

    /// <summary>
    /// Fetch invoice status from external system.
    /// </summary>
    Task<Invoice> GetInvoiceAsync(string externalInvoiceId, CancellationToken ct);

    /// <summary>
    /// Record payment received.
    /// </summary>
    Task<PaymentResult> RecordPaymentAsync(
        string externalInvoiceId,
        decimal amount,
        DateTime paidAt,
        string paymentMethod,
        CancellationToken ct
    );

    /// <summary>
    /// Fetch tenant subscription/contract details.
    /// </summary>
    Task<Subscription> GetSubscriptionAsync(TenantId tenantId, CancellationToken ct);

    /// <summary>
    /// Validate tenant is in good standing (not past-due).
    /// </summary>
    Task<bool> IsTenantInGoodStandingAsync(TenantId tenantId, CancellationToken ct);
}
```

### 9.2 Billing Models

**Invoice-Based Only** (one-time per billing cycle, no usage-based metering).

**Line Items:**
- Per-store base fee (e.g., $50/month)
- Per-device fee (e.g., $10/device/month)
- Feature add-ons (Tax Collection, Forecasting, Premium Support)
- Prorated adjustments (new store mid-cycle, license refund)

**Billing Cycle:** Monthly (configurable per tenant via `RetailProfile.ContractStartDate`)

### 9.3 Platform Decision ⚠ PENDING

**Status:** Not yet decided which platform to integrate.

**Options:**
1. **QuickBooks Online:** Invoicing, payment tracking, tax reporting
2. **Salesforce Billing Cloud:** Advanced billing, recurring revenue, usage metering (future)

**Implementation Path:**
- Develop `IBillingService` with two adapters
- Deploy with QuickBooks first (simpler)
- Swap to Salesforce later if scaled operations demand it

**TODO:** Get product + finance sign-off on platform choice before Sprint 1 dev.

---

## 10. ML/Forecasting Engine

### 10.1 Status

⚠ **APPROACH UNDECIDED** — feature is in Master PRD but not detailed.

**Known facts:**
- **Goal:** Predict cash demand (next 7, 14, 30 days) per store
- **Inputs:** Historical transaction volume, seasonality, store metadata (type, size, region)
- **Outputs:** Confidence intervals, reorder recommendations
- **Frequency:** Daily model refresh
- **Endpoint:** `GET /api/v1/reports/forecast`

### 10.2 Proposed Models (Brainstorm)

1. **Time-Series Forecasting** (ARIMA, Prophet, LSTM)
   - Pro: Captures seasonality, trend, autocorrelation
   - Con: Requires 6+ months of historical data

2. **Regression** (Linear, XGBoost)
   - Pro: Fast, interpretable coefficients (day-of-week, holiday effects)
   - Con: No temporal structure

3. **Hybrid** (Rule-based baseline + ML adjustment)
   - Use historical average per day-of-week, ML predicts deviation
   - Fallback if model confidence low

### 10.3 Open Questions

- **Training data:** Where is historical data stored? S3, Data Lake, or directly from SQL?
- **Model inference:** Real-time prediction per store, or batch job + cache results?
- **Retraining cadence:** Weekly, monthly?
- **Accuracy metric:** How do we evaluate forecast quality?
- **Explainability:** Can operators see why forecast is X, not Y?
- **Integration:** Does forecasting feed into license upsell (e.g., "buy extra device to handle spike")?

**TODO:** Product team to decide ML approach, allocate budget for DS hire or cloud ML service (Azure ML, SageMaker).

---

## 11. Non-Functional Requirements

### 11.1 Performance

| Metric | Target | Notes |
|--------|--------|-------|
| Sync endpoint latency (p95) | 500ms | Device → Cloud transaction upload |
| Config fetch latency (p95) | 200ms | Device pulls config |
| Report query (single store, single day) | 500ms | SQL + caching |
| Report query (multi-store, multi-month) | 2s | Allow async if needed |
| License validation latency (p95) | 100ms | Device heartbeat validation |
| Forecast generation latency | 1s | On-demand per store |
| ⚠ Rate limiting | TBD | Requests/second per device, per tenant |

### 11.2 Rate Limiting ⚠ UNDEFINED

**Current assumptions:**
- Device sync: 1 req/5 min (12 req/hour)
- Admin report queries: 100 req/min per tenant
- License validation: 1 req/5 min per device

**TODO:** Define rate limit strategy:
- Token bucket (smooth burst) vs. sliding window?
- Per-device, per-tenant, or global?
- Graceful degradation: 429 Too Many Requests or queue requests?

### 11.3 Availability & Uptime

| Target | Value | Notes |
|--------|-------|-------|
| SLA | 99.5% | 3.6 hours downtime/month |
| Max sync backlog | 7 days | Device can queue up to 7 days of offline syncs |
| Disaster Recovery | RTO 4h, RPO 1h | Azure SQL backup, failover |
| Backup frequency | Daily | Full backup + hourly incremental |

### 11.4 API Versioning

**Strategy:** URL-based versioning (`/api/v1/`, `/api/v2/`, etc.)

**Deprecation Policy:**
- New version released → 6 months support for old version
- After 6 months: old version disabled, 403 Forbidden with migration guide
- Major schema changes warrant new version

**Current Version:** v1

**No breaking changes in v1 after GA.**

### 11.5 Error Handling Strategy

**Error Response Format:**
```json
{
  "success": false,
  "data": null,
  "errors": [
    {
      "code": "VALIDATION_ERROR",
      "message": "Amount must be > 0",
      "details": { "field": "amount", "value": -50 },
      "timestamp": "2026-03-22T15:30:00Z"
    }
  ]
}
```

**HTTP Status Codes:**
- **200 OK** — Success
- **201 Created** — Resource created (sync, device register)
- **204 No Content** — Success, no body (config unchanged, ETag match)
- **400 Bad Request** — Validation error, malformed request
- **401 Unauthorized** — Missing/invalid JWT
- **403 Forbidden** — Authorized but insufficient permissions, or cross-tenant access
- **404 Not Found** — Resource does not exist
- **409 Conflict** — Duplicate transaction ID, or stale ETag on config update
- **429 Too Many Requests** — Rate limit exceeded
- **500 Internal Server Error** — Unexpected server error (log TraceId)
- **503 Service Unavailable** — Temporary outage, retry-able

**Error Codes (custom):**
- `VALIDATION_ERROR` — Input validation failed
- `AUTHENTICATION_FAILED` — JWT invalid or expired
- `AUTHORIZATION_FAILED` — User lacks permission
- `RESOURCE_NOT_FOUND` — Entity does not exist
- `CONFLICT` — Duplicate or stale resource
- `RATE_LIMIT_EXCEEDED` — Too many requests
- `EXTERNAL_SERVICE_ERROR` — Billing, Key Vault, Service Bus failure
- `INTERNAL_ERROR` — Unexpected server error

**Logging:**
- All errors logged with TraceId (correlation ID)
- Sensitive data (SSNs, API keys) **never** logged
- Client can reference TraceId for support investigation

### 11.6 Data Encryption

**In Transit:**
- HTTPS/TLS 1.2+ for all API calls
- Mutual TLS (mTLS) for internal service-to-service (future)

**At Rest:**
- Azure SQL: Transparent Data Encryption (TDE) enabled
- Secrets in Azure Key Vault (connection strings, API keys, JWT signing key)
- PII fields (email, name): Consider additional encryption if required by compliance

**Field-Level Encryption:**
⚠ **UNDEFINED** — Does denomination data need encryption? Does audit log need encryption? To be decided based on compliance requirements.

### 11.7 Backup & Disaster Recovery

**Backup Strategy:**
- Full backup: Daily at 2 AM UTC
- Incremental backup: Hourly
- Retention: 30 days

**RTO/RPO Targets:**
- **RTO (Recovery Time Objective):** 4 hours
- **RPO (Recovery Point Objective):** 1 hour (lose up to 1 hour of data)

**Failover Procedure:**
1. Monitor detects Azure SQL unresponsive
2. Alert ops, manual failover to standby region (if configured)
3. Repoint DNS to standby App Service
4. Restore from geo-redundant backup if needed
5. Replay service bus queues to catch up

**Testing:** Quarterly disaster recovery drills.

### 11.8 Scalability

**Expected Load (Year 1):**
- 50–100 tenants
- 500–1000 stores
- 2000–5000 devices
- ~100K transactions/day

**Scaling Strategy:**
- **Horizontal:** Azure App Service auto-scale (2–10 instances based on CPU, memory)
- **Database:** Azure SQL General Purpose tier (32 vCores) + read replicas for reporting
- **Service Bus:** Standard tier, partitioned topics for throughput
- **Static files:** Azure CDN for installer packages, reports

**⚠ Load testing:** Not yet performed. Recommend spike test post-MVP.

---

## 12. Open Items & Gaps

### Critical Path Items

| # | Item | Impact | Status |
|---|------|--------|--------|
| 1 | **Product name finalization** | Branding, docs, API package naming | ⚠ TBD |
| 2 | **Billing platform decision (QuickBooks vs Salesforce)** | Critical for revenue flow | ⚠ TBD |
| 3 | **ML/Forecasting approach** | Feature completeness, hiring, timeline | ⚠ TBD |
| 4 | **Permission matrix (role → bitmask mapping)** | Authorization enforcement | ⚠ TBD |
| 5 | **Conflict resolution rules** | Data consistency, audit trust | ⚠ TBD |
| 6 | **Offline grace period definition** | Device behavior, enforcement | ⚠ TBD |
| 7 | **✓ Authentication & Identity Architecture (ADR 1)** | Multi-provider support, offline access | ✓ RESOLVED |
| 8 | **✓ Database Architecture & Multi-Tenancy (ADR 2)** | Tenant isolation, scaling, compliance | ✓ RESOLVED |

### Technical Gaps

#### **Sync Engine**
- ⚠ Conflict resolution strategy (clock skew, cash discrepancies, offline replay)
- ⚠ Grace period logic for offline devices (when to suspend? to warn?)
- ⚠ Deduplication window (how long to keep seen `(deviceId, TxnId)` pairs?)

#### **Reporting & Analytics**
- ⚠ Performance targets (SLA for complex queries)
- ⚠ Caching strategy (Redis, SQL materialized views, or neither?)
- ⚠ Real-time dashboard architecture (WebSocket or polling?)

#### **ML/Forecasting**
- ⚠ Model selection (ARIMA, Prophet, XGBoost, hybrid)
- ⚠ Training data source & pipeline
- ⚠ Model serving (batch job, real-time API, edge deployment)
- ⚠ Accuracy metrics & evaluation framework

#### **Authentication & Authorization**
- ✓ **RESOLVED (ADR 1):** Identity provider abstraction, three auth paths (Enterprise SSO, Social OAuth, Custom Credentials)
- ✓ **RESOLVED (ADR 1):** Subdomain-per-tenant routing, wildcard SSL cert management
- ✓ **RESOLVED (ADR 1):** Offline auth via cached credentials in SQLite with expiration window
- ⚠ Permission matrix (exact bitmask values per role)
- ⚠ MFA strategy (TOTP, SMS, email codes?)
- ⚠ Session timeout & refresh token rotation policy
- ⚠ Device JWT signing key rotation (how often?)
- ⚠ Third-party OAuth providers (which ones beyond Microsoft/Google? TBD)
- ⚠ Cache expiration window (recommend 7–14 days, TBD)
- ⚠ SSO federation protocols & provider-specific claim mapping (Azure Entra ID, Google Workspace, AD details TBD)

#### **Database Architecture & Multi-Tenancy**
- ✓ **RESOLVED (ADR 2):** Hybrid multi-tenancy (schema-per-tenant in shared DB + dedicated DB option for enterprise)
- ✓ **RESOLVED (ADR 2):** Master/Registry database for tenant routing & subscription management
- ✓ **RESOLVED (ADR 2):** Tenant context resolution via subdomain routing, ITenantConnectionResolver interface
- ✓ **RESOLVED (ADR 2):** EF Core DbContext scoped registration, schema-per-tenant migrations
- ✓ **RESOLVED (ADR 2):** ASP.NET Identity tables schema-per-tenant, username uniqueness scoped per tenant
- ✓ **RESOLVED (ADR 2):** Tenant migration workflow (shared → dedicated, live or scheduled, real-time progress)
- ⚠ Grace period for tenant migration rollback (TBD)
- ⚠ Sync conflict resolution strategy during live migration (TBD)
- ⚠ Geographic placement strategy for dedicated DBs (TBD)
- ⚠ Migration failure rollback procedures (TBD)
- ⚠ Dedicated DB pricing model (TBD)

#### **Billing & Licensing**
- ⚠ Billing platform selection (QB vs. SFDC)
- ⚠ License grace period (can device run X days after expiry?)
- ⚠ Feature flags (which features per license tier?)

#### **Compliance & Security**
- ⚠ Data retention policy (how long to keep transaction logs?)
- ⚠ Field-level encryption requirements (PII, financial data)
- ⚠ Penetration testing plan & OWASP Top 10 hardening
- ⚠ GDPR/CCPA compliance (data export, deletion, right-to-be-forgotten)
- ⚠ SOC 2 Type II audit timeline

#### **Operations**
- ⚠ Monitoring & alerting thresholds (CPU, disk, error rate)
- ⚠ Incident response runbooks (database corruption, mass sync failure)
- ⚠ On-call rotation & escalation policy
- ⚠ Rate limiting strategy (token bucket, sliding window, queuing)

#### **Testing & QA**
- ⚠ Load test targets (concurrent devices, requests/sec)
- ⚠ Chaos engineering / fault injection tests
- ⚠ End-to-end test scenarios (offline sync replay, conflict resolution)
- ⚠ UAT environment & data refresh cycle

### Deferred to Future Sprints

- **Multi-region deployment** (currently single region: Azure West 2)
- **GraphQL API** (REST v1 only for now)
- **Webhook notifications** (tenant push updates)
- **Third-party integrations** (Slack alerts, Datadog, Salesforce Sync API)
- **Advanced forecasting** (ML model, demand-sensing, seasonality)
- **Mobile offline mode** (MAUI app currently online-first)
- **Custom reporting builder** (UI for ad-hoc reports)

---

## Appendix: Key Files & Naming Conventions

### Solution Structure
```
RecyclerIQ.sln
├── src/
│   ├── RecyclerIQ.API/
│   │   ├── Controllers/
│   │   ├── Middleware/
│   │   ├── Program.cs
│   │   └── appsettings.json
│   ├── RecyclerIQ.Application/
│   │   ├── Commands/
│   │   ├── Queries/
│   │   ├── DTOs/
│   │   └── Services/
│   ├── RecyclerIQ.Domain/
│   │   ├── Entities/
│   │   ├── ValueObjects/
│   │   ├── Events/
│   │   └── Enums/
│   ├── RecyclerIQ.Infrastructure/
│   │   ├── Data/
│   │   ├── Migrations/
│   │   ├── Services/
│   │   └── ExternalIntegrations/
│   └── RecyclerIQ.Common/
│       ├── Constants/
│       ├── Extensions/
│       └── Utilities/
└── tests/
    ├── RecyclerIQ.Application.Tests/
    ├── RecyclerIQ.Domain.Tests/
    └── RecyclerIQ.Integration.Tests/
```

### Naming Conventions

**Entities & Value Objects:**
- PascalCase: `Tenant`, `Device`, `Transaction`, `DeviceStatus`
- ID types: `TenantId`, `DeviceId`, `UserId` (strong-typed IDs)

**DTOs:**
- Request: `[Entity]CreateRequest`, `[Entity]UpdateRequest` → `TenantCreateRequest`
- Response: `[Entity]Response` → `TenantResponse`
- Query filter: `[Entity]Filter` → `TransactionFilter`

**Commands & Queries:**
- Command: `Create[Entity]Command`, `Update[Entity]Command` → `CreateTenantCommand`
- Query: `Get[Entity]Query`, `List[Entity]Query` → `ListTransactionsQuery`
- Result: `[Entity]Result` → `TenantResult`

**Endpoints:**
- Snake-case path segments: `/api/v1/sync/transactions`, `/api/v1/devices/config`
- Resource identifiers: `{deviceId}`, `{storeId}` (camelCase, not SCREAMING_SNAKE_CASE)

**Enums:**
- PascalCase: `TransactionType`, `DeviceStatus`, `UserRole`
- Values: PascalCase without underscore: `ShiftOpen`, not `SHIFT_OPEN`

**Database Schemas:**
- Tenant schema: `[tenant_{tenantId}]` → `[tenant_001]`, `[tenant_tax_au_01]`
- Table naming: PascalCase, singular: `Tenant`, `Device`, `Transaction`

---

## Sign-Off

| Role | Name | Date | Status |
|------|------|------|--------|
| Product Owner | ⚠ TBD | – | Pending |
| Tech Lead | ⚠ TBD | – | Pending |
| Engineering Manager | ⚠ TBD | – | Pending |

---

**Document History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-22 | Engineering Team | Initial draft — awaiting team review & product sign-off |

---

**Related Documents:**
- Master_PRD_v3.docx (Recycler.IQ platform overview)
- Architecture Decision Records (ADRs, to be created)
- API Security Baseline (OWASP, TLS, JWT best practices)
- Database Migration & Versioning Strategy
- Deployment & CI/CD Pipeline (GitHub Actions, Azure DevOps)
