# Database Architecture Decisions

**Company:** Lewers Logic LLC
**Product:** Recycler.IQ

**Document Type:** Architecture Decision Record
**Updated:** March 2026
**Status:** Final

---

## Summary

This document captures the database architecture decisions made for the platform. The core principle is a pragmatic hybrid model — start with schema-per-tenant in a shared database for simplicity and cost efficiency at launch, with a clean upgrade path to dedicated databases for enterprise customers or any customer who requests it.

---

## 1. Database Technology

**Decision:** Azure SQL (Microsoft SQL Server) on Azure.

- Relational model — required for tenant, transaction, device, and license entities
- Schema-per-tenant isolation supported natively in SQL Server
- EF Core 10 code-first migrations
- No NoSQL (Firebase, Firestore, etc.) — the data model is inherently relational

---

## 2. Master / Registry Database

**Decision:** A dedicated master database acts as the central tenant registry and routing configuration store.

**Purpose:**
- Always accessible before any tenant DbContext is instantiated
- Stores tenant metadata used for connection routing
- Not tenant-specific — it is platform-level infrastructure

**Master database stores per tenant:**
- Tenant ID and name
- Subscription tier (Standard, Enterprise, etc.)
- Database type flag: `Shared` or `Dedicated`
- Connection string (populated only for dedicated database tenants)
- Schema name (for shared database tenants)
- Account and migration status flags

**Routing flow per request:**
1. Middleware extracts tenant identifier from subdomain
2. Queries master database for tenant configuration
3. Resolves connection string — shared database with schema name, or dedicated database connection string
4. DbContext factory instantiates DbContext with resolved connection
5. Business logic executes against the correct tenant data

---

## 3. Hybrid Multi-Tenancy Model

**Decision:** Schema-per-tenant in a shared database at launch, with support for dedicated databases for enterprise or upgraded customers.

### Standard Customers (Shared Database, Schema-Per-Tenant)
- All standard customers share one Azure SQL database
- Each tenant gets their own schema: `tenant_a.Transactions`, `tenant_b.Transactions`, etc.
- Schema name is resolved at runtime by the DbContext factory from master database config
- Cost efficient — shared infrastructure, no per-tenant database overhead

### Enterprise / Upgraded Customers (Dedicated Database)
- Enterprise customers or any customer who requests it can have their own dedicated Azure SQL database
- Master database stores their dedicated connection string
- DbContext factory routes to their dedicated database — no code changes required
- Enables per-tenant backups, scaling, compliance requirements, and geographic placement

**Upgrade path from shared to dedicated:**
- Updating a tenant's master database record from `Shared` to `Dedicated` with a new connection string is a configuration change only
- No code changes, no recompilation
- Data migration process is required (see Section 5)

---

## 4. ASP.NET Identity & Multi-Tenancy

**Decision:** Schema-per-tenant for ASP.NET Identity tables, consistent with business data isolation.

- Each tenant's identity schema lives in their schema: `tenant_a.AspNetUsers`, `tenant_a.AspNetRoles`, etc.
- DbContext `HasDefaultSchema` is set dynamically at runtime based on current tenant
- ASP.NET Identity tables are never modified directly — schema name is configured via DbContext, not table structure
- This approach is consistent with the overall schema-per-tenant model and provides a clean upgrade path to dedicated databases

**For dedicated database tenants:** Their ASP.NET Identity tables live in their dedicated database, same schema structure.

---

## 5. Tenant Migration: Shared to Dedicated Database

When a tenant upgrades to a dedicated database, the following process executes:

### Trigger
- Tenant Admin logs into the Web Portal and initiates the upgrade
- Upgrade is an optional paid upcharge — pricing TBD
- Two options are presented:
  - **Migrate Now (Live):** Starts immediately with a brief lockout period
  - **Schedule Migration:** Tenant admin picks a date and time for off-peak execution

### Migration Workflow

1. Tenant admin initiates migration via Web Portal
2. System presents upgrade details including cost, process summary, and expected downtime
3. Tenant admin confirms
4. System sets `MigrationInProgress = true` in master database for that tenant
5. All Web Portal users for that tenant are forcibly logged out — **except** the initiating tenant admin
6. Web Portal login is blocked for that tenant with a "Migration in progress" message
7. **Local Node clients continue operating normally** — they write to local SQLite and sync later (seamless to end users)
8. New dedicated database is provisioned with full schema
9. All tenant data is copied from shared schema to dedicated database
10. Data integrity is verified (row counts, checksums)
11. Final validation query runs against both source and destination
12. Master database config is updated: `DatabaseType = Dedicated`, connection string populated
13. `MigrationInProgress` flag is cleared
14. Web Portal logins are re-enabled for that tenant
15. Local Node clients sync queued transactions to the new dedicated database automatically

### Admin Monitoring
- The initiating tenant admin remains logged in throughout the migration
- A migration status page shows real-time progress — rows copied, validation status, completion estimate
- Admin is notified on completion or failure

### Scheduled Migration
- Same workflow as live migration
- Runs automatically at the scheduled time
- Recommended for off-peak hours to minimize any user impact

---

## 6. Local Client Database (SQLite)
<!-- Jira: RLINK-52 | Epic: RLINK-1 | Synced: 2026-04-11 -->

**Decision:** SQLite for all local Node Service storage.

- Transaction queue (SyncStatus: Pending / Synced)
- Cached user credentials and permissions for offline login
- Cached recycler configuration
- Source of truth for local operations until sync completes
- EF Core manages SQLite locally — same repository abstractions as cloud

---

## 7. ORM & Migration Strategy

**Decision:** EF Core 10, code-first migrations.

- Same DbContext abstraction used for both shared and dedicated database tenants
- Schema name resolved dynamically at DbContext instantiation via `ITenantConnectionResolver`
- Migrations applied to shared database cover all tenant schemas
- Migrations for dedicated databases applied individually or on a schedule
- DbContext registered as **Scoped** (never Singleton) — critical for per-request tenant resolution

---

## 8. Open Items

| Item | Status |
|---|---|
| Grace period duration for license enforcement | Not yet defined |
| Sync conflict resolution strategy | Not defined — recommend server-authoritative for cash transactions |
| Dedicated database geographic placement options | Not yet defined |
| Migration failure rollback strategy | Not yet defined |
| Pricing for dedicated database upcharge | To be determined |
