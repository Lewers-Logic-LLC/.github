# Lewers Logic LLC

**Structure:** Parent company with child projects  
**Owner:** Tommy Lewers (tlewers01@gmail.com)  
**Team Size (Recycler.IQ):** 3 full-time developers

## Jira Instance
- **URL:** llogic.atlassian.net
- **Cloud ID:** d2705d7b-8040-4cae-905c-f1014414e770
- **Status:** Fully populated as of 2026-03-29
- **Projects:**
  - RCORE (Recycler.IQ Core)
  - RCLIENT (Recycler.IQ Client)
  - RCLOUD (Recycler.IQ Cloud)
  - RLINK (Recycler.IQ Link/Edge)
  - RIQSIM (Recycler.IQ Simulator)
  - PBV (sample data project)
  - RIQ (primary product project)

## Connected Accounts
- **Email:** tlewers01@gmail.com / tommy@llogicsoftware.com
- **Gmail:** Integrated, search available
- **Google Calendar:** Integrated
- **Slack:** llogic.slack.com, 8 channels mapped
- **Jira:** llogic.atlassian.net, all projects accessible
- **GitHub:** Source control, Actions CI/CD

## Tech Stack
- **Language:** C# / .NET Core (latest LTS)
- **Web Frameworks:** ASP.NET Core, Blazor, Razor Pages
- **Data:** Entity Framework Core, SQL Server, Azure SQL
- **Cloud:** Azure (App Service, Functions, Storage, Key Vault)
- **Frontend:** WordPress (company site), MudBlazor (internal apps)
- **Mobile:** MAUI Blazor Hybrid

## File Structure
**Lewers Logic LLC/** (mounted folder)
├── Company Planning/
│   ├── 1 - Branding/
│   ├── 2 - Planning/
│   ├── 3 - Documentation/
│   ├── 4 - Legal/
│   └── 5 - Marketing/
├── Recycler.IQ/
│   ├── Branching_model.md
│   ├── Master_PRD_v3.md
│   └── Recycler.IQ Planning/
│       ├── 01 - Branding/
│       ├── 02 - PRDs/
│       ├── 03 - Architecture Decisions/
│       ├── 04 - Project Management/
│       ├── 05 - Research/
│       └── 06 - Website Landing page/
└── (source code repos: recycleriq-core, recycleriq-clients, recycleriq-link, recycleriq-simulator)

**Legal Mind Planning/** (separate mounted folder)
├── 01 - Branding/
├── 02 - PRDs/
├── 03 - Architecture Decisions/
├── 04 - Project Management/
├── 05 - Research/
└── 06 - Documentation/

## Document Sync Rule
- **.md is the source of truth** — always update .md first
- When .md changes, regenerate paired .docx files
- Never update .docx without updating .md
