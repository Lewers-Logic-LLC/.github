# Branching Model

## Overview

All RecyclerIQ projects follow a sprint-based branching model with protected main/develop branches and automated versioning.

```
main (protected) ←── release/X.Y.Z (protected)
                      ↑
                    develop (protected)
                      ↑
                 sprint/sprint-N
                      ↑
        feature/ | bugfix/ | hotfix/
```

## Branch Types

| Branch | Purpose | Protection | Merge To |
|--------|---------|-----------|----------|
| `main` | Official releases | PR + build required | N/A (release gate) |
| `release/X.Y.Z` | QA/UAT candidate | PR + build required | main (after approval) |
| `develop` | Integration branch | PR + build required | release/X.Y.Z |
| `sprint/sprint-N` | Current sprint | No protection | develop (PR) |
| `feature/<TICKET>-description` | Feature work | No protection | sprint branch (PR) |
| `bugfix/<TICKET>-description` | Bug fixes | No protection | sprint branch (PR) |
| `hotfix/<TICKET>-description` | Critical fixes | No protection | sprint branch (PR) |

## Branch Naming

All feature, bugfix, and hotfix branches **must** include the Jira ticket number and a short description.

**Format:** `<type>/<TICKET>-short-description`

- **Single ticket:** `feature/RCLIENT-25-appsettings-binding`
- **Epic-level (multi-ticket):** `feature/RCLIENT-1-initial-scaffolding`
- **Bug fix:** `bugfix/RCORE-14-null-denomination-crash`
- **Hotfix:** `hotfix/RCLOUD-50-sync-timeout`

This applies to all project prefixes: `RCORE`, `RCLOUD`, `RCLIENT`, `RLINK`, `RSIM`.

## Workflow

### During a Sprint

1. Create feature/bugfix branches off `sprint/sprint-N` with Jira ticket in the name
2. Open PRs from feature → sprint
3. Merge after passing CI

### End of Sprint

1. Open PR: `sprint/sprint-N` → `develop`
2. Once approved + CI passes, merge
3. This integrates all sprint work

### For a Release

1. Create `release/X.Y.Z` from `develop`
2. QA/UAT tests the release branch
3. Bug fixes: branch off release, merge back into it
4. Once approved, merge `release/X.Y.Z` → `main`
5. Tag `vX.Y.Z` on main (triggers deployment/release)
6. Merge release branch back into develop

### For Hotfixes

1. Create `hotfix/*` from `sprint/sprint-N` (or main if critical)
2. Fix and merge back into sprint
3. Don't skip the sprint/develop gates

## Versioning

### NuGet Package Repos (recycleriq-core)

- **develop** → pre-release `0.1.0-dev.N` (auto-publish)
- **release/0.1.0** → release candidate `0.1.0-rc.N` (auto-publish)
- **main (tagged v0.1.0)** → stable `0.1.0` (auto-publish)

### Application Repos (non-NuGet)

- **main (tagged vX.Y.Z)** → triggers deployment
- No pre-release versions; only stable releases on main
- Versioning managed in `Directory.Build.props` or equivalent

## Branch Protection Rules

### main
- ✅ Require PR
- ✅ Require 1 approval
- ✅ Require build to pass
- ❌ Enforce on admins (admin bypass allowed)

### develop
- ✅ Require PR
- ✅ Require 1 approval
- ✅ Require build to pass
- ❌ Enforce on admins (admin bypass allowed for solo dev / emergencies)

### release/\*
- ✅ Require PR
- ✅ Require 1 approval
- ✅ Require build to pass
- ❌ Enforce on admins (admin bypass allowed for hotfixes)

## CI/CD Triggers

| Trigger | Runs Build | Publishes | Notes |
|---------|-----------|-----------|-------|
| Push to feature/\*, bugfix/\*, hotfix/\*, refactor/\*, chore/\* | ✅ | — | Immediate dev feedback |
| Push to develop | ✅ | ✅ (pre-release) | NuGet repos only |
| Push to release/\* | ✅ | ✅ (RC) | NuGet repos only |
| Push tag v\* | ✅ | ✅ (stable) | Official release |
| PR to main, develop, release/\*, sprint/\* | ✅ | — | Merge gatekeeping |

## Commit Message Format

All commits **must** start with the Jira ticket number.

### Single-ticket commit

```
<TICKET> <type>: <description>

<body (optional)>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

### Multi-ticket commit (use the Epic number)

```
<EPIC> <type>: <description>

- <TICKET-1>: what was done for this ticket
- <TICKET-2>: what was done for this ticket
- <TICKET-3>: what was done for this ticket

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

**Types**: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`

**Single-ticket examples**:
- `RCLIENT-25 feat: bind AppModeOptions to appsettings.json`
- `RCORE-14 fix: handle null denominations in CashBreakdown`
- `RCLOUD-10 chore: bump version to 0.2.0 after 0.1.0 release [skip ci]`

**Multi-ticket example**:
```
RCLIENT-1 feat: initial solution scaffolding

- RCLIENT-10: scaffolded all 4 projects with test project
- RCLIENT-12: implemented LocalIdentityProvider with PIN + password auth
- RCLIENT-14: added RiqAuthenticationStateProvider Blazor auth adapter
- RCLIENT-15: wired MauiProgram.cs DI for demo mode

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

## Solo Dev Setup (Temporary)

When working alone, approval requirements are disabled to allow self-merge:
- Can merge own PRs after CI passes
- Once team grows, re-enable approvals for code review

To re-enable approvals on `develop`:
```bash
gh api repos/<owner>/<repo>/branches/develop/protection -X PUT \
  -f 'required_pull_request_reviews[required_approving_review_count]=1'
```

## Automated Tasks

### Version Bumping (NuGet Repos Only)

When a new `sprint/sprint-N` branch is created:
1. Workflow checks if current version has a release tag
2. If yes, auto-bumps `VersionPrefix` in `Directory.Build.props`
3. Commits and pushes with `[skip ci]` to avoid recursive builds

### Release Workflow Checklist

- [ ] Create `release/X.Y.Z` from develop
- [ ] Update version if needed
- [ ] Run QA/UAT on the release branch
- [ ] Fix any bugs on the release branch
- [ ] Get approval
- [ ] Merge to main
- [ ] Tag `vX.Y.Z` on main
- [ ] Merge release branch back to develop
- [ ] Close/archive the release branch
