# Recycler.IQ Infrastructure & DevOps PRD

**Company:** Lewers Logic LLC

**Document Version:** 1.0
**Date Created:** 2026-03-22
**Author:** Infrastructure Planning
**Status:** Final
**Audience:** Development Team, Infrastructure Leads

---

## 1. Overview

This document defines the infrastructure, DevOps, and operational patterns for **Recycler.IQ**, a multi-tenant SaaS platform serving 10-50 retail store locations at launch. It is a **sub-PRD** that complements the Master PRD and focuses specifically on infrastructure, deployment, monitoring, and operational concerns.

### References
- **Master PRD:** Core product specification, brand, feature set, architecture decisions
- **Tech Stack:** .NET 10 LTS, Azure cloud, Blazor, EF Core 10, Serilog + OpenTelemetry
- **Team:** 3 developers (1 lead + 2), so automation and simplicity are critical
- **Launch Window:** 10–50 tenants, production-ready observability and resilience

### Key Principles
1. **Automation First:** Every repetitive operational task should be automated.
2. **Vendor-Neutral Observability:** OTel pipeline enables future backend changes without code refactoring.
3. **Schema-Per-Tenant Isolation:** Data isolation at the database schema layer for security and compliance.
4. **Small Team Focus:** Infrastructure must be simple, well-documented, and require minimal manual intervention.
5. **Rapid Scaling:** Azure PaaS services (App Service, SQL, Service Bus) should scale elastically without redesign up to 50–100 tenants.

---

## 2. Azure Resource Architecture

### 2.1 Resource Organization
<!-- Jira: RCLOUD-13,RCLOUD-14,RCLOUD-15 | Epic: RCLOUD-1 | Synced: 2026-04-09 -->

```
Recycler.IQ Azure Subscription
├── Resource Group: riq-prod
│   ├── App Service Plan: riq-api-prod (Dedicated tier minimum)
│   ├── App Service: riq-api-prod (ASP.NET Core API + Blazor Server/WASM)
│   ├── Azure SQL Server: riq-sql-master
│   │   └── Database: riq_master (Master/Registry DB)
│   │       ├── Tenants (TenantId, Name, Tier, DatabaseType, ConnectionString, SchemaName)
│   │       ├── Subscriptions (billing + feature flags)
│   │       └── AuditLog (tenant provisioning events)
│   ├── Azure SQL Server: riq-sql-prod
│   │   ├── Database: riq_shared (hybrid multi-tenancy — standard tier)
│   │   │   ├── dbo.* (shared schemas)
│   │   │   ├── [tenant_001] (schema)
│   │   │   ├── [tenant_002] (schema)
│   │   │   └── [tenant_NNN] (schema)
│   │   ├── Database: [tenant_ent_001] (dedicated DB — enterprise tier)
│   │   └── Database: [tenant_ent_002] (dedicated DB — enterprise tier)
│   ├── Service Bus Namespace: riq-sb-prod
│   │   ├── Topic: orders (fanout to per-tenant subscriptions)
│   │   ├── Topic: inventory
│   │   └── Topic: notifications
│   ├── Key Vault: riq-kv-prod
│   ├── Application Insights: riq-ai-prod (OTel exporter)
│   ├── Storage Account: riqprodlogs (blob for log archival)
│   └── CDN Endpoint: riq-cdn-prod (optional, Blazor WASM caching)
│
├── Resource Group: riq-staging
│   ├── [Replicate prod structure at smaller scale]
│   ├── App Service Plan: riq-api-staging (Shared tier)
│   └── [All other resources scaled down]
│
├── Resource Group: riq-dev
│   ├── [Local dev, minimal resources]
│   ├── Azure SQL: riq-sql-dev (single shared DB)
│   └── Service Bus: riq-sb-dev
│
└── Resource Group: riq-sandbox
    ├── [Tenant-facing sandbox environment]
    ├── Full feature parity with prod (smaller scale)
    └── For customer testing, pre-production validation
```

### 2.2 Core Services

#### **App Service**
- **Tier:** Standard S1 (prod), Shared (dev/staging)
- **Runtime:** .NET 10 LTS on Windows or Linux (recommend Linux for cost)
- **Deployment Slots:** Blue/Green support (see § 4)
- **Always On:** Enabled for prod and staging
- **Custom Domain & SSL:**
  - Company website: `recycleriq.com`
  - Tenant subdomains: `{tenantname}.recycleriq.com` (subdomain-per-tenant architecture)
  - Wildcard SSL Certificate: `*.recycleriq.com` (Azure App Service managed, auto-renewed)
  - HTTPS: Enforced (HTTP → HTTPS redirect on all domains)
- **Managed Identity:** Enabled for Key Vault and Service Bus access

#### **Azure SQL Database**
- **Master/Registry Database** (`riq-sql-master`):
  - **Purpose:** Central tenant routing, configuration, and subscription metadata
  - **Contains:** TenantId, Name, Tier, DatabaseType (Shared|Dedicated), ConnectionString, SchemaName
  - **Size:** Basic tier (5 GB, non-production standard)
  - **Backup Retention:** 35 days (prod)
- **Shared Multi-Tenant Database** (`riq-sql-prod` / `riq_shared`):
  - **Edition:** Standard S1 (prod), Basic (dev)
  - **Storage:** 50 GB (prod) with auto-growth enabled
  - **Tenants:** Standard/Professional tier tenants (10–30 tenants per instance)
  - **Schema Isolation:** Each tenant owns its own schema in the same logical DB
- **Dedicated Database** (`riq-sql-prod` / `[tenant_ent_XXX]`):
  - **Edition:** Standard S2+ or Premium P1 (enterprise tier)
  - **Purpose:** Isolated storage for enterprise/premium tenants
  - **Migration Path:** Standard → Dedicated (live or scheduled via connection string update in Master DB)
- **Common Settings:**
  - **Backup Retention:** 35 days (prod), 7 days (dev)
  - **Point-in-Time Restore (PITR):** Enabled for all environments
  - **Geo-Replication:** ⚠ Not specified (consider for disaster recovery)
  - **Firewall:** App Service → SQL allowed via Managed Identity; no IP rules unless needed
  - **Connection Pooling:** EF Core pool size ≥ 10; Monitor pool utilization at scale

#### **Service Bus**
- **Tier:** Standard (prod), Basic (dev/staging)
- **Topics:** orders, inventory, notifications (pub/sub for multi-consumer scenarios)
- **Subscriptions:** Per-tenant subscriptions for order/inventory topics (automatic routing)
- **Queues:** Dead-letter queues for unprocessed messages (auto-deadletter after max retries)
- **Managed Identity:** App Service authenticates via System Assigned Identity
- **Message TTL:** 14 days (prod), 1 day (dev)

#### **Key Vault**
- **SKU:** Standard (prod/staging), Standard (dev, optional)
- **Secrets:** Database connection strings, API keys, encryption keys
- **Managed Identity Access:** App Service has `Get` and `List` permissions
- **Secret Rotation:** ⚠ Policy and schedule TBD (recommend 90-day rotation for sensitive keys)
- **Audit & Logging:** All access logged to Application Insights

#### **Application Insights**
- **Sampling:** 100% in prod (cost may require sampling strategy at scale)
- **OTel Exporter:** Configured in Serilog pipeline (Seq in dev, App Insights in staging/prod)
- **Log Level (Prod):** Warning and above for infrastructure logs; Debug for business logic
- **Retention:** 90 days (configurable, impacts cost)

#### **Storage Account**
- **Purpose:** Archive logs and database backups for long-term retention
- **Blob Tier:** Hot (dev/recent), Cool (archives >30 days)
- **Lifecycle Policy:** Auto-archive to Cool after 30 days, delete after 365 days
- **Backup:** ⚠ Frequency and retention policy TBD

#### **CDN (Azure Front Door / Static Web Apps)**
- **Purpose:** ⚠ Serve Blazor WASM bundles, static assets globally
- **Caching:** 1 hour for .js/.wasm, 1 day for index.html
- **WAF:** Enable DDoS protection and rate limiting rules
- **Custom Domain:** riq-cdn.ashely.cloud

---

## 3. Environment Strategy

### 3.1 Environment Matrix

| Env | Tier | SQL Tier | Use Case | Scale | Auto-Scale | Multi-Tenancy |
|-----|------|----------|----------|-------|-----------|----------------|
| **prod** | Standard S1 | S1 (shared) + Premium (dedicated) | Live customer data | 10–50 tenants | Yes, 1–3 instances | Hybrid: Schema-per-tenant (shared) + Dedicated DBs (enterprise) |
| **staging** | Standard S1 | S0 | Pre-release testing, UAT | 2–3 tenants | No, 1 instance | Shared only (testing) |
| **sandbox** | Basic B1 | Basic | Customer trials, demos, pre-sales | 1–5 tenants | No, 1 instance | Shared only (testing) |
| **dev** | Shared | Basic | Developer local/CI testing | Shared | No, 1 instance | Shared only (testing) |

### 3.2 Data Flow & Tenant Allocation

**Production Environment:**
- All live, paying tenants (10–50 at launch)
- Strict access controls (IP allowlisting for API calls)
- High availability, backups, monitoring

**Staging Environment:**
- Replica of prod codebase + config
- Clone of prod data (anonymized) for realistic testing
- Pre-release validation before prod deployment
- Accessible only by internal team

**Sandbox Environment:**
- Used for customer acceptance testing, product demos, trials
- Data is not sensitive; can be reset/wiped
- Accessible by internal team + designated customer contacts
- Rollout new features for beta testing

**Development Environment:**
- Local developer machines + CI/CD test environments
- Shared cloud resources for integration testing
- Data is synthetic/test data only

### 3.3 Tenant Tagging & Isolation

Every tenant is tagged with metadata:
```json
{
  "tenant_id": "tenant_001",
  "environment": "production",
  "status": "active",
  "region": "us-east-1",
  "created_at": "2026-01-15",
  "tier": "professional"
}
```

**Sandbox/Demo tenants** have `environment: "sandbox"` tag and are **never** mingled with production data.

---

## 4. CI/CD Pipeline
<!-- Jira: RCLOUD-12 | Epic: RCLOUD-1 | Synced: 2026-04-09 -->

### 4.1 Overview

**Pipeline Tool:** ⚠ GitHub Actions (assumed, but Azure DevOps is alternative)
**Repository:** GitHub (assumed monorepo or dedicated API/App repos)
**Trigger:** Push to main, pull requests, manual triggers

### 4.2 Pipeline Stages

```
┌─ On PR:
│  ├─ Code Lint (StyleCop, Roslyn)
│  ├─ Unit Tests (xUnit)
│  ├─ OWASP SCA (Snyk, Dependabot)
│  ├─ Build artifacts (nupkg, Docker image)
│  └─ Deploy to dev slot for E2E tests
│
├─ On Merge to main:
│  ├─ Re-run all PR checks
│  ├─ Integration Tests (SQL + Service Bus)
│  ├─ Database migration dry-run (EF Core)
│  ├─ Build prod artifacts
│  ├─ Push image to Azure Container Registry (ACR)
│  ├─ Deploy to staging slot (blue)
│  ├─ Smoke tests (API health, DB connectivity)
│  ├─ Manual approval gate (team lead)
│  ├─ Swap staging to prod (blue/green)
│  └─ Monitor error rates for 15 min (auto-rollback if >5% errors)
│
└─ Database Migrations:
   ├─ Dry-run against test DB (replica of prod schema)
   ├─ Generate migration script (EF Core)
   ├─ Review by lead + DBA (if available)
   ├─ Apply to staging first
   ├─ Validate data integrity
   ├─ Schedule for prod deployment window
   └─ Per-tenant schema migration (parallel)
```

### 4.3 Branch Strategy

- **main:** Production code. Deployments are automatic after approval gate.
- **develop:** Integration branch. Pre-release testing.
- **feature/\*:** Individual features. PR → develop → main.
- **hotfix/\*:** Emergency patches from main. Merged directly + backported to develop.

### 4.4 Artifact Management

- **Docker Images:** Push to Azure Container Registry (ACR)
  - Tag: `latest`, `v{semver}`, `{git-sha}`
  - Scan for vulnerabilities (ACR native scanning)
  - Retention: Keep last 10 tags, delete older
- **NuGet Packages:** Internal packages (if split) → Azure Artifacts or GitHub Packages
- **Database Migrations:** Stored in repo (`/src/Migrations/`), applied via EF Core tooling

### 4.5 Deployment Strategy

**Blue/Green with App Service Deployment Slots:**
1. Current prod = Green slot (0.5 instances warm-up traffic)
2. New release = Blue slot (standard instance count)
3. Run smoke tests on Blue
4. Swap Green ↔ Blue (instant, zero downtime)
5. Monitor error rates for 15 min; auto-rollback if > 5%

**Rollback Procedure:**
- Manual swap back to previous Green slot
- Revert DB migrations if schema changed (requires downtime or dual-schema support)
- ⚠ **Rollback cost:** If DB migration is breaking, rollback may require intervention

### 4.6 Secrets Management

- **GitHub Secrets:** Store sensitive env vars (GitHub only, not in code)
- **Key Vault:** Production secrets (connection strings, API keys, encryption keys)
- **Managed Identity:** App Service authenticates to Key Vault at runtime (no secret in env)
- **Rotation:** ⚠ TBD (recommend automated rotation every 90 days)

---

## 5. Infrastructure as Code
<!-- Jira: RCLOUD-16 | Epic: RCLOUD-1 | Synced: 2026-04-09 -->

### 5.1 IaC Strategy

**Tool:** ⚠ Azure Bicep (recommended for Azure-native, simpler than Terraform)
Alternative: Terraform (for multi-cloud portability)

**Approach:**
- Single source of truth for all Azure resources
- Versioned in Git alongside application code
- Applied via CI/CD pipeline (no manual portal clicks)
- Idempotent (re-apply safely; no duplicates created)

### 5.2 Bicep Structure

```
/infra
├── main.bicep                   # Main template
├── modules/
│   ├── app-service.bicep       # App Service + Plan
│   ├── sql-database.bicep      # SQL Server + DB + Firewall
│   ├── service-bus.bicep       # Service Bus NS + Topics
│   ├── key-vault.bicep         # Key Vault + Secrets
│   ├── app-insights.bicep      # Application Insights
│   ├── storage.bicep           # Storage Account for logs/backups
│   └── cdn.bicep               # CDN (optional)
├── environments/
│   ├── prod.bicepparam         # Parameter overrides (size, capacity, redundancy)
│   ├── staging.bicepparam
│   ├── sandbox.bicepparam
│   └── dev.bicepparam
└── scripts/
    ├── deploy.sh               # Wrapper to deploy Bicep to RG
    └── validate.sh             # Validate templates before deploy
```

### 5.3 Sample Bicep Deployment

```bash
# Validate
az bicep build-params infra/main.bicepparam --output-format json

# Deploy to prod
az deployment group create \
  --resource-group riq-prod \
  --template-file infra/main.bicep \
  --parameters infra/environments/prod.bicepparam \
  --mode Incremental

# Rollback (re-apply previous version from Git tag)
git checkout v1.0.0
az deployment group create \
  --resource-group riq-prod \
  --template-file infra/main.bicep \
  --parameters infra/environments/prod.bicepparam \
  --mode Incremental
```

### 5.4 What IaC Should Define

- ✅ App Service Plans, App Services, Deployment Slots
- ✅ SQL Server, Databases, Firewall Rules, Backups
- ✅ Service Bus Namespaces, Topics, Subscriptions, Queues
- ✅ Key Vault, Access Policies, Secrets (reference, not inline)
- ✅ Application Insights, Log Analytics, Storage Accounts
- ✅ Managed Identities, Role Assignments (RBAC)
- ✅ CDN, WAF Rules, Rate Limiting
- ⚠ **NOT in IaC:** Secrets values (pulled from Key Vault at runtime)
- ⚠ **NOT in IaC:** Database schema creation (handled by EF Core migrations)

---

## 6. Database Management

### 6.1 Multi-Tenancy Database Model (Infrastructure View)
<!-- Jira: RCLOUD-30,RCLOUD-31,RCLOUD-32,RCLOUD-33,RCLOUD-34 | Epic: RCLOUD-4 | Synced: 2026-04-09 -->

Infrastructure provisions and manages three database tiers:

- **Master/Registry Database** (`riq-sql-master` / `riq_master`): Central tenant routing and configuration metadata. Basic tier, 5 GB.
- **Shared Multi-Tenant Database** (`riq-sql-prod` / `riq_shared`): Hosts 10–30 standard-tier tenants with schema-per-tenant isolation. Standard S1, 50 GB.
- **Dedicated Databases** (`riq-sql-prod` / `[tenant_ent_XXX]`): One per enterprise tenant. Standard S2+ or Premium P1, independent scaling.

> **Application-layer details** — Master DB schema, `ITenantConnectionResolver`, `ApplicationDbContext`, EF Core scoped DbContext, and tenant isolation patterns are defined in **PRD_CloudAPI.md § 5–6** and **PRD_SharedLibraries.md § 3** (Tenant aggregate).

### 6.2 Database Migration Deployment
<!-- Jira: RCLOUD-34,RCLOUD-35,RCLOUD-36 | Epic: RCLOUD-4 | Synced: 2026-04-09 -->

From an infrastructure perspective, the CI/CD pipeline handles EF Core migrations as follows:

1. Generate migration script from EF Core in the build step
2. Dry-run against test DB (replica of shared prod schema)
3. Validate schema integrity (no orphaned FKs, etc.)
4. Apply to prod shared schema (standard-tier tenants)
5. Apply to all dedicated DBs in parallel (with per-tenant error handling)
6. Verify migration success via Master DB audit log
7. Rollback plan: Revert migration commit + re-deploy previous version (EF Core down migrations handle schema)

> **Application-layer details** — DbContext lifecycle, `ITenantConnectionResolver` injection, multi-database migration runner code, and migration safety patterns are defined in **PRD_CloudAPI.md § 5–6**.

### 6.4 Backup & Recovery

**Backup Strategy:**

| Schedule | Retention | Type | Destination |
|----------|-----------|------|-------------|
| **Automated (hourly)** | 35 days | Transaction log | Azure SQL built-in |
| **Manual (daily)** | 90 days | Full backup | Blob Storage (Cool tier) |
| **Manual (weekly)** | 1 year | Full backup | Archive Tier (RA-GRS) |

**Point-in-Time Restore (PITR):**
- Restore prod DB to any point in last 35 days (e.g., recover deleted data)
- Restore to staging for validation before restoring to prod
- ⚠ RTO: ~15–30 min (depends on DB size); RPO: 5 min (transaction log backup frequency)

**Backup Verification:**
- Automated weekly restore test to dev environment (validate backup integrity)
- ⚠ Schedule: Recommend off-peak window (2 AM UTC)

### 6.5 Connection Pooling & Query Performance

- **Pool Size:** Monitor actual concurrent connections vs. SQL tier DTU/vCore limit
- **Query Monitoring:** Enable Query Store in Azure SQL Database; track slow queries (>1s)
- **Index Fragmentation:** Monitor and schedule maintenance during low-traffic windows

> **Application-layer details** — EF Core pool configuration, Fluent API indexing, and N+1 detection patterns are defined in **PRD_CloudAPI.md § 5–6**.

---

## 7. Tenant Onboarding
<!-- Jira: RCLOUD-19,RCLOUD-30 | Epic: RCLOUD-2,RCLOUD-4 | Synced: 2026-04-09 -->

### 7.1 Automated Onboarding Pipeline (Master DB + Hybrid Multi-Tenancy)

When a new tenant signs up:

```
1. Admin/Sales creates tenant in management portal
   ├─ Input: Tenant Name, Location, Contact, Tier (Standard/Enterprise)
   └─ Trigger: TenantCreatedEvent → Service Bus topic

2. Tenant Onboarding Worker (Azure Function or Scheduled Job)
   ├─ INSERT tenant into Master DB (riq_master.Tenants table)
   │  ├─ TenantId: Unique identifier (e.g., tenant_001)
   │  ├─ TenantName: Display name
   │  ├─ Tier: 'standard' or 'enterprise'
   │  ├─ DatabaseType: 'Shared' or 'Dedicated' (based on tier)
   │  ├─ SchemaName: For shared tenants (e.g., 'tenant_001')
   │  └─ ConnectionString: Point to shared or dedicated DB (encrypted in Key Vault)
   │
   ├─ IF DatabaseType == Shared:
   │  ├─ Create tenant schema in shared DB
   │  │  ├─ Execute: CREATE SCHEMA [tenant_NNN]
   │  │  ├─ Create all tables from template schema
   │  │  ├─ Apply EF Core-generated indexes
   │  │  └─ Apply Row-Level Security (RLS) policies
   │  ├─ Create database user (login) for tenant
   │  │  ├─ Scoped to [tenant_NNN] schema only
   │  │  └─ Password stored in Key Vault
   │
   ├─ ELSE IF DatabaseType == Dedicated:
   │  ├─ Create new dedicated Azure SQL Database [tenant_ent_001]
   │  ├─ Apply all migrations (EF Core MigrateAsync)
   │  ├─ Store connection string in Master DB + Key Vault
   │
   ├─ Create Service Bus subscriptions
   │  ├─ orders_{tenant_id}
   │  ├─ inventory_{tenant_id}
   │  └─ notifications_{tenant_id}
   │
   ├─ Create Key Vault secrets
   │  ├─ tenant_{tenant_id}_connection_string (connection to shared or dedicated DB)
   │  └─ tenant_{tenant_id}_service_bus_key
   │
   └─ Emit TenantOnboardingCompletedEvent → Log audit entry in Master DB

3. Application receives notification
   ├─ Load tenant from Master DB via ITenantConnectionResolver
   ├─ Cache tenant config in-memory (with TTL)
   └─ Tenant can now log in and access the platform

4. Monitoring & Alerts
   ├─ If onboarding fails → Dead-letter + Alert to ops team
   └─ Log all provisioning steps for audit trail (Master DB AuditLog table)
```

**Tenant Migration Workflow (Standard → Enterprise):**
- Tenant upgrades tier from Standard to Enterprise (via management portal)
- Update Master DB: Set `DatabaseType = 'Dedicated'` + new `ConnectionString`
- Create new dedicated DB
- Execute background job: Copy data from shared schema to dedicated DB
- Update `ITenantConnectionResolver` cache to point to new connection
- Soft-delete old shared schema (retain for 30 days for rollback)

### 7.2 Infrastructure Provisioning Details

The onboarding pipeline provisions these infrastructure resources per tenant:

**Compute Option:** Azure Function (recommended) or .NET hosted service
- **Trigger:** Service Bus topic subscription (`tenant-events` / `onboarding`)
- **Runtime:** .NET isolated (managed)
- **Deployment:** Provisioned via IaC (Bicep) + CI/CD
- **Alternative:** Scheduled background task in API (simpler, valid for ≤20 tenants at launch)

**Resources Provisioned:**
- Schema or dedicated database (see § 7.1)
- Service Bus subscriptions: `orders_{tenant_id}`, `inventory_{tenant_id}`, `notifications_{tenant_id}`
- Key Vault secrets: `tenant_{tenant_id}_connection_string`, `tenant_{tenant_id}_service_bus_key`

> **Application-layer details** — `ITenantConnectionResolver` interface, `SqlTenantConnectionResolver` implementation, `TenantCreatedEvent` domain event, and onboarding worker application logic are defined in **PRD_CloudAPI.md § 5–6** and **PRD_SharedLibraries.md § 3** (Tenant aggregate, domain events).

### 7.3 Validation Checklist

After tenant provisioned:
- ✅ Tenant record inserted into Master DB (riq_master.Tenants)
- ✅ DatabaseType is correct (Shared or Dedicated)
- ✅ **For Shared Tenants:**
  - Schema exists and contains all required tables
  - RLS policies enforce tenant isolation
  - Database user login works and scoped to tenant schema only
  - Tenant can query their own schema
  - Tenant cannot query other schemas (validated via cross-schema query test)
- ✅ **For Dedicated Tenants:**
  - New database created and all migrations applied
  - Connection string valid and in Master DB
  - Dedicated database is independent
- ✅ Service Bus subscriptions are active (orders, inventory, notifications topics)
- ✅ Key Vault secrets are retrievable (connection string, service bus key)
- ✅ ITenantConnectionResolver resolves correct connection string
- ✅ Tenant can log in and access data (end-to-end test)

### 7.4 Offboarding (Deletion)

When a tenant cancels:
1. Mark tenant as `status: "archived"` (soft delete)
2. Stop accepting API calls for tenant (return 410 Gone)
3. Trigger TenantOffboardingEvent → Service Bus
4. Offboarding worker:
   - ✅ Disable Service Bus subscriptions (preserve messages for 30 days)
   - ✅ Archive tenant schema to cold storage (Blob)
   - ✅ Delete tenant schema from prod DB (after 90-day compliance hold)
   - ✅ Rotate Key Vault secrets
5. Emit TenantOffboardingCompletedEvent

---

## 8. Monitoring & Alerting

### 8.1 Observability Stack
<!-- Jira: RCLOUD-76,RCLOUD-77 | Epic: RCLOUD-1 | Synced: 2026-04-09 -->

**Layers:**

```
Application
  ↓ (Serilog)
OTel Exporter
  ├─ (Dev) Seq (local, structured logs)
  ├─ (Staging/Prod) Application Insights (Azure)
  └─ (Future) Datadog, Splunk, New Relic (vendor-neutral)

Application Insights
  ├─ Metrics (latency, throughput, error rate)
  ├─ Logs (structured, tenant_id, correlation_id)
  ├─ Traces (distributed tracing, Service Bus, SQL)
  ├─ Exceptions (stack traces, context)
  └─ Dependencies (SQL queries, HTTP calls, Service Bus)
```

### 8.2 Instrumentation

All components emit OTel telemetry (metrics, traces, logs) via the Serilog + OTel pipeline configured in `Program.cs`. Instrumentation covers ASP.NET Core, SQL Client, HTTP Client, and Service Bus activity tracing.

> **Application-layer details** — OTel and Serilog configuration code for `Program.cs` is defined in **PRD_CloudAPI.md § 8** (Observability).

### 8.3 Key Metrics & Dashboards

**API Dashboard:**
- ✅ Request latency (p50, p95, p99)
- ✅ Error rate by endpoint (4xx, 5xx)
- ✅ Active users per tenant
- ✅ API throughput (requests/sec)
- ✅ Database connection pool utilization
- ✅ Service Bus message count (pending, dead-lettered)

**Database Dashboard:**
- ✅ Query execution time (slow queries)
- ✅ Disk I/O and memory usage
- ✅ Row count per tenant schema
- ✅ Index fragmentation
- ✅ Backup status (last backup time)

**Infrastructure Dashboard:**
- ✅ App Service CPU, Memory, Network
- ✅ Deployment slot traffic distribution
- ✅ HTTP response codes (2xx, 3xx, 4xx, 5xx)
- ✅ Availability (uptime SLA tracking)

### 8.4 Alerting Rules

**Alert Channels:** ⚠ TBD (Recommend: PagerDuty, Slack, Email)

**Critical Alerts (Page On-Call):**
- ❌ API error rate > 5% for 5 min
- ❌ Database unreachable for > 1 min
- ❌ Service Bus message queue backlog > 1000 messages
- ❌ App Service memory > 90% for > 10 min
- ❌ SQL Database DTU > 80% for > 15 min

**Warning Alerts (Slack notification):**
- ⚠ API latency p95 > 2s for 10 min
- ⚠ Tenant onboarding failed (dead-lettered)
- ⚠ Backup failed or overdue
- ⚠ Log storage > 80% quota

**Info Alerts (Dashboard only):**
- 💬 New tenant provisioned
- 💬 Deployment completed
- 💬 Database migration applied

### 8.5 Prod Backend Selection (Vendor Neutral)

**Application Insights** (current, Azure-native):
- ✅ Built-in OTel support
- ✅ Integrated cost (bundled with Azure subscription)
- ✅ KQL (Kusto Query Language) for custom queries
- ❌ Limited to 90-day retention (cost for longer)

**Future Options** (via OTel exporter switch):
- **Datadog:** Rich alerting, APM, log analytics
- **New Relic:** APM, profiling, distributed tracing
- **Splunk:** Enterprise-grade logs, advanced analytics
- **Grafana Cloud:** OSS-friendly, Prometheus metrics

**Migration Path:**
1. Configure OTel exporter endpoint in application config
2. Deploy new exporter in non-breaking release
3. Validate both backends receive telemetry
4. Switch primary backend (Application Insights → Datadog)
5. Deprecate old backend (can run parallel for 30 days)

---

## 9. Security
<!-- Jira: RCLOUD-81 | Epic: RCLOUD-1 | Synced: 2026-04-09 | Note: SOC 2 prep -->

### 9.1 Network Security

**HTTPS/TLS & Subdomain-Per-Tenant Architecture:**
- ✅ **Wildcard SSL Certificate:** `*.recycleriq.com` managed by Azure App Service (auto-renewed)
- ✅ **Tenant Subdomains:** Each tenant accesses platform via `{tenantname}.recycleriq.com`
- ✅ **Company Website:** `recycleriq.com` hosted on same App Service
- ✅ **Enforce HTTPS:** All HTTP requests redirect to HTTPS
- ✅ **TLS 1.2 minimum** (1.3 preferred)
- ✅ **HSTS header:** `Strict-Transport-Security: max-age=31536000`
- ✅ **Certificate Management:** Azure-managed, no manual renewal required

**Firewall & WAF:**
- ⚠ **Web Application Firewall (WAF):** Define rules for:
  - ✅ SQL injection patterns
  - ✅ XSS payloads
  - ✅ Rate limiting (10 req/sec per IP)
  - ✅ Geo-blocking (if needed, e.g., only US)
  - ✅ DDoS protection (standard or enhanced)
- **SQL Server Firewall:**
  - ✅ Allow App Service only (via Managed Identity)
  - ❌ No public IP exposure
  - ⚠ IP allowlisting for admins (if needed): Document and rotate

### 9.2 Authentication & Authorization (Infrastructure View)

**Service-to-Service Authentication:**
- ✅ Managed Identities (App Service → Service Bus, Key Vault, SQL)
- ✅ No secrets in code (use Key Vault reference)
- ✅ RBAC: Least privilege (e.g., App Service has `Secrets/Get` on Key Vault, not `All`)

**Admin Access:**
- ⚠ Multi-factor authentication (MFA) required for Azure portal
- ⚠ Just-in-time (JIT) admin access (Azure AD Privileged Identity Management)
- ⚠ Audit all admin actions (Log Analytics + Application Insights)

> **Application-layer details** — `IIdentityProvider` abstraction, OAuth/OIDC/SAML support, JWT bearer token handling, refresh token rotation, and tenant-specific auth provider resolution are defined in **PRD_CloudAPI.md § 4** (Authentication & Authorization) and **ADR: authentication-identity-decisions.md**.

### 9.3 Secrets Management (Master DB + Key Vault)

**Master DB stores encrypted references to secrets:**
- Connection strings for shared and dedicated DBs stored in Master DB.Tenants.ConnectionString (encrypted at rest via TDE)
- Key Vault stores decryption keys and tenant-specific secrets

**Key Vault Structure (per tenant):**
- `tenant_{tenantId}_connection_string`: Decrypted at application startup via ITenantConnectionResolver
- `tenant_{tenantId}_service_bus_key`: Service Bus connection string
- `tenant_{tenantId}_auth_secret`: OAuth client secret (if custom provider)

**Key Vault Rotation Policy:**

```
Recommended:
- Database connection string: Rotate every 90 days
- API keys (3rd party): Rotate per vendor SLA (typically 30–90 days)
- Encryption keys: Rotate on-demand, archive old key versions
- Backup keys: Store offline, test recovery annually
```

**Rotation Implementation (Multi-Tenant):**

```bash
# For shared DB (all standard-tier tenants):
az keyvault secret set \
  --vault-name riq-kv-prod \
  --name "sql-shared-db-connection-string" \
  --value "Server=tcp:riq-sql-prod.database.windows.net;Database=riq_shared;User Id=...;Password=NEW_PWD;..."

# For each dedicated DB (enterprise tenants):
az keyvault secret set \
  --vault-name riq-kv-prod \
  --name "tenant_{tenantId}_connection_string" \
  --value "Server=tcp:riq-sql-ent-{tenantId}.database.windows.net;Database=riq_ent;User Id=...;Password=NEW_PWD;..."

# Update Master DB (if connection string changed)
UPDATE Tenants SET ConnectionString = NEW_ENCRYPTED_STRING WHERE TenantId = @tenantId;

# Trigger application restart (reload connection strings from Key Vault)
az webapp restart --name riq-api-prod --resource-group riq-prod

# Invalidate ITenantConnectionResolver cache
# (Optional: Gradual rollout via feature flag to invalidate per tenant)

# Verify connectivity before decommissioning old secret
```

### 9.4 Data Encryption

**Encryption at Rest:**
- ✅ Azure SQL Transparent Data Encryption (TDE): Enabled by default
- ✅ Storage Account encryption: Enabled by default (AES-256)
- ✅ Service Bus messages: Encrypted at rest (double encryption for sensitive payloads)
- ⚠ **Application-level encryption:** Consider for PII (e.g., phone numbers, store IDs) — use AEAD cipher (AES-256-GCM)

**Encryption in Transit:**
- ✅ HTTPS for all API calls (TLS 1.2+)
- ✅ Service Bus uses AMQP over TLS
- ✅ SQL uses encrypted connections (Encrypt=true in connection string)
- ✅ Blob Storage: Enforce HTTPS-only (disable HTTP)

### 9.5 OWASP Top 10 Mitigations

| OWASP | Threat | Mitigation |
|-------|--------|-----------|
| **A01: Broken Access Control** | Tenant can access other tenant data | RLS policies + EF Core filters + JWT claims |
| **A02: Cryptographic Failures** | Weak encryption, exposed keys | TLS 1.2+, Key Vault, no secrets in code |
| **A03: Injection** | SQL injection, command injection | Parameterized queries (EF Core), input validation |
| **A04: Insecure Design** | Missing threat modeling | Tenant isolation by design (schema-per-tenant), audit logging |
| **A05: Security Misconfiguration** | Exposed secrets, open ports | IaC (Bicep), least privilege RBAC, WAF rules |
| **A06: Vulnerable Dependencies** | Outdated .NET, packages | Dependabot, GitHub SCA, NuGet package audits |
| **A07: Authentication Failures** | Weak token handling | OAuth 2.0 + OpenID Connect, JWT + refresh tokens, httpOnly cookies |
| **A08: Data Integrity Failures** | Corrupted data, tampering | Transaction integrity, audit logging, backups |
| **A09: Logging & Monitoring Failures** | Missed breaches | OTel logging, security events → Application Insights, alerting |
| **A10: SSRF** | Server-side request forgery | Validate URLs, allowlist endpoints, network segmentation |

### 9.6 Audit Logging

All sensitive operations logged:
- ✅ User login/logout
- ✅ Tenant onboarding/offboarding
- ✅ Secret rotation in Key Vault
- ✅ Database schema changes (migrations)
- ✅ Admin portal access
- ✅ Data export/deletion

**Log Retention:** 90 days (Application Insights) + 1 year archived (Blob Storage Cool tier)

---

## 10. Local App Distribution & Updates

### 10.1 Bootstrapper & Installer

**Goal:** Deliver Recycler.IQ desktop app (Windows .exe) to store locations with automatic updates.

**Current Approach (Master PRD):** ClickOnce-style bootstrapper served from Cloud API.

**Implementation:**

```
1. Bootstrapper Download
   └─ User clicks link: recycler-iq.com/installer/bootstrapper.exe
      ├─ Served from App Service (or CDN for speed)
      └─ Signed with code-signing cert (Authenticode)

2. Bootstrapper Execution
   └─ Checks local version vs. cloud latest version
      ├─ If outdated → Download .exe
      ├─ Verify hash (SHA-256)
      ├─ Run installer (.msi or direct .exe replacement)
      └─ Restart application

3. Version Check (on startup)
   └─ App queries: GET /api/v1/app/latest-version
      ├─ Response: { version: "1.0.0", url: "...", hash: "..." }
      ├─ Compare local version
      ├─ If newer available, prompt user (or auto-update after delay)
      └─ Download + verify + apply update
```

**Version Check Endpoint:** `GET /api/v1/app/latest-version` — returns version, download URL, SHA-256 hash, and mandatory flag.

> **Application-layer details** — Endpoint implementation and `AppVersionResponse` model are defined in **PRD_CloudAPI.md**.

### 10.2 Release Management

**Build Pipeline:**
1. Tag release in Git: `git tag v1.0.0`
2. CI/CD builds .exe + .msi
3. Sign with code-signing certificate
4. Generate SHA-256 hash
5. Upload to storage: `/releases/v1.0.0/riq-app-1.0.0.exe`
6. Update version metadata in database/Key Vault
7. ⚠ **Notarization:** Consider Windows code-signing + SmartScreen whitelisting

**Rollout Strategy:**
- **Canary:** 5% of users get new version (measured by analytics)
- **Staged:** Ramp to 25%, 50%, 100% over days
- **Mandatory:** If critical bug/security fix, force all users to update within 24h
- **Rollback:** Previous version served if critical bugs found

### 10.3 Update Verification

Before app starts:
1. Check digital signature (Authenticode)
2. Verify SHA-256 hash matches cloud metadata
3. ⚠ **CRL check:** Validate code-signing certificate is not revoked (optional, adds delay)
4. Compare version; if older than cloud, prompt update

### 10.4 Offline Support

Stores may lose internet connectivity temporarily:
- ✅ App continues to work (cached config, offline data sync)
- ✅ Queues messages locally (sync when connectivity restored)
- ⚠ **Update check:** Skip if offline; retry on reconnect

---

## 11. Testing Strategy

### 11.1 Testing Pyramid

```
              / \
             /E2E\
            /-----\
           /  API  \
          /---------\
         / Integration\
        /----------- \
       /    Unit       \
      /_________________\
```

| Level | Scope | Tool | Frequency | Env |
|-------|-------|------|-----------|-----|
| **Unit** | Single class/method | xUnit + Moq | On commit (PR) | Dev |
| **Integration** | DB + Service Bus | xUnit + TestContainers | On commit (PR) | Dev (Docker) |
| **API** | HTTP endpoints | Postman / REST Sharp | After merge (staging) | Staging |
| **E2E** | Full user flow | Playwright / Selenium | Nightly | Staging + Sandbox |

### 11.2 Test Tooling & Infrastructure

**Tools (provisioned in CI/CD):**
- **xUnit:** Test runner
- **Moq:** Mock external dependencies (Service Bus, Key Vault)
- **FluentAssertions:** Readable assertions
- **TestContainers:** Spin up SQL Server, Service Bus emulator in Docker for integration tests
- **WebApplicationFactory:** In-memory ASP.NET Core test server for API tests
- **Playwright:** Cross-browser E2E testing (Chromium, Firefox, WebKit)

**CI/CD Responsibilities:**
- Unit + integration tests run on every PR
- API tests run after merge to staging
- E2E tests run nightly against staging + sandbox

> **Application-layer details** — Test code examples (unit, integration, API, E2E), test patterns for tenant isolation, and coverage targets are defined in **PRD_CloudAPI.md** and **PRD_SharedLibraries.md** test sections.

### 11.3 Test Environment Setup

```yaml
# .github/workflows/test.yml
name: Test Pipeline

on: [pull_request, push]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-dotnet@v3
        with:
          dotnet-version: '10.0.x'
      - run: dotnet test --filter "Category!=Integration" --logger "trx;LogFileName=test-results.trx"
      - uses: dorny/test-reporter@v1
        with:
          name: Unit Test Results
          path: 'test-results.trx'
          reporter: '.NET'

  integration-tests:
    runs-on: ubuntu-latest
    services:
      mssql:
        image: mcr.microsoft.com/mssql/server:2022-latest
        env:
          ACCEPT_EULA: Y
          SA_PASSWORD: MySecurePassword123!

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-dotnet@v3
      - run: dotnet test --filter "Category==Integration"
```

### 11.7 Coverage & Quality Gates

**GitHub Branch Protection Rules:**
- ✅ Require PR review (minimum 1)
- ✅ Require status checks to pass (tests, linting, SCA)
- ✅ Require code coverage > 75% on new code (Codecov)
- ✅ Require no critical Dependabot vulnerabilities

---

## 12. Disaster Recovery

### 12.1 Backup Strategy

**Backup Frequency & Retention:**

| Backup Type | Frequency | Retention | Storage | RTO | RPO |
|-------------|-----------|-----------|---------|-----|-----|
| **Transaction Log** | Continuous | 35 days | Azure SQL built-in | N/A | 5 min |
| **Full Backup (Automated)** | Daily @ 2 AM UTC | 35 days | Azure SQL built-in | 30 min | 24 h |
| **Full Backup (Manual)** | Daily @ 3 AM UTC | 90 days | Blob Storage (Cool) | 1–2 h | 24 h |
| **Archive Backup** | Weekly | 1 year | Blob Archive tier | 12+ h | 7 days |

### 12.2 Backup Verification

**Weekly restore test** (every Sunday 2 AM):
1. Restore previous week's backup to `riq-sql-restore` (test DB)
2. Run data integrity checks (row counts, FK consistency)
3. Verify all tenant schemas are present
4. ⚠ Alert if test fails (send to on-call)
5. Clean up test DB after validation

```bash
# Automated via Azure Automation Runbook or Logic App
az sql db restore \
  --resource-group riq-test \
  --server riq-sql-test \
  --name riq_restore \
  --from-server riq-sql-prod \
  --from-name riq_prod \
  --point-in-time "2026-03-21T08:00Z"
```

### 12.3 Recovery Procedures

**Scenario 1: Accidental Data Deletion (Point-in-Time Restore)**

```
1. Detect issue (alert on unusual DELETE activity)
2. Stop API (prevent further writes)
3. Restore DB to 15 min before deletion
4. Verify data restored for affected tenant
5. Resume API
6. RTO: 15–30 min | RPO: 15 min
```

**Scenario 2: Database Corruption**

```
1. Detect via backup validation or query errors
2. Restore from latest clean backup (could be 24h old)
3. Re-apply transactions from transaction log (if available)
4. Run repair utilities (DBCC CHECKDB)
5. RTO: 1–2 h | RPO: ~24 h
```

**Scenario 3: App Service Outage**

```
1. Auto-failover to backup App Service (if geo-replicated)
   OR Manual failover to staging App Service
2. Update DNS to point to backup App Service
3. Verify API connectivity
4. RTO: 5–10 min | RPO: Near-zero (load-balanced, no state)
```

**Scenario 4: Service Bus Message Loss**

```
1. Check dead-letter queue for unprocessed messages
2. Replay messages from dead-letter queue (manual)
3. Investigate root cause (poison message, consumer down)
4. Resume message processing
5. RTO: <5 min | RPO: <1 message
```

**Scenario 5: Multi-Region Failure (Azure Outage)**

```
⚠ Not implemented at launch (geo-replication costly for small team)
Future: Secondary region (e.g., West Europe) with warm standby
- Restore DB from backup in secondary region
- Failover Service Bus namespace to secondary
- Update DNS to secondary region
RTO: 15–30 min | RPO: 1 h
```

### 12.4 RTO/RPO Targets

**Service Level Objectives (SLO):**

| Service | RTO Target | RPO Target | Backup Freq |
|---------|-----------|-----------|------------|
| **API** | 15 min | N/A (stateless) | N/A |
| **Database** | 30 min | 24 h (prod), 7 days (dev) | Daily |
| **Service Bus** | 5 min | 0 (no message loss) | Real-time replication |
| **Key Vault** | 10 min | Real-time | Multi-region geo-repl |
| **Storage** | 1 h | 24 h | Geo-replication |

### 12.5 Disaster Recovery Drills

**Quarterly DR Drill (simulate failures):**

1. **Week 1:** Database restore test (prod → staging)
2. **Week 2:** App Service failover (primary → backup slot)
3. **Week 3:** Service Bus failure (simulate queue backlog, test DLQ replay)
4. **Week 4:** Full end-to-end test (all services fail, then recover in order)

**Documentation:**
- ✅ Runbook for each scenario (step-by-step)
- ✅ Contact list (on-call rotation, escalation)
- ✅ RTO/RPO targets for each service
- ✅ Metrics to verify recovery success

---

## 13. Cost Planning

### 13.1 Estimated Monthly Costs (USD)

**At 10 Tenants:**

| Service | SKU | Est. Cost/Month |
|---------|-----|-----------------|
| **App Service** | Standard S1 (1 instance, 1–3 with auto-scale) | $70–120 |
| **Azure SQL** | Standard S1 (50 GB) | $90 |
| **Service Bus** | Standard Tier (5M messages/month) | $15 |
| **Key Vault** | Standard + 5 secrets/month | $1 |
| **Application Insights** | 100 GB/month ingestion | $50 |
| **Storage Account** | 10 GB (logs + backups) | $2 |
| **Bandwidth** | ~500 GB/month egress | $40 |
| **Other** | CDN, monitoring, miscellaneous | $20 |
| **TOTAL** | | **~$288/month** |

**At 25 Tenants:**

| Service | SKU | Est. Cost/Month |
|---------|-----|-----------------|
| **App Service** | Standard S2 (2–5 instances, auto-scale) | $150–250 |
| **Azure SQL** | Standard S2 (250 GB) | $200 |
| **Service Bus** | Standard (12M messages/month) | $30 |
| **Key Vault** | Standard + 30 secrets/month | $1 |
| **Application Insights** | 250 GB/month ingestion | $80 |
| **Storage Account** | 30 GB (logs, backups) | $3 |
| **Bandwidth** | ~1.2 TB/month egress | $100 |
| **Other** | Miscellaneous | $30 |
| **TOTAL** | | **~$694/month** |

**At 50 Tenants:**

| Service | SKU | Est. Cost/Month |
|---------|-----|-----------------|
| **App Service** | Standard S3 (3–10 instances, auto-scale) | $250–400 |
| **Azure SQL** | Premium P1 (500 GB) | $450 |
| **Service Bus** | Standard (25M messages/month) | $60 |
| **Key Vault** | Standard + 60 secrets/month | $1 |
| **Application Insights** | 500 GB/month ingestion | $150 |
| **Storage Account** | 60 GB (logs, backups) | $5 |
| **Bandwidth** | ~2.5 TB/month egress | $200 |
| **Other** | CDN, monitoring, misc | $50 |
| **TOTAL** | | **~$1,566/month** |

### 13.2 Cost Optimization Tips

- ✅ **Reserved Instances (RIs):** Lock in 1/3-year commitments for App Service, SQL (save ~30%)
- ✅ **Spot VMs:** For non-critical workloads (dev environment)
- ✅ **Blob Storage Lifecycle:** Archive old logs to cool/archive tiers
- ✅ **Application Insights Sampling:** 50%–90% in prod after stabilization (save 50%+ on logs)
- ✅ **Auto-scale Policies:** Disable auto-scale for non-prod to reduce costs
- ⚠ **SQL Database:** Consider SQL Managed Instance for multi-DB workloads (more cost-effective at scale)

### 13.3 Cost Monitoring

**Azure Cost Management:**
- ✅ Budget alerts (email if spend exceeds threshold)
- ✅ Dashboard: Cost trend by service
- ✅ Tag resources by tenant/environment for chargeback model
- ✅ Review monthly bill + optimize reserved instances

```bash
# Query cost by resource group (via Azure CLI)
az cost management query create \
  --name "monthly-breakdown" \
  --definition file://cost-query.json \
  --timeframe Last30Days
```

---

## 14. Open Items & Gaps

This section flags **everything undefined** in the Master PRD and requires engineering decision-making.

### 14.1 Architecture & Design

- ✅ **RESOLVED (ADR 1, ADR 2):** Authentication via IIdentityProvider abstraction (OAuth, custom creds, SSO/SAML)
- ✅ **RESOLVED (ADR 1):** Subdomain-per-tenant: `{tenantname}.recycleriq.com` with wildcard SSL cert
- ✅ **RESOLVED (ADR 2):** Hybrid multi-tenancy: schema-per-tenant (shared) + dedicated DBs (enterprise)
- ✅ **RESOLVED (ADR 2):** Master/Registry DB for tenant routing and configuration
- ⚠ **Geo-Replication Strategy:** Is multi-region failover required? (Impacts cost significantly)
- ⚠ **App Service Scaling Limits:** How many tenants/requests per instance before upgrading SKU?
- ⚠ **Event-Driven Architecture:** How are cross-tenant events routed? (Service Bus topology unclear)
- ⚠ **Data Archival Policy:** How long do inactive tenant schemas stay in prod DB? (Cost vs. compliance)

### 14.2 CI/CD & Deployment

- ⚠ **CI/CD Tool Selection:** GitHub Actions vs. Azure DevOps vs. Jenkins? (Recommend GitHub Actions)
- ⚠ **Deployment Frequency:** How often should releases go out? (Weekly? Daily?)
- ⚠ **Manual Approval Gates:** Who approves prod deployments? (Tech lead? Product owner?)
- ⚠ **Rollback SLA:** Maximum downtime acceptable for rollback?
- ⚠ **Hotfix Process:** How are critical security patches deployed outside normal cadence?
- ⚠ **Feature Flags:** Do you need feature toggles for gradual rollout? (Recommend LaunchDarkly or Azure App Configuration)
- ⚠ **Database Deployment Approval:** Separate approval process for schema migrations?

### 14.3 Database & Migrations

- ✅ **RESOLVED (ADR 2):** Hybrid multi-tenancy architecture: schema-per-tenant (shared DB) + dedicated DB (enterprise)
- ✅ **RESOLVED (ADR 2):** Master/Registry DB stores tenant routing and configuration
- ✅ **RESOLVED (ADR 2):** EF Core Code-First, Scoped DbContext, ITenantConnectionResolver for tenant resolution
- ✅ **RESOLVED (ADR 2):** Migration strategy: Apply to shared DB + all dedicated DBs in parallel with error handling
- ⚠ **Data Validation Post-Migration:** Automated checks to verify migration success per tenant?
- ⚠ **Connection Pool Sizing:** Actual pool size with N tenants × concurrent users? (Performance testing needed)
- ⚠ **Shared DB Density:** Performance targets for max tenants per shared instance? (Monitor at scale)

### 14.4 Tenant Onboarding

- ✅ **RESOLVED (ADR 1, ADR 2):** Master DB + automated provisioning pipeline for schema (shared) or database (dedicated)
- ✅ **RESOLVED (ADR 1):** IIdentityProvider abstraction supports OAuth, custom credentials, and SSO/SAML
- ⚠ **Self-Service Onboarding:** Can tenants provision themselves, or manual admin-only?
- ⚠ **Approval Workflow:** Is there a validation step before tenant schema creation (e.g., payment verified)?
- ⚠ **Tenant Capacity Limits:** Per-tenant storage quota? API rate limits per tenant?
- ⚠ **Multi-Workspace Tenants:** Can a single store location have multiple workspaces (e.g., multiple cash registers)?
- ⚠ **Tenant Tier Upgrade Workflow:** Detailed steps for migrating standard → enterprise tier (live data migration approach)

### 14.5 Monitoring & Alerting

- ⚠ **Alert Delivery Channels:** PagerDuty? Slack? Email? SMS?
- ⚠ **Escalation Policy:** Who gets paged at 3 AM? (On-call rotation TBD)
- ⚠ **Alert Fatigue:** How many false positives are acceptable before tuning thresholds?
- ⚠ **Metrics Retention:** How long to keep metrics? (30 days? 1 year?)
- ⚠ **Custom Metrics:** What business metrics (orders/min, revenue/hour) need dashboards?
- ⚠ **Tenant-Specific Dashboards:** Do tenants see their own metrics (read-only), or only internal team?

### 14.6 Security & Compliance

- ✅ **RESOLVED (ADR 1):** Wildcard SSL cert `*.recycleriq.com` for subdomain-per-tenant architecture
- ✅ **RESOLVED (ADR 1):** IIdentityProvider abstraction supports OAuth, custom credentials, and SSO/SAML
- ✅ **RESOLVED (ADR 2):** Master DB + Key Vault store connection strings and secrets securely
- ⚠ **Data Residency Requirements:** Must tenant data stay in specific regions? (Impacts cost + complexity)
- ⚠ **Compliance Frameworks:** GDPR? CCPA? PCI-DSS? (Impacts encryption, audit logging, retention)
- ⚠ **PII Encryption:** What data qualifies as PII? (Customer names, phone, address, credit cards?)
- ⚠ **Secrets Rotation Schedule:** Recommend 90 days for connection strings; 30–90 days for API keys (see § 9.3)
- ⚠ **Code Signing Certificate:** Where to procure? (GoDaddy, Digicert, Sectigo?)
- ⚠ **WAF Rule Set:** OWASP defaults + custom rules for multi-tenant API (rate limiting, tenant isolation validation)
- ⚠ **Penetration Testing:** Schedule? In-house or 3rd-party vendor?
- ⚠ **Security Incident Response Plan:** Procedures for breach, data loss, account compromise?

### 14.7 Observability & Logging

- ⚠ **Log Sampling:** 100% of logs in prod, or sampled at 50%+?
- ⚠ **Sensitive Data Masking:** Redact passwords, PII from logs automatically?
- ⚠ **Log Aggregation:** Centralized logging platform (ELK, Splunk, Datadog)?
- ⚠ **Distributed Tracing:** Trace requests across API → DB → Service Bus?
- ⚠ **Metrics Cardinality:** How many unique label combinations? (High cardinality = cost)
- ⚠ **SLA Metrics:** Uptime SLA % per tenant? (99%, 99.5%, 99.9%?)

### 14.8 Disaster Recovery

- ⚠ **Geo-Replication:** Is single-region acceptable, or need multi-region? (Cost decision)
- ⚠ **RTO/RPO SLA:** Negotiated with customers? (Impacts backup frequency + infrastructure)
- ⚠ **Backup Testing Cadence:** Weekly? Monthly? (Recommend quarterly minimum)
- ⚠ **Data Deletion Compliance:** GDPR right-to-be-forgotten (must delete within 30 days of request)
- ⚠ **Disaster Recovery Drills:** Who coordinates? How often?
- ⚠ **Incident Post-Mortems:** RCA process for major incidents?

### 14.9 Cost & FinOps

- ⚠ **Cost Ownership:** Who owns Azure subscription? (Finance, Ops, Engineering?)
- ⚠ **Chargeback Model:** Bill tenants per usage (storage, messages), or flat rate?
- ⚠ **Reserved Instance Commitment:** Buy 1-year RIs for prod to save 30%? (Upfront cost)
- ⚠ **Cost Forecasting:** Model costs at 100, 250, 500 tenants (future planning)
- ⚠ **Budget Alerts:** At what spend level do you get notified?

### 14.10 Local App & Distribution

- ⚠ **Update Frequency:** How often should desktop apps auto-update? (Daily? On-demand?)
- ⚠ **Offline Sync Logic:** How long can app stay offline before forced sync? (Data freshness)
- ⚠ **Update Rollout Strategy:** Canary (5% users), staged (25%, 50%, 100%), or all-at-once?
- ⚠ **Code Signing Certificate Procurement:** Procure from trusted CA? Self-signed for testing?
- ⚠ **Windows SmartScreen:** Whitelist app to avoid blocking downloads?

### 14.11 Testing & QA

- ⚠ **Test Data Seeding:** How to generate realistic test data at scale (1000s of orders)?
- ⚠ **Load Testing:** Performance targets (e.g., 1000 concurrent users, <2s latency p95)?
- ⚠ **Chaos Engineering:** Inject failures (kill instances, corrupt messages) and verify recovery?
- ⚠ **Accessibility Testing:** WCAG 2.1 AA compliance required?
- ⚠ **Test Environment Parity:** How closely does staging mimic prod? (Same instance count? Same data volume?)

### 14.12 Operations & Runbooks

- ⚠ **Operational Handoff:** Who owns infrastructure post-launch? (DevOps hire? External vendor?)
- ⚠ **Runbook Documentation:** Step-by-step procedures for common ops tasks (scaling, emergency restart)?
- ⚠ **On-Call Rotation:** 24/7 coverage, or business hours only?
- ⚠ **Escalation Path:** Who to call when primary on-call is unreachable?
- ⚠ **Incident Communication:** How to notify customers during outages? (Status page, email, SMS?)

### 14.13 Compliance & Audit

- ⚠ **Audit Trail Requirements:** Who can see what logs? (Customer support? Billing team? Auditors?)
- ⚠ **Regulatory Audits:** Annual SOC 2? ISO 27001? (Impacts documentation + testing)
- ⚠ **Data Retention Policies:** How long to keep deleted tenant data? (Legal hold requirements?)
- ⚠ **Change Management Process:** Document all infrastructure changes (IaC commits not enough)?

### 14.14 Vendor Decisions

- ⚠ **OTel Backend:** Will you eventually switch from Application Insights to Datadog/Splunk/New Relic? (Decision framework needed)
- ⚠ **Build vs. Buy:** Use Azure-native services, or evaluate competitors (AWS, GCP)?
- ⚠ **Kubernetes:** Does complexity justify Kubernetes later (AKS), or stick with App Service?

### 14.15 Success Criteria

**Infrastructure is considered "production-ready" when:**

- ✅ All IaC is in Git, deployments fully automated
- ✅ Backup/restore tested (weekly validation passes)
- ✅ Monitoring + alerting active (error rate, latency dashboards)
- ✅ Security scan passing (SAST, dependency check, no secrets in code)
- ✅ Database migration strategy validated (applied to staging, no data loss)
- ✅ Tenant isolation verified (E2E test confirms tenant A cannot access tenant B data)
- ✅ Load testing completed (API handles expected scale without degradation)
- ✅ DR drill executed (team can recover from major failure in under RTO target)
- ✅ Documentation complete (runbooks, architecture diagrams, cost model)
- ✅ Team trained (developers + ops understand infrastructure, can deploy independently)

---

## 15. References & Further Reading

### Official Documentation
- [Azure App Service .NET Hosting](https://learn.microsoft.com/en-us/azure/app-service/quickstart-dotnetcore)
- [Azure SQL Database Reliability](https://learn.microsoft.com/en-us/azure/azure-sql/database/high-availability-sla)
- [Azure Service Bus Messaging](https://learn.microsoft.com/en-us/azure/service-bus-messaging/)
- [OpenTelemetry .NET](https://opentelemetry.io/docs/instrumentation/net/)
- [Entity Framework Core Migrations](https://learn.microsoft.com/en-us/ef/core/managing-schemas/migrations/)

### Patterns & Best Practices
- [Multi-Tenancy Patterns in Azure](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [Azure Well-Architected Framework](https://learn.microsoft.com/en-us/azure/architecture/framework/)
- [Blue-Green Deployments](https://docs.microsoft.com/en-us/azure/app-service/overview-managed-identity)

### Tools & SDKs
- [Azure CLI](https://learn.microsoft.com/en-us/cli/azure/)
- [Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [EF Core 10 Release Notes](https://learn.microsoft.com/en-us/ef/core/what-is-new/ef-core-10.0/release-notes)
- [Serilog Sinks](https://github.com/serilog/serilog/wiki/Provided-Sinks)

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-22 | Infrastructure Planning | Initial draft — all sections marked as gaps / TBD |

**Next Review:** After team agrees on all TBD items (recommend 1–2 week planning sprint)

**Approval Required:** Technical Lead, Product Manager, DevOps Lead (if hired)

---

**End of Infrastructure PRD**

This document is intentionally comprehensive and marks nearly every architectural decision as **⚠ TBD** because the Master PRD lacks these details. Use this as a working document: as the team makes decisions, replace TBD markers with concrete decisions and implementation details.
