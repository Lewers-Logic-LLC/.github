# Working Memory

## Me
**Tommy Lewers** — Founder & Senior Developer at Lewers Logic LLC
Email: tommy@llogicsoftware.com | Tech: .NET Core C#, Azure, Blazor, EF Core

## Projects
| Name | Jira Key | What |
|------|----------|------|
| **Recycler.IQ (RIQ)** | — | ML-powered recycler cash flow optimization |
| **RCORE** | RCORE | Shared domain/packages foundation |
| **RCLIENT** | RCLIENT | MAUI Blazor + Blazor Server clients |
| **RCLOUD** | RCLOUD | Cloud API, portal, analytics |
| **RLINK** | RLINK | Edge service, hardware abstraction |
| **RIQSIM** | RIQSIM | Hardware simulator |
| **Legal Mind (LM)** | LM | LegalMind MCP Server |

Current sprint: `sprint/recycler.iq-2` (Sprint 2).

## Repo-to-Jira Mapping
| Repo Directory | Jira Key |
|----------------|----------|
| `Recycler.IQ/recycleriq-core` | RCORE |
| `Recycler.IQ/recycleriq-clients` | RCLIENT |
| `Recycler.IQ/recycleriq-cloud` | RCLOUD |
| `Recycler.IQ/recycleriq-link` | RLINK |
| `Recycler.IQ/recycleriq-simulator` | RIQSIM |
| `legal-mind` | LM |

## Atlassian
| Site | CloudId |
|------|---------|
| llogic.atlassian.net | d2705d7b-8040-4cae-905c-f1014414e770 |

Agents MUST prefer the CloudId above over calling `getAccessibleAtlassianResources`. Only resolve via MCP if the value is missing from this file.

## Repo-to-Design Mapping
| Repo Directory | Design Skill | CSS Prefix |
|----------------|--------------|-----------|
| `Recycler.IQ/recycleriq-core` | `recycleriq-design` | `--riq-` |
| `Recycler.IQ/recycleriq-clients` | `recycleriq-design` | `--riq-` |
| `Recycler.IQ/recycleriq-cloud` | `recycleriq-design` | `--riq-` |
| `Recycler.IQ/recycleriq-link` | `recycleriq-design` | `--riq-` |
| `Recycler.IQ/recycleriq-simulator` | `recycleriq-design` | `--riq-` |
| `legal-mind` | `legalmind-design` | `--ll-` |

For any UI work (Blazor/Razor/CSS/MAUI views/MudBlazor theme/data viz), invoke the matching design skill BEFORE writing code. Never mix prefixes across brands.

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
Each PRD requirement section has an HTML comment tracking its Jira sync state:
- `<!-- Jira: NONE | Synced: N/A -->` — placeholder on new sections (candidate for creation)
- `<!-- Jira: KEY | Epic: EPIC-KEY | Synced: YYYY-MM-DD -->` — after story created
- Multi-story sections: consecutive markers, one per story
- Scheduled task scans `Jira: NONE` markers and asks for approval before creating stories — always check marker before creating to avoid duplicates
- Doc-level Status (Final/Draft) is for doc maturity, NOT Jira sync gating