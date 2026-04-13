# Working Memory

## Me
**Tommy Lewers** — Founder & Senior Developer at Lewers Logic LLC  
Email: tommy@llogicsoftware.com  
Tech: .NET Core C#, Azure, Blazor, Entity Framework Core

## People
| Who | Role | Notes |
|-----|------|-------|
| **Kyle Tate** | Investing Partner & Legal Counsel | Co-founder of Tate legal practice |
| **Brenda Tate** | Investing Partner & Legal Counsel | Co-founder of Tate legal practice |
| **Debra Bunge** | KISAN America, Partnership Lead | Stakeholder in Recycler.IQ |
| **Patrick Moore** | KISAN America, Partnership | Stakeholder in Recycler.IQ |

## Terms
| Term | Meaning |
|------|---------|
| **RIQ** | Recycler.IQ (product) |
| **KISAN** | KISAN America (tax software partner) |
| **Sprint 1** | Current dev sprint (Mar 29 — Apr 19, 2026) |
| **GA** | General Availability (v1.0 release) |
| **ADR** | Architecture Decision Record |
| **CIT** | Cash-In-Transit |
| **ML** | Machine Learning (forecasting engine) |

## Projects
| Name | Jira Key | What |
|------|----------|------|
| **Recycler.IQ** | — | Core product — ML-powered recycler cash flow optimization |
| **RCORE** | RCORE | Shared domain/packages foundation (in progress) |
| **RCLIENT** | RCLIENT | MAUI Blazor + Blazor Server clients (50% complete) |
| **RCLOUD** | RCLOUD | Cloud API, portal, analytics (backlog) |
| **RLINK** | RLINK | Edge service, hardware abstraction (backlog) |
| **RIQSIM** | RIQSIM | Hardware simulator for dev/demo (backlog) |
| **Legal Mind** | LM | LegalMind MCP Server — legal research tools (planning phase) |

## Repo-to-Jira Mapping
| Repo Directory | Jira Key |
|----------------|----------|
| `Recycler.IQ/recycleriq-core` | RCORE |
| `Recycler.IQ/recycleriq-client` | RCLIENT |
| `Recycler.IQ/recycleriq-cloud` | RCLOUD |
| `Recycler.IQ/recycleriq-link` | RLINK |
| `Recycler.IQ/recycleriq-sim` | RIQSIM |
| `legal-mind` | LM |

## Accessible Directories
- `/Lewers Logic LLC/` (company root)
- `/Lewers Logic LLC/Company Planning/`
- `/Lewers Logic LLC/Recycler.IQ/Recycler.IQ Planning`
- `/Lewers Logic LLC/legal-mind/Legal Mind Planning` (Legal Mind project planning)

## Preferences
- Brief, direct answers — no hand-holding
- Ask don't guess — stop if uncertain
- Senior .NET dev level (no basics)
- Respect .md as source of truth (sync .docx after updates)

## Document Status Convention
When creating or updating PRDs and ADRs, always set the `Status` field:
- **Draft** — Initial creation, still being written
- **Pending Review** — Complete, awaiting Tommy's review
- **Accepted** / **Final** — Reviewed and approved by Tommy
- Only documents marked **Accepted** or **Final** are eligible for Jira sync (epic/story creation)
- Never mark a document as Accepted/Final without explicit approval from Tommy

## Jira Sync Rules
- Local planning docs (PRDs, ADRs) are the source of truth for requirements
- Jira is the source of truth for task status and sprint tracking
- Planning directories that sync to Jira:
  - `Recycler.IQ/Recycler.IQ Planning/` → RCORE, RCLIENT, RCLOUD, RLINK, RIQSIM
  - `legal-mind/Legal Mind Planning/` → LM
- Only PRDs contain syncable user stories (not ADRs)

## Per-Section Jira Sync Markers
Each requirement section in a PRD has an HTML comment marker tracking its Jira sync state:
- **Synced:** `<!-- Jira: LM-5 | Epic: LM-15 | Synced: 2026-04-09 -->` — story exists in Jira
- **Multi-story:** Multiple markers on consecutive lines if a section maps to multiple stories
- **Not yet synced:** `<!-- Jira: NONE | Synced: N/A -->` — no Jira story exists; candidate for creation
- **With notes:** `<!-- Jira: KEY | Epic: EPIC | Synced: DATE | Note: context -->` — optional note field

Rules:
- When creating new PRD requirement sections, always add `<!-- Jira: NONE | Synced: N/A -->` as a placeholder
- After creating a Jira story for a section, update the marker with the story key, epic, and date
- Never create duplicate Jira stories — always check the marker first
- The scheduled task scans for `Jira: NONE` markers and alerts Tommy for approval before creating stories
- Doc-level Status (Final, Draft, etc.) is for document maturity, NOT for Jira sync gating

## Do