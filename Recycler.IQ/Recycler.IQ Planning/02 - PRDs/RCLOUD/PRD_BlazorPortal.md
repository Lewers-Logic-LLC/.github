# PRD: Recycler.IQ Blazor WASM Web Portal

**Company:** Lewers Logic LLC

**Version:** 1.0
**Date:** March 22, 2026
**Status:** Final
**Audience:** Development Team, Product Stakeholders
**Related Documents:** Master_PRD_v3.docx, RecyclerIQ_BrandGuide.md

---

## 1. Overview

### Purpose

The **Recycler.IQ Blazor WASM Web Portal** is a single-page, web-based administrative and operational dashboard for the Recycler.IQ cash recycler management platform. It replaces legacy React/Angular frontends with a modern Blazor WebAssembly (.NET 10) application, leveraging existing .NET infrastructure for consistency, maintainability, and deployment efficiency.

### Key Users

- **CFOs** — Budget forecasting, cash flow analysis, financial reports
- **CIT Coordinators** — Manage in-transit (CIT) schedules, track deposits/withdrawals, resolve cash discrepancies
- **Regional Managers** — Multi-site oversight, performance dashboards, regional reporting
- **Tenant Admins** — User management within tenant, site/location configuration, license management
- **SystemAdmins** — Global management, tenant switching, system-wide settings, user provisioning

### Why Blazor WASM?

- **Stack Consistency:** Aligns with existing .NET 10 backend and Blazor Hybrid mobile app
- **Shared Components:** Reuse Razor components from `[ProductName].UI.Shared` library
- **Full-Stack .NET:** Single language for frontend and backend teams
- **Performance:** Modern WASM runtime; client-side rendering reduces server load
- **Deployment:** Easy Azure hosting; no separate Node.js/npm pipeline

### Reference Documents

- **Master PRD:** Master_PRD_v3.docx (core product requirements, data models, cloud API contracts)
- **Brand Guide:** RecyclerIQ_BrandGuide.md (color palette, typography, component design system)
- **UI Component Library:** [ProductName].UI.Shared (shared Razor components, utilities)

---

## 2. Architecture
<!-- Jira: RCLOUD-58 | Epic: RCLOUD-8 | Synced: 2026-04-09 | Note: Portal login/auth -->

### Hosting & Deployment

- **Technology:** Blazor WebAssembly (.NET 10)
- **Hosting:** Azure Static Web Apps or Azure Blob Storage + CDN (client-side SPA)
- **Entry Point:** `index.html` + Blazor runtime WASM bootstrap
- **Bundle:** Single JavaScript interop shim; all UI logic in .NET/C#

### API Integration

- **Backend Service:** Cloud API (ASP.NET Core REST/gRPC endpoints)
- **Authentication:** JWT tokens (Bearer scheme)
- **Base URL Configuration:** Environment-aware (Dev/Staging/Production)
- **HTTP Client:** `HttpClientFactory` with delegating handlers for auth injection, retry logic, request/response logging
- **Response Handling:** Consistent error codes; client displays user-friendly messages

### Authentication Flow

1. **Login Page** → User selects authentication method or submits credentials
2. **Three Login Paths:**
   - **SSO (Single Sign-On):** OAuth/OIDC redirect to enterprise identity provider
   - **OAuth:** Third-party OAuth provider (e.g., Google, Microsoft)
   - **Custom:** Email + password form; validated against ASP.NET Identity database
3. **API Call** → POST `/api/v1/auth/login` returns JWT access token + refresh token
4. **Token Storage:** Secure browser localStorage (or SessionStorage for sensitivity)
5. **Auto-Refresh:** Background task refreshes token 5 minutes before expiry
6. **Logout** → Clear tokens; redirect to login
7. **Authorization:** ASP.NET Identity authorization system enforces role-based access control on all endpoints

### State Management

- **Component State:** Scoped `@inject` services (dependency injection)
- **Global State:** `AppState` service (singleton) tracks:
  - Current user identity (claims)
  - Current tenant context
  - Active filters/pagination
  - Modal/sidebar visibility toggles
- **Data Caching:** Repository pattern with in-memory cache + cache invalidation on mutations
- **Real-Time Updates:** SignalR hub subscriptions for CIT status, device alerts (optional; future phase)

### Tenant Isolation & Routing

- **Subdomain-per-Tenant Model:** Each tenant accessed via subdomain: `{tenantname}.recycleriq.com`
- **Tenant Resolution:** Subdomain parsed before login page renders; determines which tenant context to load
- **Tenant in JWT:** JWT includes `TenantId` claim (tenant GUID) and `TenantType` claim (Retail, TaxAuthority, or System)
- **UI Routing Logic:** Routes resolved based on TenantType; non-applicable pages hidden
- **Role-Based Access:**
  - **TenantAdmin:** Can manage users and settings only for their assigned tenant
  - **SystemAdmin:** Can switch tenants via dropdown in navbar; sees all tenants; full access to global admin pages
  - Other roles: Confined to single tenant context
- **Tenant Switching (SystemAdmin Only):** UI component in navbar allows selection of accessible tenants; triggers context reload and navigation

---

## 3. Routing & Navigation

### Overall Structure

```
/
├── /login                              (Public; no auth)
├── /shared/                            (Authenticated; all tenants)
│   ├── /auth/user-profile              (Edit profile, change password)
│   ├── /admin/users                    (User management)
│   ├── /admin/sites                    (Site/location CRUD)
│   ├── /admin/devices                  (Device registry, pairing)
│   ├── /admin/installers               (Installer onboarding, qualification)
│   ├── /admin/maintenance              (System maintenance logs, alerts)
│   ├── /admin/licenses                 (License tracking, renewal)
│   ├── /admin/billing                  (Invoice history, payment method)
│   └── /admin/tenant-settings          (Name, branding, config overrides)
├── /retail/                            (Retail tenant only)
│   ├── /dashboard                      (CIT status, cash forecast, KPIs)
│   ├── /cit/status                     (Real-time CIT shipment tracking)
│   ├── /cit/forecast                   (ML-driven cash demand forecast)
│   ├── /cash/deposits                  (Deposit history, trends)
│   ├── /cash/withdrawals               (Withdrawal history, trends)
│   ├── /cit/reports                    (Custom CIT reports, exports)
│   ├── /shift/reconciliation           (Shift-level cash reconciliation)
│   ├── /cash/flow-by-store             (Multi-store cash flow heatmaps)
│   └── /predictions                    (ML predictions dashboard, confidence bands)
├── /tax-authority/                     (Tax Authority tenant only)
│   ├── /dashboard                      (Collection volumes, operator throughput)
│   ├── /collections/volumes            (Volume trends, capacity planning)
│   ├── /operators/throughput           (Operator activity, performance metrics)
│   ├── /config/municipality            (Municipality master data, codes)
│   ├── /config/tax-year                (Tax year setup, periods)
│   ├── /collections/reports            (Custom collection reports)
│   ├── /operator/activity              (Detailed operator logs, session history)
│   └── /daily-reconciliation           (End-of-day settlement, variance analysis)
└── /admin/system                       (SystemAdmin role only)
    ├── /tenants                        (Tenant CRUD, activation, billing)
    ├── /global-users                   (Cross-tenant user provisioning)
    └── /audit-logs                     (System audit trail, compliance)
```

### Navigation Patterns

- **Top Navbar:** Logo, tenant name (+ switcher for SystemAdmin), user menu (profile, logout), breadcrumbs
- **Sidebar:** Tenant-aware menu; items shown/hidden based on TenantType and user role
- **Breadcrumbs:** Always visible; aid return navigation
- **Tab Navigation:** Within detail pages (e.g., CIT dashboard tabs: Status | Forecast | Reports)

---

## 4. Pages & Features

### 4.1 Shared (All Tenants)
<!-- Jira: RCLOUD-59,RCLOUD-60,RCLOUD-61,RCLOUD-65 | Epic: RCLOUD-8 | Synced: 2026-04-09 -->

#### Login
- Email + password form
- "Remember me" (optional, dev discretion)
- Error messages for invalid credentials, locked accounts
- Link to password reset (out-of-scope for MVP; TBD)

#### User Profile
- View/edit: name, email, phone, timezone, notification preferences
- Change password
- View API keys (if applicable) / regenerate

#### User Management (Admin)
- List all users in tenant
- Add new user (email, role, department)
- Edit user role, status
- Bulk user import (CSV) — future phase
- Delete user (soft delete; audit trail)
- Assign users to sites/departments
- Resend activation email

#### Site/Location CRUD (Admin)
- List all sites: name, code, address, region, status
- Create new site (form validation, geocoding optional)
- Edit site details, operational hours, contact info
- Assign users/devices to site
- Activate/deactivate site
- View site health (device count, last sync, alerts)

#### Device Registry (Admin)
- List all devices: device ID, type (recycler, counter, etc.), site, firmware version, last heartbeat
- Add new device (manual pairing, QR code scan)
- Edit device: name, assignment, thresholds
- Deactivate/retire device
- View device logs, error history
- Firmware update orchestration (future phase)

#### Installer Onboarding (Admin)
- List installers: name, certification status, assignment regions
- Add installer (background check required; TBD process)
- Edit installer details, certifications
- Assign installer to jobs (future phase)
- View installer performance metrics (optional)

#### Maintenance & Admin Logs (Admin)
- System health dashboard: API uptime, database status, cache health
- Maintenance window scheduler
- View error logs, warnings
- Manual cache invalidation tools
- Database maintenance utilities (backup status, etc.)

#### License Management (Admin)
- License summary: current count, expiry date, renewal date
- License types (by site, by user count, feature-gated)
- Renewal workflow
- License usage dashboard (how many seats used vs. purchased)

#### Billing Management (Admin)
- Invoice history: generated date, amount, due date, status, download PDF
- Payment method on file (view only; edit via secure external portal)
- Subscription status: plan name, billing cycle, renewal date
- Usage-based charges (if applicable)
- Billing contact info
- Download invoice

#### Tenant Settings (Tenant Admin)
- Tenant name, logo, brand colors (branding override)
- Operational config: default timezone, date format, currency
- Feature toggles (if applicable; e.g., enable/disable forecasting)
- Notification settings: email recipients, alert thresholds
- Audit log retention policy

---

### 4.2 Retail-Specific
<!-- Jira: RCLOUD-63,RCLOUD-64 | Epic: RCLOUD-8 | Synced: 2026-04-09 -->

#### Dashboard (Home)
- **KPI Cards:** Total cash on hand, pending CIT shipments, cash forecast (30-day), variance from forecast
- **Charts:**
  - Cash balance trend (7-day, 30-day)
  - Deposit vs. withdrawal activity (stacked bar)
  - CIT utilization (% capacity used)
  - Top 5 stores by cash balance (if multi-site)
- **Alerts:** Overdue reconciliation, low-balance warnings, CIT delays
- **Quick Actions:** Initiate CIT request, view latest report

#### CIT Status (Real-Time)
- **Active Shipments Table:**
  - Shipment ID, origin site, destination bank, scheduled pickup, current location (live), ETA
  - Status badge: In Transit, Arrived, Delayed, Completed
  - Actions: View details, request proof-of-delivery (POD)
- **Historical CIT:** Filter by date range, site, status
- **Map View:** (Optional) Live shipment tracking on map
- **Notifications:** Toast alerts for status changes (in-app)

#### Cash Forecast
- **ML-Driven 30/60/90-Day Forecast:**
  - Chart: Projected cash balance vs. capacity threshold
  - Confidence band (80%, 95%, 99%)
  - Recommended CIT dates/sizes (ML-derived)
- **Input Controls:** Override forecast, adjust assumptions
- **Sensitivity Analysis:** What-if scenarios (e.g., "if deposits increase 20%")
- **Export:** PDF forecast report for CFO

#### Deposits & Withdrawals History
- **Deposits Tab:**
  - Table: Date, amount, source (ATM, branch, other), status, reconciliation status
  - Filters: date range, source, status
  - Actions: Mark reconciled, view detail, download receipt
- **Withdrawals Tab:** Similar structure
- **Trends Chart:** Weekly/monthly totals

#### CIT Reports
- **Pre-Built Reports:**
  - CIT Audit Trail (shipment details, driver, timing, amount)
  - CIT Cost Analysis (cost per shipment, cost per location, trending)
  - On-Time Performance (% on-time vs. target)
  - Variance Report (shipped amount vs. forecast)
- **Custom Report Builder:** (Future phase)
- **Export:** PDF, Excel

#### Shift Reconciliation
- **Daily Shift Form:**
  - Opening balance, deposits, withdrawals, ending balance
  - Counted vs. system variance
  - Reconciliation status: Pending, Reconciled, Discrepancy
- **Discrepancy Workflow:**
  - Flag amount/reason
  - Notify manager
  - Approve/reject reconciliation
- **History:** Past reconciliations, trend analysis

#### Cash Flow by Store (Multi-Site)
- **Heatmap:** Stores (rows) vs. time periods (columns), color-coded by balance/utilization
- **Detail Drill-Down:** Click store → view store detail (balance, forecast, alerts)
- **Regional Rollup:** Aggregate by region/district
- **Export:** CSV or PDF regional report

#### Predictions Dashboard (ML)
- **Models Running:**
  - Next-day cash demand (per store)
  - Weekly cash balance forecast
  - CIT shipment size recommendation
  - Anomaly detection (unusual withdrawal patterns)
- **Model Performance:** Accuracy metrics, last training date
- **Feature Importance:** Which factors drive predictions (e.g., store traffic, day of week)
- **Manual Interventions:** Override prediction, mark false positive

---

### 4.3 Tax Authority-Specific
<!-- Jira: RCLOUD-62,RCLOUD-64 | Epic: RCLOUD-8 | Synced: 2026-04-09 -->

#### Dashboard (Home)
- **KPI Cards:** Total collections (period), operator throughput (avg), collection rate (%), variance from plan
- **Charts:**
  - Collections by municipality (pie or bar)
  - Daily collection trend (time series)
  - Operator utilization (% active vs. available)
- **Alerts:** Overdue reconciliation, operator performance flags, system alerts
- **Quick Actions:** View daily report, initiate operator assignment

#### Collection Volumes
- **Volume Tracker Table:**
  - Date, municipality, collected amount, operator, status
  - Filters: date range, municipality, operator
- **Trends Chart:** Daily/weekly totals; forecast vs. actual
- **Capacity Planning:** Current vs. capacity threshold, recommendations
- **Seasonality Analysis:** Expected volumes by period

#### Operator Throughput
- **Operator Leaderboard:**
  - Operator name, collections today/week/month, avg transaction time, collections/hour
  - Status (active, idle, offline)
  - Actions: Assign route, view detail, message
- **Performance Badges:** On-target, exceeds, below-target
- **Historical Trends:** Individual operator productivity over time

#### Municipality Configuration
- **Master Data:**
  - Municipality code, name, region, authority contact
  - Tax year, fiscal period setup
  - Collection schedule (daily, weekly, etc.)
  - Capacity limits, SLAs
- **Create/Edit:** Add new municipality, update config
- **Tax Year Setup:** Link fiscal periods, define holidays, closing dates

#### Tax Year Configuration
- **Tax Year Registry:**
  - Tax year, start/end dates, status (active, closed, archived)
  - Period mapping (months, quarters, custom periods)
  - Holiday calendar
  - Reconciliation cutoff dates
- **Create/Edit:** Define new tax year, update periods

#### Collection Reports
- **Pre-Built Reports:**
  - Daily Collection Summary (by municipality, operator, amount)
  - Tax Compliance Report (collections vs. expected, variance analysis)
  - Operator Performance (transactions, avg transaction, efficiency)
  - Municipality Settlement (period-end reconciliation)
- **Custom Report Builder:** (Future phase)
- **Export:** PDF, Excel

#### Operator Activity Logs
- **Detailed Log Table:**
  - Timestamp, operator, action (login, collection, logout), amount (if collection), location, device
  - Filter/search: operator, date range, action type
- **Session History:** Grouped by operator session; timeline view
- **Audit Trail:** Immutable log for compliance

#### Daily Reconciliation
- **Settlement Form:**
  - Opening balance, collections received, disbursements, ending balance
  - Expected vs. actual variance
  - Status: Pending, Reconciled, Exception
- **Exception Workflow:**
  - Investigate discrepancy
  - Approve/reject settlement
  - Notify accounting
- **Historical View:** Past reconciliations, variance trending

---

## 5. Authentication & Authorization
<!-- Jira: RCLOUD-58 | Epic: RCLOUD-8 | Synced: 2026-04-09 -->

### JWT Token Structure

```json
{
  "sub": "user@tenant.com",
  "tenant_id": "tenant-guid-123",
  "tenant_type": "Retail|TaxAuthority|System",
  "roles": ["User", "Admin", "SystemAdmin"],
  "site_ids": ["site-1", "site-2"],
  "exp": 1711094400,
  "iat": 1711008000
}
```

### Role-Based UI Visibility

- **User:** View-only dashboards, reports, user profile
- **Admin:** Full CRUD on users, sites, devices, settings
- **SystemAdmin:** Tenant switching, global user management, audit logs
- **Retail:** Access retail-specific pages (CIT, forecasts)
- **TaxAuthority:** Access tax authority-specific pages (collections, operators)

### Tenant Switching (SystemAdmin)

1. **UI Component:** Dropdown in navbar showing accessible tenants
2. **Workflow:**
   - User selects new tenant
   - Frontend calls `POST /api/v1/auth/switch-tenant?tenantId=...`
   - Backend returns new JWT with updated tenant context
   - App reloads navigation and clears cached data for previous tenant
3. **Audit Trail:** Log all tenant switches for compliance

### Authorization Checks

- **Backend Enforcement:** All API endpoints validate JWT claims and tenant context
- **Frontend Enforcement:** Hide UI elements for unauthorized roles; prevent unauthorized navigation
- **Graceful Degradation:** If user navigates to unauthorized route, redirect to dashboard with warning

---

## 6. UI/UX Requirements

### Brand & Design System

- **Color Palette (Monochromatic Blue):**
  - Deep Navy: `#0F084B` (backgrounds, text, primary buttons)
  - Dark Blue: `#26408B` (secondary elements, borders)
  - Medium Blue (Primary): `#3D60A7` (CTA buttons, links, active states)
  - Light Blue: `#81B1D5` (hover states, light backgrounds)
  - Pale Blue: `#A0D2E7` (disabled states, subtle backgrounds)

- **Typography:**
  - Font Family: Arial (system fallback: Helvetica, sans-serif)
  - Headings: Bold (weight 700)
  - Body: Regular (weight 400)
  - Sizes: H1 (32px), H2 (24px), H3 (18px), Body (14px), Small (12px)

- **Component Library:** Reuse all Razor components from `[ProductName].UI.Shared`
  - Buttons (primary, secondary, danger, ghost)
  - Forms (input, select, checkbox, radio, textarea, datepicker)
  - Tables (sortable, paginated, selectable)
  - Cards, modals, toasts, alerts
  - Navigation components (navbar, sidebar, breadcrumbs)

- **Reference:** RecyclerIQ_BrandGuide.md for complete theme spec, component usage, spacing grid

### Responsive Design

- **Breakpoints:**
  - Mobile: 320px–480px (portrait, landscape)
  - Tablet: 481px–1024px
  - Desktop: 1025px+ (2K, 4K support)

- **Mobile Considerations:**
  - Collapsible sidebar
  - Stacked tables (cards on mobile)
  - Touch-friendly buttons (min 44x44 px)
  - Simplified charts/dashboards

- **Progressive Enhancement:** Essential functionality works without JavaScript (graceful degradation)

### Accessibility (WCAG 2.1 Level AA)

⚠ **GAP:** Detailed accessibility requirements (ARIA labels, color contrast verification, keyboard navigation spec) not yet defined. See Section 9.

- **Minimum Requirements:**
  - All interactive elements must have keyboard focus indicators
  - Form inputs labeled with `<label>` or `aria-label`
  - Color not sole means of conveying information (use icons, text labels)
  - Contrast ratio ≥ 4.5:1 for normal text
  - All buttons/links have descriptive text or `aria-label`
  - Alt text for all images
  - Semantic HTML (`<button>`, `<nav>`, `<main>`, etc.)

### User Experience Patterns

- **Empty States:** Friendly messaging + actionable CTA when no data (e.g., "No shipments yet. [Create CIT]")
- **Loading States:** Skeleton screens or spinners for async operations
- **Error Handling:** Clear error messages with actionable next steps (not error codes)
- **Confirmation Dialogs:** Required for destructive actions (delete, archive)
- **Notifications:** Toast messages (top-right) for success, warnings, errors
- **Undo/Redo:** Not required for MVP; consider for future phase

---

## 7. Data & API Integration

### Cloud API Endpoints Consumed

The Blazor portal consumes the following Cloud API (ASP.NET Core) endpoints. Full contracts in Master_PRD_v3.docx.

#### Authentication
- `POST /api/v1/auth/login` → JWT + refresh token
- `POST /api/v1/auth/refresh` → New access token
- `POST /api/v1/auth/logout` → Invalidate tokens
- `POST /api/v1/auth/switch-tenant` → Switch tenant context (SystemAdmin)

#### User Management
- `GET /api/v1/users` → List users (paginated, filterable)
- `POST /api/v1/users` → Create user
- `GET /api/v1/users/{id}` → Get user detail
- `PUT /api/v1/users/{id}` → Update user
- `DELETE /api/v1/users/{id}` → Delete user (soft delete)
- `POST /api/v1/users/{id}/resend-activation` → Resend activation email

#### Sites
- `GET /api/v1/sites` → List sites
- `POST /api/v1/sites` → Create site
- `GET /api/v1/sites/{id}` → Get site detail
- `PUT /api/v1/sites/{id}` → Update site
- `DELETE /api/v1/sites/{id}` → Delete site
- `GET /api/v1/sites/{id}/health` → Site health status

#### Devices
- `GET /api/v1/devices` → List devices
- `POST /api/v1/devices` → Register device
- `GET /api/v1/devices/{id}` → Get device detail
- `PUT /api/v1/devices/{id}` → Update device
- `DELETE /api/v1/devices/{id}` → Deactivate device
- `GET /api/v1/devices/{id}/logs` → Device event logs

#### CIT (Retail)
- `GET /api/v1/cit/shipments` → List CIT shipments
- `GET /api/v1/cit/shipments/{id}` → Get shipment detail
- `POST /api/v1/cit/shipments` → Create new CIT request
- `GET /api/v1/cit/forecast` → 30/60/90-day cash forecast (ML)
- `GET /api/v1/cit/reports/{reportId}` → Generate/fetch CIT report

#### Cash (Retail)
- `GET /api/v1/cash/deposits` → List deposits
- `GET /api/v1/cash/withdrawals` → List withdrawals
- `POST /api/v1/cash/reconciliation` → Submit shift reconciliation
- `GET /api/v1/cash/flow-by-store` → Multi-store cash flow data

#### ML Predictions (Retail)
- `GET /api/v1/predictions/models` → List active prediction models
- `GET /api/v1/predictions/{modelId}/forecast` → Get forecast for model
- `GET /api/v1/predictions/{modelId}/performance` → Model accuracy metrics

#### Collections (Tax Authority)
- `GET /api/v1/collections/volumes` → Collection volumes by period
- `GET /api/v1/collections/operators` → Operator throughput data
- `GET /api/v1/collections/reports/{reportId}` → Generate/fetch report

#### Configuration (Tax Authority)
- `GET /api/v1/config/municipalities` → List municipalities
- `POST /api/v1/config/municipalities` → Create municipality
- `PUT /api/v1/config/municipalities/{id}` → Update municipality
- `GET /api/v1/config/tax-years` → List tax years
- `POST /api/v1/config/tax-years` → Create tax year

#### Operator Activity (Tax Authority)
- `GET /api/v1/operators` → List operators
- `GET /api/v1/operators/{id}/activity` → Operator activity logs
- `GET /api/v1/operators/{id}/performance` → Operator metrics

#### Shared Admin
- `GET /api/v1/licenses` → License summary
- `GET /api/v1/billing/invoices` → List invoices
- `GET /api/v1/billing/invoices/{id}/pdf` → Download invoice PDF
- `GET /api/v1/audit-logs` → Audit trail (SystemAdmin)
- `GET /api/v1/tenants` → List tenants (SystemAdmin)

### Caching Strategy

- **HTTP Cache Headers:** Cache GET requests where appropriate (e.g., list pages, read-only data)
  - Short TTL (5 min) for frequently updated data (CIT status, operator activity)
  - Longer TTL (1 hr) for static config (sites, municipalities, tax years)
  - No cache for user-specific data (profile, preferences)

- **In-Memory Cache (Client-Side):**
  - User claims + tenant context (until logout or token refresh)
  - Site/location list (invalidate on create/update/delete)
  - Device registry (invalidate on hardware change)
  - Tax year + municipality config (invalidate on admin edit)

- **Cache Invalidation:**
  - Automatic: On mutations (POST/PUT/DELETE)
  - Manual: Admin can force cache refresh via Maintenance page
  - Signal-R (Future): Real-time invalidation for multi-user scenarios

### Rate Limiting & Resilience

- **Rate Limit Handling:** Implement exponential backoff for failed API calls
- **Retry Logic:** 3 retries for transient errors (5xx); no retry for 4xx client errors
- **Timeout:** 30-second timeout per request; fall back to cached data if available
- **Offline Fallback:** Show cached data with "offline" badge; queue actions for sync when online (future phase)

---

## 8. Non-Functional Requirements

### Performance Targets

- **Initial Load Time:** < 3 seconds (DOMContentLoaded)
- **Subsequent Page Navigation:** < 500 ms (client-side routing)
- **API Response Time:** Median < 200 ms; 95th percentile < 1 s
- **Search/Filter:** < 100 ms for < 10k records in-memory
- **Chart Rendering:** < 500 ms for typical dataset (< 1000 points)

### Bundle Size & Lazy Loading

- **Initial Bundle:** < 2 MB (uncompressed); < 600 KB gzipped
  - Blazor runtime + framework: ~1.2 MB
  - App code + dependencies: ~600 KB
  - Shared components: ~200 KB

- **Lazy Loading:**
  - Load retail-specific modules only for retail tenants (estimated 300 KB savings)
  - Load tax authority-specific modules only for tax authority tenants (estimated 250 KB savings)
  - Load charts/reports library on-demand (e.g., when user navigates to reports page)

- **Code Splitting:** Leverage Blazor lazy component loading (`lazy="true"`) for non-critical pages

### Browser Support

- **Modern Browsers:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **WebAssembly:** All target browsers support WASM
- **Mobile:** iOS Safari 14+, Android Chrome 90+
- **Polyfills:** None required for WASM baseline; consider polyfills for older clients (pre-MVP)

### Offline Support

- **No Offline Mode for Portal:** Blazor Portal is cloud-connected web app; requires active internet connectivity
- **Portal does not support offline transaction queuing or cached data**
- **Rationale:** Portal is admin/operational dashboard, not primary transaction app; local MAUI apps handle offline cash operations
- **User Impact:** If connection lost, portal displays "offline" state; users directed to retry actions on reconnect

### Accessibility Testing

- **Automated Testing:** Run axe-core or similar on every page build
- **Manual Testing:** Keyboard navigation, screen reader testing (NVDA/JAWS), color contrast verification
- **Compliance:** WCAG 2.1 Level AA (minimum); consider AAA for critical flows

### Deployment & DevOps

- **CI/CD:** Build on every commit; deploy to staging on PR merge; manual promotion to production
- **Build Time:** < 5 minutes for full build + test
- **Artifact:** Publish as Docker image + push to Azure Container Registry (ACR)
- **Hosting:** Azure Static Web Apps (serverless SPA) or AKS (if SPA + BFF required)
- **CDN:** Azure Front Door or Azure CDN for global distribution
- **Monitoring:** Application Insights (error tracking, performance), log aggregation (ELK or Azure Log Analytics)

---

## 9. Open Items & Gaps

### ⚠ Critical Gaps

1. **No Wireframes/Mockups**
   - **Impact:** Designers and developers lack visual reference; risk of scope creep and misalignment
   - **Action:** Produce Figma/AdobeXD mockups for 3–5 key pages before development kickoff
   - **Timeline:** Week 1–2 of project

2. **No Detailed Page Specifications**
   - **Impact:** Developers must infer UI structure, field requirements, validation rules
   - **Action:** Create detailed page specs (component breakdown, form fields, business logic flow) for each page listed in Section 4
   - **Timeline:** During design phase; reviewed with product & engineering

3. **No Accessibility Requirements (WCAG Details)**
   - **Impact:** Unclear compliance bar; risk of post-launch accessibility debt
   - **Action:** Define accessibility checklist (ARIA labels, keyboard focus, color contrast rules); integrate into dev-ready specs
   - **Timeline:** Before development; assign accessibility owner
   - **Reference:** WCAG 2.1 Level AA (minimum standard)

4. **No Internationalization (i18n) Plan**
   - **Impact:** UI currently hard-coded to English; multi-region deployments unclear
   - **Action:** Decide: (a) localize UI + API responses, or (b) ship English-only for MVP, plan i18n for v2
   - **Timeline:** Before development kickoff
   - **Recommendation:** Use Blazor Localization (`.resx` + `IStringLocalizer`) for future-proofing

5. **No Offline/PWA Strategy**
   - **Impact:** Users with poor connectivity cannot function; no install-as-app experience
   - **Action:** Decide scope: cache-first strategy, service worker implementation, sync queue for mutations
   - **Timeline:** Define for MVP (likely out-of-scope) or backlog for v1.1
   - **Recommendation:** MVP = online-only; v1.1 = offline read + queued mutations

6. **Permission Matrix Not Finalized**
   - **Impact:** Role-based UI visibility rules unclear; risk of over/under-exposing features
   - **Action:** Create RACI matrix for each page × user role; document feature toggles
   - **Timeline:** Before dev-ready spec phase
   - **Stakeholders:** Product, Security, Customer Success

### ⚠ Medium-Priority Items

7. **No Detailed API Contract Specs**
   - **Current State:** Master PRD outlines endpoints; no OpenAPI/Swagger specs
   - **Action:** Generate OpenAPI 3.0 spec from backend code; validate all request/response schemas
   - **Timeline:** In parallel with frontend development
   - **Tool:** Swashbuckle (ASP.NET Core)

8. **No Error Handling UX Design**
   - **Current State:** Error messages are functional; no user-friendly messaging
   - **Action:** Define error code → user message mapping; design error recovery flows
   - **Timeline:** During design phase; implement in dev-ready specs

9. **No Data Export/Reporting UI Spec**
   - **Current State:** Reports are mentioned; no detail on export formats, scheduling, email delivery
   - **Action:** Define report builder UX, export options (PDF/CSV/Excel), sharing mechanisms
   - **Timeline:** Backlog for post-MVP; scope for v1.1

10. **No Notification/Alert Strategy**
    - **Current State:** Alerts mentioned (overdue reconciliation, CIT delays); no delivery mechanism spec
    - **Action:** Decide: email, in-app toast, push notifications; define alert thresholds per role
    - **Timeline:** Post-MVP or backlog v1.1

11. **No Internationalization of Date/Time/Currency Formats**
    - **Current State:** Assume US format (MM/DD/YYYY, USD)
    - **Action:** Support regional formats; tie to user timezone + locale
    - **Timeline:** Backlog v1.1 if multi-region supported

### ⚠ Lower-Priority Items (Future Phases)

12. **Analytics & Usage Tracking**
    - Recommend post-MVP: track user journeys, feature adoption, error rates
    - Tool: Application Insights or Segment

13. **Multi-Tenant Real-Time Collaboration**
    - Future phase: Real-time updates via SignalR when multiple users editing shared data
    - Example: Simultaneous reconciliation attempts; notifications for live changes

14. **Advanced Search & Filtering**
    - Recommend backlog: full-text search, saved filters, advanced query builder for reports
    - Impact: Low for MVP; useful for power users

15. **Bulk Operations**
    - Recommend backlog: bulk user import, bulk site setup, bulk reconciliation
    - Impact: Quality-of-life improvement for admins

---

## 10. Development Checklist & Handoff Notes

### Pre-Development Kickoff

- [ ] Product stakeholders & engineering aligned on all open items (Section 9)
- [ ] Design mockups delivered (Figma/AdobeXD) and reviewed by engineering
- [ ] Dev-ready specs written for all pages in Section 4 (component breakdown, validation rules, API calls)
- [ ] Permission matrix finalized; feature toggles documented
- [ ] Accessibility checklist created (WCAG 2.1 AA compliance)
- [ ] OpenAPI spec generated from backend; request/response schemas validated
- [ ] Team trained on: Blazor WASM patterns, multi-tenant architecture, state management approach

### Development Phases

1. **Phase 1: Foundation (Weeks 1–2)**
   - Project setup: Blazor WASM template, dependency injection, routing
   - Shared layout: navbar, sidebar, breadcrumbs, footer
   - Authentication flow: login, token management, logout
   - `AppState` service + caching layer

2. **Phase 2: Shared Features (Weeks 3–4)**
   - User profile, user management, site/location CRUD
   - Device registry, license/billing pages
   - Tenant settings, admin logs

3. **Phase 3: Retail Features (Weeks 5–6)**
   - Dashboard, CIT status, cash forecast
   - Deposits/withdrawals, reports, shift reconciliation
   - Predictions dashboard, multi-store cash flow

4. **Phase 4: Tax Authority Features (Weeks 7–8)**
   - Dashboard, collection volumes, operator throughput
   - Municipality/tax year config
   - Collections reports, operator activity, daily reconciliation

5. **Phase 5: Polish & Testing (Week 9)**
   - Cross-browser testing (Chrome, Firefox, Safari, Edge)
   - Mobile responsiveness validation
   - Accessibility audit (axe-core, manual testing)
   - Performance optimization (bundle size, lazy loading)
   - Load testing (simulate concurrent users)

6. **Phase 6: Deployment & Go-Live (Week 10)**
   - Deploy to staging; UAT with stakeholders
   - Fix blockers identified in UAT
   - Deploy to production; monitor error rates, performance

### Testing Strategy

- **Unit Tests:** Component logic, utility functions (target: > 80% coverage)
- **Integration Tests:** API mocking, state management, navigation flows
- **E2E Tests:** Critical user journeys (login → create CIT → view forecast; login → reconcile shift)
- **Tools:** xUnit (unit), Moq (mocking), Selenium/Playwright (E2E)

### Documentation for Developers

- **Architecture ADR:** Blazor WASM design decisions, state management rationale
- **Component Library Guide:** Usage of shared Razor components (with examples)
- **API Integration Guide:** How to call Cloud API, handle errors, manage tokens
- **Deployment Guide:** Build, test, deploy to Azure Static Web Apps
- **Troubleshooting Guide:** Common issues, known browser quirks, debugging WASM

---

## Appendix A: Glossary

| Term | Definition |
|------|-----------|
| **WASM** | WebAssembly; binary format for client-side execution in browsers |
| **SPA** | Single Page Application; client-side routing, minimal server round-trips |
| **JWT** | JSON Web Token; stateless authentication credential |
| **MediatR** | .NET library for CQRS pattern; command/query handler orchestration |
| **CIT** | Cash In Transit; secure armored transport of currency |
| **TenantType** | Classification of tenant (Retail, TaxAuthority, System) |
| **RCS** | Razor Component Specifications (detailed page component breakdown) |
| **WCAG** | Web Content Accessibility Guidelines; A/AA/AAA compliance levels |
| **ARIA** | Accessible Rich Internet Applications; semantic markup for screen readers |

---

## Appendix B: References

- **Master PRD:** Master_PRD_v3.docx (authoritative product requirements)
- **Brand Guide:** RecyclerIQ_BrandGuide.md (color palette, typography, components)
- **UI Shared Library:** [ProductName].UI.Shared NuGet package (reusable Razor components)
- **Cloud API Docs:** (TBD link to OpenAPI spec or Swagger UI)
- **Blazor Docs:** https://learn.microsoft.com/en-us/aspnet/core/blazor/ (.NET official docs)
- **WCAG 2.1:** https://www.w3.org/WAI/WCAG21/quickref/ (accessibility standard)

---

**Document Version History:**
- v1.0 (2026-03-22) — Initial draft for engineering kickoff

---

**Approval & Sign-Off:**
- [ ] Product Manager
- [ ] Engineering Lead
- [ ] Design Lead
- [ ] Security/Compliance Review

