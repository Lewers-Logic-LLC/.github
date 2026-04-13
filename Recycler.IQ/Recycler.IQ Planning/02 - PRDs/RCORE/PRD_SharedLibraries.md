# Recycler.IQ Shared Libraries & Common Projects — Sub-PRD

**Company:** Lewers Logic LLC

**Document Version:** 1.0
**Date:** 2026-03-22
**Product:** Recycler.IQ (Working Name: Recycler.IQ)
**Audience:** Development Team
**Status:** Final

---

## 1. Overview

### Purpose

Shared libraries provide a single source of truth for domain logic, UI components, hardware abstractions, and infrastructure contracts across the Recycler.IQ platform. These projects eliminate duplication, enforce architectural consistency, and enable seamless integration between the Tax Authority app, Retail app, and future Web Portal.

### Scope

This sub-PRD defines the architecture, contents, and evolution strategy for five shared libraries. Domain, Common, and Protos are published as NuGet packages — UI.Shared and Hardware live in their single-consumer repos as project references (see [Repository Structure ADR](../03%20-%20Architecture%20Decisions/repository-structure-decisions.md)):

- **RecyclerIQ.Domain** — Domain model with zero external dependencies *(NuGet — recycleriq-core repo)*
- **RecyclerIQ.Common** — Shared utilities, extensions, constants, and DTOs *(NuGet — recycleriq-core repo)*
- **RecyclerIQ.Protos** — gRPC .proto service definitions and generated C# client/server stubs *(NuGet — recycleriq-core repo)*
- **RecyclerIQ.UI.Shared** — Razor Class Library (RCL) with reusable UI components *(project reference — recycleriq-clients repo)*
- **RecyclerIQ.Hardware** — Hardware abstraction layer (IRecycler interface + implementations) *(project reference — recycleriq-link repo)*

### Relationship to Master PRD

This document is subordinate to the Master PRD and elaborates on the "Shared Library Strategy" section. It assumes:
- Clean Architecture layering (Domain → Application → Infrastructure → UI)
- Event-driven communication via Azure Service Bus
- Deployment to Azure (AKS, App Service, Azure SQL)
- Team of 3 developers

References:
- Master_PRD_v3.docx — Core product requirements, user stories, go-to-market
- This document — Shared library architecture and contracts

---

## 2. Domain Project (`RecyclerIQ.Domain`)
<!-- Jira: RCORE-96 | Epic: RCORE-94 | Synced: 2026-04-11 -->

### Purpose

The Domain project encapsulates all business logic, entities, enums, interfaces, domain events, and value objects. It must have **zero external dependencies** (only .NET Framework libraries).

### Core Entities
<!-- Jira: RCORE-100,RCORE-101,RCORE-102,RCORE-103,RCORE-104,RCORE-105,RCORE-106 | Epic: RCORE-95 | Synced: 2026-04-11 -->

| Entity | Purpose | Key Properties | Notes |
|--------|---------|-----------------|-------|
| **Tenant** | Represents a Tax Authority or Retail organization | Id, Name, TenantType, Status, LicenseId, DateCreated | Multi-tenant SaaS root aggregate |
| **RetailProfile** | Configuration for a Retail tenant | TenantId, StorageLocation, ApprovedDenominations, LiquidityThreshold | Retail-specific settings |
| **TaxAuthorityProfile** | Configuration for a Tax Authority tenant | TenantId, JurisdictionCode, RemittanceSchedule, ReportingRequirements | Tax Authority-specific settings |
| **Region** | Geographic region (state, province, or district) | Id, Name, TenantId, Code | Used for reporting and compliance |
| **Store** | Physical retail location | Id, Name, TenantId, Address, RegionId, ManagerId | Contains devices |
| **Device** | Cash recycler hardware unit | Id, StoreId, SerialNumber, Model, Status, FirmwareVersion, LastSyncUtc | Hardware asset |
| **Transaction** | Single cash handling operation | Id, DeviceId, Type, Amount, CashDetails, UserId, Timestamp, Status | Core audit trail |
| **License** | Subscription/usage entitlement | Id, TenantId, LicenseType, ExpiryDate, TransactionLimit, Status | Billing linked |
| **User** | Human actor in the system | Id, TenantId, Email, Name, Roles, Status, CreatedUtc | RBAC subject |
| **UserRole** | Role assignment | UserId, RoleId, TenantId, GrantedUtc | Supports multi-tenant RBAC |
| **CashDenomination** | Cash value type definition (USD $1, $5, $10, etc.) | Id, Value, CurrencyCode, IsActive | Master data |
| **DenominationSnapshot** | Inventory state at a point in time | TransactionId, DenominationId, Count, Value | Audit trail for inventory |
| **CITEvent** | Cash-In-Transit operation (pickup/delivery) | Id, DeviceId, EventType, ScheduledDate, CompletedDate, RouteId, CITProvider | Logistics integration |
| **AuditLog** | Immutable record of all actions | Id, TenantId, EntityType, EntityId, Action, UserId, Timestamp, Changes | Compliance & debugging |
| **BillingRecord** | Usage-based billing line item | Id, TenantId, Period, TransactionCount, StorageUsage, Amount, Status | Billing module integration |
| **Alert** | System-generated alert (inventory, anomaly, error) | Id, TenantId, DeviceId, Type, Severity, Message, CreatedUtc, AcknowledgedUtc | Operator notifications |

### Core Enums
<!-- Jira: RCORE-108 | Epic: RCORE-95 | Synced: 2026-04-11 -->

```csharp
// TenantType — Licensing category
public enum TenantType
{
    Retail = 1,
    TaxAuthority = 2
}

// TransactionType — Cash operation classification
public enum TransactionType
{
    Deposit = 1,
    Withdrawal = 2,
    Transfer = 3,
    ShiftOpen = 4,
    ShiftClose = 5,
    TaxCollection = 6
}

// DeviceStatus — Hardware lifecycle state
public enum DeviceStatus
{
    Offline = 0,
    Online = 1,
    Maintenance = 2,
    Decommissioned = 3
}

// LicenseType — Subscription tier
public enum LicenseType
{
    Starter = 1,
    Professional = 2,
    Enterprise = 3
}

// AlertSeverity — Alert urgency
public enum AlertSeverity
{
    Info = 1,
    Warning = 2,
    Critical = 3
}

// TransactionStatus — Completion state
public enum TransactionStatus
{
    Pending = 0,
    Completed = 1,
    Failed = 2,
    Reversed = 3
}
```

### Domain Events
<!-- Jira: N/A | Note: Design documentation — no story needed -->

Domain events represent significant business occurrences that drive asynchronous workflows and cross-aggregate communication.

| Domain Event | Trigger | Consumers | Properties |
|--------------|---------|-----------|-----------|
| **TenantCreatedEvent** | New tenant provisioned | License service, Audit logger | TenantId, TenantType, Name |
| **TransactionCompletedEvent** | Cash operation finalized | Billing service, Audit logger, Sync engine | TransactionId, TenantId, Amount, Type, Timestamp |
| **DeviceRegisteredEvent** | Device added to system | Sync engine, License validator | DeviceId, StoreId, SerialNumber, Model |
| **DeviceOfflineEvent** | Device loses connectivity | Alert service, Monitoring | DeviceId, LastSeenUtc, DurationMinutes |
| **InventoryLowEvent** | Denomination count below threshold | Alert service, CIT planner | DeviceId, DenominationId, CurrentCount, ThresholdCount |
| **LicenseExpiringEvent** | Subscription approaching end date | Billing service, Notification service | LicenseId, TenantId, DaysRemaining |
| **AuditLogCreatedEvent** | Critical action recorded | Compliance dashboard, Archive service | AuditLogId, TenantId, Action |
| **SyncRequestInitiatedEvent** | Device synchronization requested | Sync engine, Hardware service | DeviceId, SyncId, RequestedUtc |
| **CITEventCompletedEvent** | Cash pickup/delivery completed | Billing service, Inventory service | CITEventId, DeviceId, ActualDate, RouteId |

### Value Objects
<!-- Jira: RCORE-107 | Epic: RCORE-95 | Synced: 2026-04-11 -->

Value objects encapsulate domain concepts with immutability and identity equality.

```csharp
// Money — Amount + Currency with no rounding errors
public record Money(decimal Amount, string CurrencyCode = "USD")
{
    public Money Add(Money other) => new(Amount + other.Amount, CurrencyCode);
    public Money Subtract(Money other) => new(Amount - other.Amount, CurrencyCode);
}

// CashBreakdown — Quantity per denomination (e.g., 15×$20 + 8×$5)
public record CashBreakdown(Dictionary<CashDenominationId, int> QuantitiesByDenomination)
{
    public Money GetTotalValue(IDictionary<CashDenominationId, decimal> denominationValues)
    {
        var total = 0m;
        foreach (var kvp in QuantitiesByDenomination)
        {
            if (denominationValues.TryGetValue(kvp.Key, out var value))
                total += kvp.Value * value;
        }
        return new Money(total);
    }
}

// Address — Structured location
public record Address(string Street, string City, string State, string PostalCode, string Country);

// TimeRange — Inclusive start/end interval
public record TimeRange(DateTime StartUtc, DateTime EndUtc)
{
    public bool Contains(DateTime moment) => moment >= StartUtc && moment <= EndUtc;
    public TimeSpan Duration => EndUtc - StartUtc;
}

// HardwareIdentity — Device fingerprint
public record HardwareIdentity(string SerialNumber, string Model, string ManufacturerCode);
```

### Aggregate Roots
<!-- Jira: N/A | Note: Design documentation — no story needed -->

Aggregates define transaction boundaries and enforce invariants.

**Store Aggregate**
- Root: `Store` entity
- Children: `Device` (multiple), `User` (multiple), `CITEvent` (historical)
- Invariants:
  - All devices must belong to exactly one store
  - A device cannot exist without a parent store
  - Store can have multiple users with different roles

**Device Aggregate**
- Root: `Device` entity
- Children: `Transaction` (historical), `DenominationSnapshot` (historical), `Alert` (active)
- Invariants:
  - All transactions reference exactly one device
  - Device status transitions follow a defined state machine (Offline ↔ Online → Maintenance → Decommissioned)
  - Cannot add transactions to a decommissioned device

**Tenant Aggregate**
- Root: `Tenant` entity
- Children: `License`, `RetailProfile` or `TaxAuthorityProfile`, `User` (multiple), `Region` (multiple)
- Invariants:
  - Exactly one active license per tenant at any time
  - Tenant type determines which profile is required (cannot have both)
  - Deletion cascades to all children

### Interfaces Defined in Domain
<!-- Jira: RCORE-107,RCORE-109,RCORE-110 | Epic: RCORE-95 | Synced: 2026-04-11 -->

These interfaces are implemented in Infrastructure but defined in Domain to maintain zero external dependencies.

```csharp
// Hardware abstraction (detailed in Section 5)
public interface IRecycler
{
    Task<bool> ConnectAsync(CancellationToken ct);
    Task<bool> DisconnectAsync(CancellationToken ct);
    Task<HardwareInventory> GetInventoryAsync(CancellationToken ct);
    Task<bool> StartDepositAsync(CancellationToken ct);
    Task<bool> EndDepositAsync(CancellationToken ct);
    Task<bool> WithdrawAsync(Money amount, CashBreakdown breakdown, CancellationToken ct);
    Task<bool> InsertBillAsync(CashDenomination denomination, CancellationToken ct);
}

// Repository pattern (unit of work)
public interface IRepository<T> where T : Entity
{
    Task<T> GetByIdAsync(Guid id, CancellationToken ct);
    Task<IEnumerable<T>> GetAllAsync(CancellationToken ct);
    Task AddAsync(T entity, CancellationToken ct);
    Task UpdateAsync(T entity, CancellationToken ct);
    Task DeleteAsync(T entity, CancellationToken ct);
}

public interface ITenantRepository : IRepository<Tenant> { }
public interface IDeviceRepository : IRepository<Device> { }
public interface ITransactionRepository : IRepository<Transaction> { }
public interface IUserRepository : IRepository<User> { }
public interface IAuditLogRepository : IRepository<AuditLog> { }

// Specification pattern (complex queries, DDD-compliant)
public interface ISpecification<T> where T : Entity
{
    Expression<Func<T, bool>> Criteria { get; }
    IReadOnlyList<Expression<Func<T, object>>> Includes { get; }
    IReadOnlyList<string> IncludeStrings { get; }
    Expression<Func<T, object>> OrderBy { get; }
    Expression<Func<T, object>> OrderByDescending { get; }
    int Take { get; }
    int Skip { get; }
    bool IsPagingEnabled { get; }
}
```

### Zero-Dependency Rule
<!-- Jira: N/A | Note: Design documentation — no story needed -->

The Domain project **must not reference**:
- Any infrastructure packages (EF Core, Dapper, AutoMapper, etc.)
- Azure SDKs (Service Bus, Storage, etc.)
- Web frameworks (ASP.NET Core, MVC, Blazor, MAUI)
- Third-party business logic libraries
- UI frameworks

**Allowed:**
- .NET Base Class Library (System.*, System.Linq, System.Collections.Generic)
- System.ComponentModel.DataAnnotations (for attributes only)
- MediatR (for domain event dispatching)
- Custom domain-specific libraries (e.g., RecyclerIQ.ValueObjects)

### Structure
<!-- Jira: RCORE-96 | Epic: RCORE-94 | Synced: 2026-04-11 -->

```
RecyclerIQ.Domain/
├── Aggregates/
│   ├── Tenant/
│   │   ├── Tenant.cs
│   │   ├── TenantId.cs
│   │   └── TenantType.cs
│   ├── Store/
│   │   ├── Store.cs
│   │   ├── StoreId.cs
│   │   └── Events/
│   │       └── StoreCreatedEvent.cs
│   ├── Device/
│   │   ├── Device.cs
│   │   ├── DeviceId.cs
│   │   ├── DeviceStatus.cs
│   │   └── Events/
│   │       ├── DeviceRegisteredEvent.cs
│   │       ├── DeviceOnlineEvent.cs
│   │       └── DeviceOfflineEvent.cs
│   ├── Transaction/
│   │   ├── Transaction.cs
│   │   ├── TransactionId.cs
│   │   ├── TransactionType.cs
│   │   ├── TransactionStatus.cs
│   │   └── Events/
│   │       └── TransactionCompletedEvent.cs
│   ├── User/
│   │   ├── User.cs
│   │   ├── UserId.cs
│   │   └── UserRole.cs
│   └── License/
│       ├── License.cs
│       ├── LicenseId.cs
│       ├── LicenseType.cs
│       └── Events/
│           └── LicenseExpiringEvent.cs
├── ValueObjects/
│   ├── Money.cs
│   ├── CashBreakdown.cs
│   ├── Address.cs
│   ├── TimeRange.cs
│   └── HardwareIdentity.cs
├── Entities/
│   ├── Entity.cs (Base class)
│   ├── CashDenomination.cs
│   ├── Region.cs
│   ├── AuditLog.cs
│   ├── Alert.cs
│   ├── CITEvent.cs
│   └── BillingRecord.cs
├── DomainEvents/
│   ├── DomainEvent.cs (Base class)
│   ├── TenantCreatedEvent.cs
│   ├── TransactionCompletedEvent.cs
│   ├── DeviceOfflineEvent.cs
│   ├── InventoryLowEvent.cs
│   ├── LicenseExpiringEvent.cs
│   ├── SyncRequestInitiatedEvent.cs
│   └── CITEventCompletedEvent.cs
├── Interfaces/
│   ├── IRecycler.cs
│   ├── IRepository.cs
│   ├── ISpecification.cs
│   ├── ITenantRepository.cs
│   ├── IDeviceRepository.cs
│   ├── ITransactionRepository.cs
│   ├── IUserRepository.cs
│   ├── IAuditLogRepository.cs
│   └── IBillingService.cs
├── Enums/
│   ├── TenantType.cs
│   ├── TransactionType.cs
│   ├── DeviceStatus.cs
│   ├── LicenseType.cs
│   ├── AlertSeverity.cs
│   └── TransactionStatus.cs
└── Exceptions/
    ├── DomainException.cs (Base)
    ├── InvalidTenantException.cs
    ├── DeviceOfflineException.cs
    ├── InsufficientInventoryException.cs
    └── LicenseExpiredException.cs
```

---

## 3. Common Project (`RecyclerIQ.Common`)
<!-- Jira: RCORE-96 | Epic: RCORE-94 | Synced: 2026-04-11 -->

### Purpose

Provides utilities, extensions, constants, shared DTOs, and result types used across Application, Infrastructure, and UI layers. This project **may depend on Domain** but must remain lightweight and reusable.

### Contents

#### 3.1 Utilities

**Result<T> Pattern** — Functional error handling (no exceptions in control flow)

```csharp
public record Result<T>(T? Data, bool IsSuccess, string? ErrorMessage = null)
{
    public static Result<T> Success(T data) => new(data, true);
    public static Result<T> Failure(string error) => new(null, false, error);

    public Result<U> Map<U>(Func<T, U> transform) =>
        IsSuccess ? Result<U>.Success(transform(Data!)) : Result<U>.Failure(ErrorMessage);

    public Result<T> Bind(Func<T, Result<T>> f) =>
        IsSuccess ? f(Data!) : this;
}

public record Result(bool IsSuccess, string? ErrorMessage = null)
{
    public static Result Success() => new(true);
    public static Result Failure(string error) => new(false, error);
}
```

**PagedResult<T>** — Pagination helper

```csharp
public record PagedResult<T>(
    IEnumerable<T> Items,
    int PageNumber,
    int PageSize,
    int TotalCount
)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);
    public bool HasNextPage => PageNumber < TotalPages;
    public bool HasPreviousPage => PageNumber > 1;
}
```

**Guard Clauses** — Common validation

```csharp
public static class Guard
{
    public static void NotNull<T>(T value, string paramName) where T : class
    {
        if (value == null)
            throw new ArgumentNullException(paramName);
    }

    public static void NotEmpty(string value, string paramName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException($"{paramName} cannot be empty", paramName);
    }

    public static void Between(int value, int min, int max, string paramName)
    {
        if (value < min || value > max)
            throw new ArgumentOutOfRangeException(paramName, $"Must be between {min} and {max}");
    }
}
```

**Logging & Telemetry Helpers**

```csharp
public static class LoggingExtensions
{
    public static IServiceCollection AddRecyclerIQLogging(this IServiceCollection services)
    {
        // Structured logging with Serilog (setup deferred to Application layer)
        return services;
    }
}
```

#### 3.2 Extensions

**String Extensions**

```csharp
public static class StringExtensions
{
    public static string Truncate(this string value, int maxLength) =>
        value?.Length > maxLength ? value[..maxLength] + "..." : value;

    public static bool IsValidEmail(this string email) =>
        !string.IsNullOrEmpty(email) && email.Contains("@") && email.Length > 5;

    public static string ToTitleCase(this string value) =>
        System.Globalization.CultureInfo.CurrentCulture.TextInfo.ToTitleCase(value?.ToLower() ?? "");
}
```

**Enumerable Extensions**

```csharp
public static class EnumerableExtensions
{
    public static IEnumerable<T> WhereNotNull<T>(this IEnumerable<T?> source) where T : class =>
        source.Where(x => x != null)!;

    public static decimal Sum(this IEnumerable<Money> items) =>
        items.Aggregate(0m, (acc, m) => acc + m.Amount);

    public static PagedResult<T> ToPagedResult<T>(
        this IEnumerable<T> source, int pageNumber, int pageSize)
    {
        var items = source.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToList();
        var total = source.Count();
        return new PagedResult<T>(items, pageNumber, pageSize, total);
    }
}
```

**DateTime Extensions**

```csharp
public static class DateTimeExtensions
{
    public static bool IsToday(this DateTime dt) =>
        dt.Date == DateTime.UtcNow.Date;

    public static bool IsInRange(this DateTime dt, TimeRange range) =>
        range.Contains(dt);

    public static DateTime StartOfDay(this DateTime dt) =>
        dt.Date;

    public static DateTime EndOfDay(this DateTime dt) =>
        dt.Date.AddDays(1).AddTicks(-1);

    public static bool IsBusinessHours(this DateTime dt) =>
        dt.Hour >= 9 && dt.Hour < 17 && dt.DayOfWeek != DayOfWeek.Saturday && dt.DayOfWeek != DayOfWeek.Sunday;
}
```

#### 3.3 Constants

```csharp
public static class AppConstants
{
    // Timing
    public const int SyncIntervalSeconds = 300; // 5 minutes
    public const int DeviceTimeoutSeconds = 120;
    public const int MaxRetryAttempts = 3;

    // Limits
    public const decimal MaxTransactionAmount = 100000m;
    public const int MaxUsersPerTenant = 1000;
    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 500;

    // Thresholds
    public const decimal LowInventoryThresholdUsd = 500m;
    public const int DeviceOfflineDurationMinutes = 30;

    // Validation
    public const int MinPasswordLength = 12;
    public const int MaxNameLength = 100;
    public const int MaxEmailLength = 254;
    public const int SerialNumberLength = 16;

    // Feature Flags
    public const bool EnableCITIntegration = true;
    public const bool EnableAdvancedReporting = false; // Future
}

public static class ErrorMessages
{
    public const string TenantNotFound = "Tenant not found.";
    public const string DeviceOffline = "Device is offline.";
    public const string InsufficientInventory = "Insufficient cash inventory.";
    public const string LicenseExpired = "License has expired.";
    public const string UnauthorizedAccess = "You do not have permission to perform this action.";
    public const string InvalidTransaction = "Transaction contains invalid data.";
    public const string DuplicateSerialNumber = "Device with this serial number already exists.";
}
```

#### 3.4 Shared DTOs

DTOs bridge the gap between API contracts and domain models. **Important:** All DTOs should be read-only (`record` types).

**Request DTOs (API Input)**

```csharp
public record CreateTransactionRequest(
    Guid DeviceId,
    TransactionType Type,
    decimal Amount,
    Dictionary<Guid, int> DenominationCounts,
    string? Notes = null
);

public record RegisterDeviceRequest(
    Guid StoreId,
    string SerialNumber,
    string Model,
    string ManufacturerCode,
    string FirmwareVersion
);

public record LoginRequest(
    string Email,
    string Password
);

public record UpdateDeviceStatusRequest(
    Guid DeviceId,
    DeviceStatus NewStatus
);
```

**Response DTOs (API Output)**

```csharp
public record TransactionResponse(
    Guid Id,
    Guid DeviceId,
    TransactionType Type,
    decimal Amount,
    DateTime CreatedUtc,
    TransactionStatus Status
);

public record DeviceResponse(
    Guid Id,
    Guid StoreId,
    string SerialNumber,
    string Model,
    DeviceStatus Status,
    string FirmwareVersion,
    DateTime LastSyncUtc
);

public record TenantResponse(
    Guid Id,
    string Name,
    TenantType Type,
    DateTime CreatedUtc,
    bool IsActive
);

public record InventoryResponse(
    Guid DeviceId,
    Dictionary<string, int> Denominations,
    decimal TotalValue,
    DateTime SnapshotUtc
);
```

⚠ **Open Item:** No unified DTO contract schema has been defined. Consider creating `RecyclerIQ.Common.Contracts.dll` as a separate artifact for API versioning.

#### 3.5 Sync Message Contracts

Used for device synchronization and cross-service communication (see Section 6).

```csharp
public record SyncRequest(
    Guid DeviceId,
    Guid SyncId,
    DateTime RequestedUtc,
    int MaxTransactionsToSync = 500
);

public record SyncResponse(
    Guid SyncId,
    bool Success,
    List<TransactionResponse> NewTransactions,
    List<AlertResponse> ActiveAlerts,
    string? ErrorMessage = null
);

public record DeviceStateSnapshot(
    Guid DeviceId,
    Dictionary<string, int> DenominationCounts,
    decimal TotalValue,
    DateTime CapturedUtc,
    string HardwareStatus
);
```

### Structure
<!-- Jira: RCORE-96 | Epic: RCORE-94 | Synced: 2026-04-11 -->

```
RecyclerIQ.Common/
├── Results/
│   ├── Result.cs
│   ├── Result{T}.cs
│   └── PagedResult{T}.cs
├── Utilities/
│   ├── Guard.cs
│   ├── LoggingExtensions.cs
│   └── ClockProvider.cs (time abstraction for testing)
├── Extensions/
│   ├── StringExtensions.cs
│   ├── EnumerableExtensions.cs
│   ├── DateTimeExtensions.cs
│   ├── DecimalExtensions.cs
│   └── DictionaryExtensions.cs
├── Constants/
│   ├── AppConstants.cs
│   └── ErrorMessages.cs
├── Dtos/
│   ├── Requests/
│   │   ├── CreateTransactionRequest.cs
│   │   ├── RegisterDeviceRequest.cs
│   │   ├── LoginRequest.cs
│   │   └── UpdateDeviceStatusRequest.cs
│   ├── Responses/
│   │   ├── TransactionResponse.cs
│   │   ├── DeviceResponse.cs
│   │   ├── TenantResponse.cs
│   │   ├── InventoryResponse.cs
│   │   └── AlertResponse.cs
│   └── Shared/
│       ├── ErrorResponse.cs
│       └── PaginationMetadata.cs
├── Contracts/
│   ├── Sync/
│   │   ├── SyncRequest.cs
│   │   ├── SyncResponse.cs
│   │   └── DeviceStateSnapshot.cs
│   └── ServiceBus/ (see Section 6)
│       ├── TransactionCompletedMessage.cs
│       ├── DeviceOfflineMessage.cs
│       └── InventoryLowMessage.cs
└── Helpers/
    └── DateRangeHelper.cs
```

---

## 4. UI.Shared Project (`RecyclerIQ.UI.Shared`)
<!-- Jira: RCLIENT-53,RCLIENT-54,RCLIENT-55,RCLIENT-56,RCLIENT-57,RCLIENT-58,RCLIENT-59,RCLIENT-60,RCLIENT-61,RCLIENT-62 | Epic: RCLIENT-9 | Synced: 2026-04-11 | Note: Individual component stories in RCLIENT -->

### Purpose

Razor Class Library (RCL) containing reusable components, layouts, and theming consumed by both MAUI Blazor Hybrid app and future Web Portal. Centralized brand identity and common UI patterns.

### Component Inventory

#### 4.1 Device Status & Monitoring

**RecyclerStatusIndicator**
- **Purpose:** Display device online/offline/maintenance state with visual indicator
- **Props:** `DeviceStatus Status`, `DateTime LastSyncUtc`, `bool ShowDetails`
- **Events:** `OnStatusClick`, `OnSyncRequest`
- **Styling:** Brand color (#3D60A7 for online, red for offline, yellow for maintenance)

**HardwareConnectivityIndicator**
- **Purpose:** Mini widget showing real-time hardware connectivity
- **Props:** `Guid DeviceId`, `RefreshIntervalMs`, `bool IsConnected`
- **Events:** `OnConnectivityChanged`, `OnError`
- **Styling:** Animated pulsing icon

**SyncStatusDisplay**
- **Purpose:** Progress indicator for device synchronization
- **Props:** `Guid SyncId`, `int ProgressPercent`, `string CurrentStep`
- **Events:** `OnSyncComplete`, `OnSyncFailed`
- **Styling:** Linear progress bar with status text

#### 4.2 Cash Inventory & Denomination

**DenominationBreakdownDisplay**
- **Purpose:** Show cash counts by denomination (e.g., "15×$20, 8×$5, 3×$1")
- **Props:** `Dictionary<CashDenomination, int> QuantitiesByDenomination`, `decimal TotalValue`
- **Events:** None (read-only display)
- **Styling:** Grid or card layout with brand colors

**CashInventoryGrid**
- **Purpose:** Tabular view of all devices and their inventory
- **Props:** `List<InventoryResponse> Inventories`, `bool AllowSort`, `bool ShowTrends`
- **Events:** `OnInventoryClick`, `OnExportRequested`
- **Features:** Sorting by denomination, trend indicators (↑ up, ↓ down, → stable)

**LowInventoryAlert**
- **Purpose:** Prominent alert for inventory below threshold
- **Props:** `Guid DeviceId`, `string DenominationName`, `int CurrentCount`, `int ThresholdCount`
- **Events:** `OnDismiss`, `OnScheduleCIT`
- **Styling:** Red alert box, dismissible

#### 4.3 Transaction Management

**TransactionAuditRow**
- **Purpose:** Single row in transaction history table
- **Props:** `TransactionResponse Transaction`, `User PerformedBy`, `bool ShowDetails`
- **Events:** `OnViewDetails`, `OnReverse`
- **Styling:** Monospace timestamp, right-aligned amount

**TransactionHistoryTable**
- **Purpose:** Full transaction history with filtering and pagination
- **Props:** `List<TransactionResponse> Transactions`, `int PageSize`, `TransactionType? FilterByType`
- **Events:** `OnPageChanged`, `OnFilterChanged`, `OnExportCsv`
- **Features:** Date range filter, type filter, CSV export

**ReceiptPrinterIntegration**
- **Purpose:** Component for printing transaction receipts
- **Props:** `TransactionResponse Transaction`, `Store StoreDetails`, `bool AutoPrint`
- **Events:** `OnPrintStarted`, `OnPrintComplete`, `OnPrintError`
- **Backend Call:** Calls hardware print API

#### 4.4 Login & Authentication

**PinLoginKeypad**
- **Purpose:** Custom numeric PIN entry (for operator access)
- **Props:** `int PinLength = 6`, `bool MaskInput`, `string? Prompt`
- **Events:** `OnPinEntered`, `OnCancel`, `OnError`
- **Styling:** Large touch-friendly buttons, masked display

**PasswordLoginForm**
- **Purpose:** Email + password login with MFA support
- **Props:** `bool ShowForgotPassword`, `bool ShowMfa`
- **Events:** `OnLoginAttempt`, `OnMfaRequired`
- **Validation:** Client-side + server-side password strength

#### 4.5 Common Layouts & Navigation

**MainLayout**
- **Purpose:** Shell container for app (header, sidebar, footer)
- **Slots:** Header branding, sidebar navigation, main content, footer
- **Props:** `User CurrentUser`, `bool ShowSidebar`

**SidebarNavigation**
- **Purpose:** Left navigation menu (context-aware for Retail vs. Tax Authority)
- **Items:**
  - Dashboard
  - Devices (with online count badge)
  - Transactions
  - Inventory
  - Reports
  - Settings
  - Logout

**BreadcrumbNavigation**
- **Purpose:** Hierarchical path display (e.g., "Dashboard > Stores > Store ABC > Devices")
- **Props:** `List<BreadcrumbItem> Items`
- **Events:** `OnItemClick`

**LoadingSpinner**
- **Purpose:** Reusable loading indicator
- **Props:** `bool IsLoading`, `string? Message`
- **Styling:** Animated brand-colored spinner

**ErrorBoundary**
- **Purpose:** Catch and display unhandled exceptions gracefully
- **Props:** `string? FallbackMessage`
- **Events:** `OnError`

**ConfirmationModal**
- **Purpose:** Reusable yes/no dialog
- **Props:** `string Title`, `string Message`, `string ConfirmText = "Confirm"`
- **Events:** `OnConfirmed`, `OnCancelled`

#### 4.6 Reporting & Analytics

**TransactionSummaryCard**
- **Purpose:** Display transaction metrics (count, total value, type breakdown)
- **Props:** `List<TransactionResponse> Transactions`, `DateRange Period`
- **Styling:** Card with accent border (brand color)

**InventoryTrendChart**
- **Purpose:** Line chart showing inventory over time
- **Props:** `List<DeviceStateSnapshot> Snapshots`, `string? DenominationFilter`
- **Events:** `OnDateRangeSelected`
- **Library:** Chart.js or similar

**AlertDashboard**
- **Purpose:** Centralized view of all active alerts
- **Props:** `List<AlertResponse> Alerts`, `AlertSeverity? FilterBySeverity`
- **Events:** `OnAlertDismissed`, `OnAlertViewed`

### Consumption Pattern

All components accept:
1. **Input properties** (immutable data binding)
2. **Cascading parameters** for tenant/user context (if needed)
3. **Event callbacks** for interactions

Example usage in MAUI Blazor Hybrid:

```razor
@page "/devices/{DeviceId}"
@inject IDeviceService DeviceService

<SidebarNavigation @ref="_navbar" OnItemClick="HandleNavigation" />

<div class="content">
    <BreadcrumbNavigation Items="@_breadcrumbs" OnItemClick="HandleBreadcrumb" />

    @if (_device == null)
    {
        <LoadingSpinner IsLoading="true" Message="Loading device..." />
    }
    else
    {
        <RecyclerStatusIndicator
            Status="@_device.Status"
            LastSyncUtc="@_device.LastSyncUtc"
            ShowDetails="true"
            OnStatusClick="HandleStatusClick"
            OnSyncRequest="HandleSyncRequest" />

        <DenominationBreakdownDisplay
            QuantitiesByDenomination="@_inventory"
            TotalValue="@_totalValue" />

        <CashInventoryGrid
            Inventories="@_allInventories"
            AllowSort="true"
            ShowTrends="true"
            OnInventoryClick="HandleInventoryClick" />
    }
</div>

@code {
    [Parameter] public string? DeviceId { get; set; }
    private Device? _device;
    private Dictionary<CashDenomination, int> _inventory = new();

    protected override async Task OnInitializedAsync()
    {
        if (Guid.TryParse(DeviceId, out var id))
        {
            var result = await DeviceService.GetDeviceAsync(id);
            if (result.IsSuccess)
                _device = result.Data;
        }
    }
}
```

### Brand Theming Integration

All components respect the Recycler.IQ brand palette via CSS variables:

```css
:root {
    --color-navy: #0F084B;
    --color-dark-blue: #26408B;
    --color-brand-primary: #3D60A7;
    --color-light-blue: #81B1D5;
    --color-pale-blue: #A0D2E7;
    --color-success: #28a745;
    --color-warning: #ffc107;
    --color-danger: #dc3545;
    --color-neutral: #6c757d;
}

.btn-primary {
    background-color: var(--color-brand-primary);
    color: white;
}

.status-online {
    color: var(--color-success);
}

.status-offline {
    color: var(--color-danger);
}
```

Components use semantic CSS class names (`btn-primary`, `alert-warning`, etc.) so theming is centralized.

### Structure

```
RecyclerIQ.UI.Shared/
├── Components/
│   ├── Device/
│   │   ├── RecyclerStatusIndicator.razor
│   │   ├── HardwareConnectivityIndicator.razor
│   │   └── SyncStatusDisplay.razor
│   ├── Inventory/
│   │   ├── DenominationBreakdownDisplay.razor
│   │   ├── CashInventoryGrid.razor
│   │   └── LowInventoryAlert.razor
│   ├── Transactions/
│   │   ├── TransactionAuditRow.razor
│   │   ├── TransactionHistoryTable.razor
│   │   └── ReceiptPrinterIntegration.razor
│   ├── Auth/
│   │   ├── PinLoginKeypad.razor
│   │   └── PasswordLoginForm.razor
│   ├── Layout/
│   │   ├── MainLayout.razor
│   │   ├── SidebarNavigation.razor
│   │   ├── BreadcrumbNavigation.razor
│   │   ├── LoadingSpinner.razor
│   │   ├── ErrorBoundary.razor
│   │   └── ConfirmationModal.razor
│   └── Reporting/
│       ├── TransactionSummaryCard.razor
│       ├── InventoryTrendChart.razor
│       └── AlertDashboard.razor
├── Layouts/
│   ├── MainLayout.razor
│   └── _Host.cshtml
├── Styles/
│   ├── _variables.css (brand colors & theme)
│   ├── _components.css (component styling)
│   ├── _responsive.css
│   └── app.css (main stylesheet)
├── Shared/
│   ├── _imports.razor (component imports)
│   └── NavMenu.razor (fallback navigation)
├── wwwroot/
│   ├── css/
│   ├── js/
│   │   ├── print-service.js (receipt printer)
│   │   └── hardware-connect.js (device communication)
│   └── lib/ (Chart.js, etc.)
├── Models/
│   ├── BreadcrumbItem.cs
│   └── ComponentState.cs
└── wwwroot/
    └── manifest.json (PWA metadata)
```

---

## 5. Hardware Project (`RecyclerIQ.Hardware`)
<!-- Jira: RLINK-17,RLINK-19,RLINK-20,RLINK-21,RLINK-22 | Epic: RLINK-2 | Note: Hardware project lives in recycleriq-link repo | Synced: 2026-04-11 -->

### Purpose

Abstraction layer for cash recycler hardware. Defines the `IRecycler` interface, implements manufacturer-specific drivers, and provides a factory for selecting the correct implementation at runtime.

### Core Interface

```csharp
/// <summary>
/// Abstraction for physical cash recycler device operations.
/// Implementations are manufacturer-specific (Kisan, GRG, etc.).
/// </summary>
public interface IRecycler
{
    /// <summary>
    /// Establish connection to the physical device.
    /// Returns true if connection succeeds, false if device is unavailable.
    /// </summary>
    Task<bool> ConnectAsync(CancellationToken ct);

    /// <summary>
    /// Gracefully close the device connection.
    /// </summary>
    Task<bool> DisconnectAsync(CancellationToken ct);

    /// <summary>
    /// Retrieve current inventory state from device memory.
    /// Includes denomination counts and device health metrics.
    /// </summary>
    Task<HardwareInventory> GetInventoryAsync(CancellationToken ct);

    /// <summary>
    /// Signal start of a deposit operation (authorize hopper for intake).
    /// Must be called before accepting cash.
    /// </summary>
    Task<bool> StartDepositAsync(CancellationToken ct);

    /// <summary>
    /// Signal end of a deposit operation (close hopper, finalize transaction).
    /// </summary>
    Task<bool> EndDepositAsync(CancellationToken ct);

    /// <summary>
    /// Dispense cash from device inventory.
    /// Validates breakdown matches device state before attempting.
    /// </summary>
    Task<bool> WithdrawAsync(Money amount, CashBreakdown breakdown, CancellationToken ct);

    /// <summary>
    /// Insert a single bill of the specified denomination.
    /// Used for single-item testing and calibration.
    /// </summary>
    Task<bool> InsertBillAsync(CashDenomination denomination, CancellationToken ct);
}

/// <summary>
/// Result of GetInventoryAsync.
/// </summary>
public record HardwareInventory(
    Dictionary<CashDenomination, int> DenominationCounts,
    bool IsHealthy,
    string FirmwareVersion,
    DateTime LastSyncUtc,
    string? DiagnosticMessage = null
);
```

### Implementations

#### 5.1 SimulatorRecycler (Complete)
<!-- Jira: RCORE-106 | Epic: RCORE-95 | Synced: 2026-04-11 -->

Full in-memory mock for testing without hardware.

```csharp
public class SimulatorRecycler : IRecycler
{
    private Dictionary<CashDenomination, int> _inventory;
    private bool _isConnected;
    private Random _random;

    public SimulatorRecycler()
    {
        // Initialize with default inventory
        _inventory = new()
        {
            { CashDenomination.Dollar1, 100 },
            { CashDenomination.Dollar5, 80 },
            { CashDenomination.Dollar10, 60 },
            { CashDenomination.Dollar20, 50 },
            { CashDenomination.Dollar50, 30 },
            { CashDenomination.Dollar100, 20 }
        };
        _isConnected = false;
        _random = new Random();
    }

    public Task<bool> ConnectAsync(CancellationToken ct)
    {
        _isConnected = true;
        return Task.FromResult(true);
    }

    public Task<bool> DisconnectAsync(CancellationToken ct)
    {
        _isConnected = false;
        return Task.FromResult(true);
    }

    public Task<HardwareInventory> GetInventoryAsync(CancellationToken ct)
    {
        var inventory = new HardwareInventory(
            DenominationCounts: new Dictionary<CashDenomination, int>(_inventory),
            IsHealthy: _random.Next(0, 100) > 5, // 95% healthy
            FirmwareVersion: "2.1.0",
            LastSyncUtc: DateTime.UtcNow,
            DiagnosticMessage: null
        );
        return Task.FromResult(inventory);
    }

    public Task<bool> StartDepositAsync(CancellationToken ct)
    {
        if (!_isConnected) return Task.FromResult(false);
        return Task.FromResult(true);
    }

    public Task<bool> EndDepositAsync(CancellationToken ct)
    {
        if (!_isConnected) return Task.FromResult(false);
        return Task.FromResult(true);
    }

    public Task<bool> WithdrawAsync(Money amount, CashBreakdown breakdown, CancellationToken ct)
    {
        if (!_isConnected) return Task.FromResult(false);

        // Simulate withdrawal by decrementing inventory
        foreach (var kvp in breakdown.QuantitiesByDenomination)
        {
            if (_inventory.ContainsKey(kvp.Key))
                _inventory[kvp.Key] -= kvp.Value;
        }

        return Task.FromResult(true);
    }

    public Task<bool> InsertBillAsync(CashDenomination denomination, CancellationToken ct)
    {
        if (!_isConnected) return Task.FromResult(false);

        if (_inventory.ContainsKey(denomination))
            _inventory[denomination]++;

        return Task.FromResult(true);
    }
}
```

#### 5.2 KisanRecycler (Partial)
<!-- Jira: RLINK-21 | Epic: RLINK-2 | Synced: 2026-04-11 | Note: Covered by RLINK HAL epic -->

Driver for Kisan CRS-2 (partial implementation, extends in Infrastructure).

```csharp
public class KisanRecycler : IRecycler
{
    private readonly SerialPort _port;
    private readonly string _deviceId;

    public KisanRecycler(string portName, string deviceId)
    {
        _port = new SerialPort(portName, 9600, Parity.None, 8, StopBits.One);
        _deviceId = deviceId;
    }

    public async Task<bool> ConnectAsync(CancellationToken ct)
    {
        try
        {
            if (!_port.IsOpen)
                _port.Open();

            // Send handshake command
            var handshake = await SendCommandAsync("HANDSHAKE", ct);
            return handshake.StartsWith("OK");
        }
        catch
        {
            return false;
        }
    }

    public Task<bool> DisconnectAsync(CancellationToken ct)
    {
        try
        {
            _port?.Close();
            return Task.FromResult(true);
        }
        catch
        {
            return Task.FromResult(false);
        }
    }

    public async Task<HardwareInventory> GetInventoryAsync(CancellationToken ct)
    {
        try
        {
            var response = await SendCommandAsync("GET_INVENTORY", ct);
            var counts = ParseInventoryResponse(response);

            return new HardwareInventory(
                DenominationCounts: counts,
                IsHealthy: true,
                FirmwareVersion: "1.5.2",
                LastSyncUtc: DateTime.UtcNow
            );
        }
        catch (Exception ex)
        {
            return new HardwareInventory(
                DenominationCounts: new(),
                IsHealthy: false,
                FirmwareVersion: "Unknown",
                LastSyncUtc: DateTime.UtcNow,
                DiagnosticMessage: ex.Message
            );
        }
    }

    // Additional methods stubbed for future implementation
    public Task<bool> StartDepositAsync(CancellationToken ct) =>
        throw new NotImplementedException("KisanRecycler deposit not implemented");

    public Task<bool> EndDepositAsync(CancellationToken ct) =>
        throw new NotImplementedException("KisanRecycler end deposit not implemented");

    public Task<bool> WithdrawAsync(Money amount, CashBreakdown breakdown, CancellationToken ct) =>
        throw new NotImplementedException("KisanRecycler withdrawal not implemented");

    public Task<bool> InsertBillAsync(CashDenomination denomination, CancellationToken ct) =>
        throw new NotImplementedException("KisanRecycler single bill insert not implemented");

    // Private helper
    private async Task<string> SendCommandAsync(string command, CancellationToken ct)
    {
        // Serial communication implementation
        throw new NotImplementedException();
    }

    private Dictionary<CashDenomination, int> ParseInventoryResponse(string response)
    {
        // Parse Kisan-specific response format
        throw new NotImplementedException();
    }
}
```

### RecyclerFactory
<!-- Jira: RLINK-22 | Epic: RLINK-2 | Synced: 2026-04-11 | Note: Covered by RLINK HAL epic -->

Factory pattern for selecting the correct implementation based on device model.

```csharp
public interface IRecyclerFactory
{
    IRecycler CreateRecycler(string model, string serialNumber, string portName);
}

public class RecyclerFactory : IRecyclerFactory
{
    private readonly ILogger<RecyclerFactory> _logger;

    public RecyclerFactory(ILogger<RecyclerFactory> logger)
    {
        _logger = logger;
    }

    public IRecycler CreateRecycler(string model, string serialNumber, string portName)
    {
        _logger.LogInformation("Creating recycler instance for model {Model}, SN {SerialNumber}", model, serialNumber);

        return model.ToUpperInvariant() switch
        {
            "KISAN_CRS2" => new KisanRecycler(portName, serialNumber),
            "GRG_CDM" => throw new NotImplementedException("GRG driver not yet implemented"),
            "SIMULATOR" => new SimulatorRecycler(),
            _ => throw new ArgumentException($"Unknown recycler model: {model}")
        };
    }
}
```

### Dependency Injection Setup
<!-- Jira: RLINK-12 | Epic: RLINK-1 | Synced: 2026-04-11 | Note: Covered by Link.Service Core epic -->

```csharp
public static class HardwareServiceCollectionExtensions
{
    public static IServiceCollection AddHardwareServices(
        this IServiceCollection services,
        IConfiguration config)
    {
        services.AddSingleton<IRecyclerFactory, RecyclerFactory>();
        services.AddScoped<IRecyclerRegistry, RecyclerRegistry>();

        return services;
    }
}

public interface IRecyclerRegistry
{
    void RegisterRecycler(Guid deviceId, IRecycler recycler);
    IRecycler? GetRecycler(Guid deviceId);
    void UnregisterRecycler(Guid deviceId);
}

public class RecyclerRegistry : IRecyclerRegistry
{
    private readonly ConcurrentDictionary<Guid, IRecycler> _recyclers = new();

    public void RegisterRecycler(Guid deviceId, IRecycler recycler) =>
        _recyclers[deviceId] = recycler ?? throw new ArgumentNullException(nameof(recycler));

    public IRecycler? GetRecycler(Guid deviceId) =>
        _recyclers.TryGetValue(deviceId, out var recycler) ? recycler : null;

    public void UnregisterRecycler(Guid deviceId) =>
        _recyclers.TryRemove(deviceId, out _);
}
```

### Testing with SimulatorRecycler
<!-- Jira: N/A | Note: Design documentation — no story needed -->

All integration tests use SimulatorRecycler by default:

```csharp
[TestFixture]
public class DeviceSyncServiceTests
{
    private IRecycler _recycler;
    private IDeviceService _deviceService;

    [SetUp]
    public void Setup()
    {
        _recycler = new SimulatorRecycler();
        _deviceService = new DeviceService(_recycler, /* other deps */);
    }

    [Test]
    public async Task SyncDevice_UpdatesInventory()
    {
        // Arrange
        await _recycler.ConnectAsync(CancellationToken.None);
        var initialInventory = await _recycler.GetInventoryAsync(CancellationToken.None);

        // Act
        var result = await _deviceService.SyncAsync(Guid.NewGuid(), CancellationToken.None);

        // Assert
        Assert.That(result.IsSuccess, Is.True);
    }
}
```

### Structure
<!-- Jira: RCORE-110 | Epic: RCORE-95 | Synced: 2026-04-11 -->

```
RecyclerIQ.Hardware/
├── Interfaces/
│   ├── IRecycler.cs
│   ├── IRecyclerFactory.cs
│   └── IRecyclerRegistry.cs
├── Models/
│   └── HardwareInventory.cs
├── Implementations/
│   ├── SimulatorRecycler.cs (complete, full mock)
│   ├── KisanRecycler.cs (partial, serial port framework)
│   └── GrgRecycler.cs (stub for future)
├── Factory/
│   └── RecyclerFactory.cs
├── Registry/
│   └── RecyclerRegistry.cs
└── Extensions/
    └── HardwareServiceCollectionExtensions.cs
```

---

## 6. Protos Project (`RecyclerIQ.Protos`)
<!-- Jira: RLINK-31 (moving to RCORE) | Epic: RLINK-4 | Synced: 2026-04-12 | Note: gRPC contract definitions shared by link + clients -->

### Purpose

The Protos project holds all `.proto` service definitions for gRPC communication between UI clients (MAUI Blazor Hybrid, WebClient) and Link.Service over LAN. It generates C# client and server stubs via `Grpc.Tools`, published as a NuGet package consumed by both `recycleriq-link` (server stubs) and `recycleriq-clients` (client stubs).

**Why in recycleriq-core (not recycleriq-link)?** Two repos need the generated stubs — link and clients. The same logic that puts `ILinkClient` in Domain applies here: the protos define the cross-repo communication contract. See [Repository Structure ADR §2](../03%20-%20Architecture%20Decisions/Platform/repository-structure-decisions.md) for rationale.

### Project Structure

```
recycleriq-core/
└── src/
    └── RecyclerIQ.Protos/
        ├── RecyclerIQ.Protos.csproj
        └── Protos/
            ├── common.proto              # Shared message types
            ├── recycler_service.proto    # Recycler command RPCs
            ├── status_service.proto      # Health and sync RPCs
            └── recycler_events.proto     # Server-streaming hardware events
```

```xml
<!-- RecyclerIQ.Protos.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <Protobuf Include="Protos\*.proto" GrpcServices="Both" />
  </ItemGroup>
  <ItemGroup>
    <PackageReference Include="Grpc.Tools" PrivateAssets="All" />
    <PackageReference Include="Google.Protobuf" />
    <PackageReference Include="Grpc.Net.Client" />
  </ItemGroup>
</Project>
```

### 6.1 Conventions

All `.proto` files use:
- `syntax = "proto3";`
- `package recycleriq.link.v1;`
- `option csharp_namespace = "RecyclerIQ.Link.Protos.V1";`
- `google.protobuf.Timestamp` for time fields

### 6.2 common.proto — Shared Message Types

Shared messages referenced by all service definitions:

```protobuf
syntax = "proto3";
package recycleriq.link.v1;
option csharp_namespace = "RecyclerIQ.Link.Protos.V1";

import "google/protobuf/timestamp.proto";

enum RecyclerState {
    RECYCLER_STATE_UNSPECIFIED = 0;
    IDLE = 1;
    BUSY = 2;
    OFFLINE = 3;
    ERROR = 4;
}

enum LicenseStatus {
    LICENSE_STATUS_UNSPECIFIED = 0;
    VALID = 1;
    GRACE_PERIOD = 2;
    EXPIRED = 3;
    UNKNOWN = 4;
}

message RecyclerStatus {
    string id = 1;
    string name = 2;
    string manufacturer = 3;
    string model = 4;
    RecyclerState state = 5;
    google.protobuf.Timestamp last_heartbeat = 6;
}

message DenominationCount {
    int32 denomination = 1;
    int32 count = 2;
    int64 subtotal_cents = 3;
}

message InventorySnapshot {
    repeated DenominationCount denomination_counts = 1;
    int64 total_value_cents = 2;
    google.protobuf.Timestamp timestamp = 3;
    string checksum = 4;
}

message ErrorDetail {
    string code = 1;
    string message = 2;
    string recycler_id = 3;
}

message SyncStatus {
    google.protobuf.Timestamp last_sync_time = 1;
    int32 pending_transaction_count = 2;
    int32 pending_inventory_updates = 3;
    bool is_syncing = 4;
}
```

### 6.3 recycler_service.proto — Recycler Command RPCs

Unary RPCs for recycler operations (deposit, withdraw, inventory):

```protobuf
syntax = "proto3";
package recycleriq.link.v1;
option csharp_namespace = "RecyclerIQ.Link.Protos.V1";

import "common.proto";

service RecyclerService {
    rpc ListRecyclers(ListRecyclersRequest) returns (ListRecyclersResponse);
    rpc StartDeposit(StartDepositRequest) returns (StartDepositResponse);
    rpc EndDeposit(EndDepositRequest) returns (EndDepositResponse);
    rpc Withdraw(WithdrawRequest) returns (WithdrawResponse);
    rpc GetInventory(GetInventoryRequest) returns (GetInventoryResponse);
}

message ListRecyclersRequest {}
message ListRecyclersResponse {
    repeated RecyclerStatus recyclers = 1;
}

message StartDepositRequest {
    string recycler_id = 1;
    repeated int32 expected_denominations = 2;
}
message StartDepositResponse {
    string session_id = 1;
    int32 estimated_duration_seconds = 2;
}

message EndDepositRequest {
    string deposit_id = 1;
}
message EndDepositResponse {
    bool success = 1;
    InventorySnapshot final_inventory = 2;
    repeated ErrorDetail errors = 3;
}

message WithdrawRequest {
    string recycler_id = 1;
    int32 denomination = 2;
    int64 amount_cents = 3;
}
message WithdrawResponse {
    bool success = 1;
    int64 dispensed_value_cents = 2;
    repeated ErrorDetail errors = 3;
}

message GetInventoryRequest {
    string recycler_id = 1;
}
message GetInventoryResponse {
    repeated DenominationCount denomination_counts = 1;
    int64 total_value_cents = 2;
    google.protobuf.Timestamp timestamp = 3;
}
```

### 6.4 status_service.proto — Health and Sync RPCs

```protobuf
syntax = "proto3";
package recycleriq.link.v1;
option csharp_namespace = "RecyclerIQ.Link.Protos.V1";

import "common.proto";
import "google/protobuf/duration.proto";

service StatusService {
    rpc GetStatus(GetStatusRequest) returns (GetStatusResponse);
    rpc TriggerSync(TriggerSyncRequest) returns (TriggerSyncResponse);
}

message GetStatusRequest {}
message GetStatusResponse {
    string service_state = 1;
    LicenseStatus license_status = 2;
    SyncStatus sync_status = 3;
    repeated RecyclerStatus recyclers = 4;
}

message TriggerSyncRequest {
    string source = 1;
}
message TriggerSyncResponse {
    bool triggered = 1;
    google.protobuf.Duration next_sync_in = 2;
}
```

### 6.5 recycler_events.proto — Server-Streaming Hardware Events

Server-streaming RPC that pushes real-time hardware events to connected UI clients:

```protobuf
syntax = "proto3";
package recycleriq.link.v1;
option csharp_namespace = "RecyclerIQ.Link.Protos.V1";

import "common.proto";
import "google/protobuf/timestamp.proto";

service RecyclerEventStream {
    rpc SubscribeToEvents(SubscribeRequest) returns (stream RecyclerEvent);
}

message SubscribeRequest {
    string recycler_id = 1;          // empty = all recyclers
    repeated string event_types = 2;  // filter which event types to receive
}

message RecyclerEvent {
    google.protobuf.Timestamp timestamp = 1;
    string recycler_id = 2;

    oneof event {
        BillInsertedEvent bill_inserted = 10;
        CollectionProgressEvent collection_progress = 11;
        RecyclerStatusChangedEvent status_changed = 12;
        QueuePositionUpdateEvent queue_position = 13;
    }
}

message BillInsertedEvent {
    int32 denomination = 1;
}

message CollectionProgressEvent {
    int32 current_count = 1;
    int32 expected_count = 2;
}

message RecyclerStatusChangedEvent {
    RecyclerState old_status = 1;
    RecyclerState new_status = 2;
}

message QueuePositionUpdateEvent {
    string client_id = 1;
    int32 position = 2;
    int32 estimated_wait_seconds = 3;
}
```

### 6.6 Consumers

| Repo | Project | Consumes | Stubs Used |
|---|---|---|---|
| recycleriq-link | RecyclerIQ.Link.Service | NuGet: RecyclerIQ.Protos | **Server** stubs — hosts gRPC server |
| recycleriq-clients | RecyclerIQ.UI.TaxAuthority, UI.RetailClient, UI.WebClient | NuGet: RecyclerIQ.Protos | **Client** stubs — calls gRPC server |
| recycleriq-simulator | RecyclerIQ.Simulator | Does NOT consume protos | Simulator uses REST API, not gRPC |

---

## 7. Cross-Cutting Contracts
<!-- Jira: RCLOUD-82 | Epic: N/A | Synced: 2026-04-11 | Note: Cloud infrastructure — deferred to RCLOUD build phase -->

### Purpose

Define shared message schemas and API contracts used across services, devices, and the Service Bus.

### 6.1 Data Transfer Objects (DTOs)

See Section 3.4 above.

### 6.2 Service Bus Message Schemas

Azure Service Bus messages are published by Application layer and subscribed by Infrastructure/UI. All messages inherit from `DomainEventMessage` base.

⚠ **Open Item:** Detailed message schema (.proto files or JSON Schema) has not been defined. Recommend storing in `RecyclerIQ.Contracts.ServiceBus`.

```csharp
// Base message class
public abstract record DomainEventMessage
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime OccurredUtc { get; init; } = DateTime.UtcNow;
    public Guid TenantId { get; init; }
    public string? CorrelationId { get; init; }
}

// Transaction completion notification
public record TransactionCompletedMessage : DomainEventMessage
{
    public Guid TransactionId { get; init; }
    public Guid DeviceId { get; init; }
    public TransactionType Type { get; init; }
    public decimal Amount { get; init; }
    public DateTime CompletedUtc { get; init; }
}

// Device offline notification
public record DeviceOfflineMessage : DomainEventMessage
{
    public Guid DeviceId { get; init; }
    public DateTime LastSeenUtc { get; init; }
    public int OfflineDurationMinutes { get; init; }
    public string? DiagnosticInfo { get; init; }
}

// Low inventory alert
public record InventoryLowMessage : DomainEventMessage
{
    public Guid DeviceId { get; init; }
    public Guid DenominationId { get; init; }
    public string DenominationName { get; init; }
    public int CurrentCount { get; init; }
    public int ThresholdCount { get; init; }
}

// License expiration alert
public record LicenseExpiringMessage : DomainEventMessage
{
    public Guid LicenseId { get; init; }
    public int DaysUntilExpiry { get; init; }
    public DateTime ExpiryDate { get; init; }
}

// Sync request initiation
public record SyncRequestInitiatedMessage : DomainEventMessage
{
    public Guid SyncId { get; init; }
    public Guid DeviceId { get; init; }
    public DateTime RequestedUtc { get; init; }
}

// CIT (Cash-In-Transit) completion
public record CITEventCompletedMessage : DomainEventMessage
{
    public Guid CITEventId { get; init; }
    public Guid DeviceId { get; init; }
    public DateTime ActualCompletionUtc { get; init; }
    public string RouteId { get; init; }
    public bool WasSuccessful { get; init; }
}
```

### 6.3 Sync Protocol

Device-to-cloud synchronization contract (REST or Service Bus):

```csharp
// Request from device to cloud
public record DeviceSyncRequest(
    Guid DeviceId,
    Guid SyncId,
    HardwareInventory CurrentInventory,
    List<TransactionResponse> LocalTransactions,
    DateTime RequestedUtc,
    string FirmwareVersion,
    string? DiagnosticInfo = null
);

// Response from cloud to device
public record DeviceSyncResponse(
    Guid SyncId,
    bool AcknowledgeSyncSuccess,
    List<TransactionResponse> TransactionsToReverseLocally,
    List<string> ConfigurationUpdates,
    DateTime ServerUtc,
    string? ErrorMessage = null
);
```

---

## 8. Versioning & Packaging

### 7.1 NuGet Package Strategy
<!-- Jira: RCORE-98 | Epic: RCORE-94 | Synced: 2026-04-11 -->

**Decision: Multi-repo with selective NuGet** (see [Repository Structure ADR](../03%20-%20Architecture%20Decisions/repository-structure-decisions.md))

Only truly shared contracts are published as NuGet packages. Libraries with a single consumer live in that consumer's repo as project references:

**Published to private NuGet feed (recycleriq-core repo):**
- `RecyclerIQ.Domain` — consumed by all repos
- `RecyclerIQ.Common` — consumed by all repos
- `RecyclerIQ.Protos` — consumed by recycleriq-link (server stubs) and recycleriq-clients (client stubs)

**Project references (NOT NuGet):**
- `RecyclerIQ.UI.Shared` — lives in recycleriq-clients (only clients consume it)
- `RecyclerIQ.Hardware` — lives in recycleriq-link (only Link.Service consumes it)

If a second consumer appears for either (e.g., Web.Portal needs UI.Shared components), extract to NuGet at that point.

### 7.2 Assembly Versioning
<!-- Jira: RCORE-99 | Epic: RCORE-94 | Synced: 2026-04-11 -->

If using NuGet, follow semantic versioning:

```xml
<!-- RecyclerIQ.Domain.csproj -->
<PropertyGroup>
    <AssemblyVersion>1.0.0.0</AssemblyVersion>
    <FileVersion>1.0.0.0</FileVersion>
    <Version>1.0.0</Version>
    <InformationalVersion>1.0.0-alpha.1</InformationalVersion>
</PropertyGroup>
```

Version scheme:
- **MAJOR:** Breaking changes (e.g., entity refactoring)
- **MINOR:** New features (e.g., new domain event)
- **PATCH:** Bug fixes

### 7.3 Breaking Change Policy

Before making breaking changes:
1. Create a deprecation notice in release notes
2. Support old API for at least 1 minor version
3. Provide migration guide in documentation
4. Test all consumers before release

Example deprecation:

```csharp
[Obsolete("Use GetInventoryAsync() instead. Will be removed in v2.0", false)]
public Task<Dictionary<string, int>> GetCashBreakdownAsync(CancellationToken ct)
{
    return GetInventoryAsync(ct).ContinueWith(t =>
        t.Result.DenominationCounts.ToDictionary(kvp => kvp.Key.ToString(), kvp => kvp.Value));
}
```

### 7.4 CI/CD Integration
<!-- Jira: RCORE-97 | Epic: RCORE-94 | Synced: 2026-04-11 -->

CI/CD for NuGet packages (recycleriq-core repo only):

```yaml
# .github/workflows/publish-nuget.yml
name: Publish NuGet Packages
on:
  push:
    tags:
      - 'v*'
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-dotnet@v1
        with:
          dotnet-version: '10.x'
      - run: dotnet pack RecyclerIQ.Domain -c Release
      - run: dotnet pack RecyclerIQ.Common -c Release
      - run: dotnet pack RecyclerIQ.Protos -c Release
      - run: dotnet nuget push **/*.nupkg -s ${{ secrets.NUGET_FEED_URL }} -k ${{ secrets.NUGET_API_KEY }}
```

> **Note:** UI.Shared and Hardware are NOT packed/published — they are project references in their respective repos. Protos IS published because two repos (link + clients) consume the generated stubs.

---

## 9. Open Items & Gaps

### Critical Gaps
<!-- Jira: N/A | Note: Design documentation — no story needed -->

⚠ **No Unified DTO Contract Schema**
- **Issue:** Request/Response DTOs defined ad-hoc in Section 3.4
- **Impact:** API versioning, client code generation, API documentation are unclear
- **Action Item:** Define OpenAPI/Swagger spec or JSON Schema for all DTOs
- **Owned By:** Tech Lead

⚠ **No Domain Event Catalog**
- **Issue:** Domain events listed in Section 2 but no formal schema
- **Impact:** Event handlers may miss subscribers, no versioning strategy
- **Action Item:** Create event catalog with schema, routing rules, and versioning policy
- **Owned By:** Architect

⚠ **No Service Bus Message Schema**
- **Issue:** Service Bus messages defined in Section 6.2 but no formal specification
- **Impact:** Unclear message format, serialization strategy, and error handling
- **Action Item:** Define JSON Schema or Protocol Buffers for all messages
- **Owned By:** Infrastructure Lead

~~⚠ **No NuGet/Packaging Strategy**~~ **RESOLVED**
- **Decision:** Multi-repo with selective NuGet. Domain and Common published to private NuGet feed. UI.Shared and Hardware stay as project references in their single-consumer repos. See Section 7.1 and [Repository Structure ADR](../03%20-%20Architecture%20Decisions/repository-structure-decisions.md).

⚠ **No Shared Validation Rules**
- **Issue:** Validation logic scattered across layers (entity validation, DTO validation, API validation)
- **Impact:** Inconsistent validation messages, duplicated logic
- **Action Item:** Create RecyclerIQ.Validation project with centralized FluentValidation rules
- **Owned By:** Any Developer

⚠ **No Error Code Catalog**
- **Issue:** Error messages hardcoded in Section 3.3; no standardized error codes
- **Impact:** Clients cannot reliably handle errors, difficult to localize
- **Action Item:** Define error code enum (e.g., ErrorCode.TenantNotFound = 4001)
- **Owned By:** Architect

### Medium-Priority Gaps

⚠ **KisanRecycler Implementation Incomplete**
- **Issue:** Only `ConnectAsync` and `GetInventoryAsync` partially implemented (Section 5.2)
- **Impact:** Cannot test Kisan device integration until complete
- **Action Item:** Implement remaining methods (Deposit, Withdraw, InsertBill) with Kisan CRS-2 protocol
- **Owned By:** Hardware Engineer

⚠ **Hardware Simulator Missing Edge Cases**
- **Issue:** SimulatorRecycler is too simple (always succeeds, no latency simulation)
- **Impact:** Tests don't catch real-world issues (connection timeouts, partial failures)
- **Action Item:** Add configurable failure modes, latency simulation, network jitter
- **Owned By:** QA Lead

⚠ **UI.Shared Components Not Implemented**
- **Issue:** Section 4 lists components but only interfaces are defined
- **Impact:** MAUI app cannot consume until Razor components are built
- **Action Item:** Implement all components in Section 4 with Tailwind/Bootstrap styling
- **Owned By:** Frontend Lead

⚠ **No Transaction Reversal Workflow**
- **Issue:** Domain supports TransactionStatus.Reversed but no service for initiating reversal
- **Impact:** Operators cannot correct mistakes
- **Action Item:** Create TransactionReversalService with audit trail and reconciliation checks
- **Owned By:** Any Developer

### Low-Priority Gaps

⚠ **No Audit Trail Format Specification**
- **Issue:** AuditLog entity exists but JSON schema for `Changes` column not defined
- **Impact:** Audit reports difficult to parse
- **Action Item:** Define AuditLog.Changes schema (e.g., JSON with old/new values)
- **Owned By:** Compliance Lead

⚠ **No Soft Delete Strategy**
- **Issue:** No consistent approach for deactivating entities (vs. hard delete)
- **Impact:** Data recovery unclear, logical consistency issues
- **Action Item:** Define RecyclerIQ.Domain.SoftDeletable interface and repository pattern
- **Owned By:** Architect

⚠ **No Multi-Tenancy Isolation Tests**
- **Issue:** Domain supports multi-tenancy but no tests verify data isolation
- **Impact:** Security risk if TenantId filter accidentally bypassed
- **Action Item:** Add integration tests for multi-tenant data isolation
- **Owned By:** QA Lead

---

## Appendix A: Dependency Graph

```
recycleriq-core (NuGet packages):
  RecyclerIQ.Domain (zero external deps)
      ↓
  RecyclerIQ.Common → RecyclerIQ.Domain

recycleriq-clients (project references to UI.Shared, NuGet refs to Domain/Common):
  RecyclerIQ.UI.Shared → RecyclerIQ.Common, RecyclerIQ.Domain (NuGet)
  RecyclerIQ.UI.TaxAuthority / RetailClient / WebClient → RecyclerIQ.UI.Shared (project ref)

recycleriq-link (project reference to Hardware, NuGet refs to Domain/Common):
  RecyclerIQ.Hardware → RecyclerIQ.Domain (NuGet)
  RecyclerIQ.Link.Service → RecyclerIQ.Hardware (project ref)

recycleriq-cloud (NuGet refs to Domain/Common):
  RecyclerIQ.Application → RecyclerIQ.Domain, RecyclerIQ.Common (NuGet)
  RecyclerIQ.Infrastructure → RecyclerIQ.Application, RecyclerIQ.Domain
  RecyclerIQ.API / RecyclerIQ.Web.Portal → RecyclerIQ.Application
```

---

## Appendix B: File Structure Summary

```
recycleriq-core/ (NuGet packages)
├── RecyclerIQ.Domain/
│   ├── Aggregates/ (Tenant, Store, Device, Transaction, User, License)
│   ├── ValueObjects/ (Money, CashBreakdown, Address, TimeRange, HardwareIdentity)
│   ├── DomainEvents/ (TransactionCompletedEvent, DeviceOfflineEvent, etc.)
│   ├── Interfaces/ (ILinkClient, IRepository<T>, ISpecification<T>, IBillingService)
│   ├── Enums/ (TenantType, TransactionType, DeviceStatus, LicenseType, AlertSeverity, SiteAuthMethod)
│   ├── Auth/ (AuthCredentials, PinCredentials, PasswordCredentials, AuthResult, UserClaims)
│   └── Exceptions/ (DomainException, InvalidTenantException, etc.)
│
└── RecyclerIQ.Common/
    ├── Results/ (Result<T>, PagedResult<T>)
    ├── Utilities/ (Guard, LoggingExtensions, ClockProvider)
    ├── Extensions/ (StringExtensions, EnumerableExtensions, DateTimeExtensions)
    ├── Constants/ (AppConstants, ErrorMessages)
    ├── Dtos/ (CreateTransactionRequest, TransactionResponse, etc.)
    ├── Contracts/ (SyncRequest, SyncResponse, DomainEventMessage, TransactionCompletedMessage, etc.)
    └── Helpers/ (DateRangeHelper)

recycleriq-clients/ (project reference)
└── RecyclerIQ.UI.Shared/
    ├── Components/ (RecyclerStatusIndicator, CashInventoryGrid, TransactionHistoryTable, SimulatorControlPanel, etc.)
    ├── Layouts/ (MainLayout, SidebarNavigation, BreadcrumbNavigation)
    ├── Styles/ (_variables.css, _components.css, app.css)
    └── wwwroot/ (CSS, JS, Chart.js, Printer Service, Hardware Connect Service)

recycleriq-link/ (project reference)
└── RecyclerIQ.Hardware/
    ├── Interfaces/ (IRecycler, IRecyclerFactory, ISimulatorControl)
    ├── Models/ (HardwareInventory)
    ├── Implementations/ (SimulatorRecyclerClient, KisanRecycler)
    ├── Factory/ (RecyclerFactory)
    └── Extensions/ (HardwareServiceCollectionExtensions)
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-22 | Claude | Initial PRD for shared libraries; all sections complete; 8 critical gaps flagged |

---

**End of Sub-PRD Document**
