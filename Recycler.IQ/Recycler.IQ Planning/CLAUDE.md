This folder contains Planning documents for the Recycler.IQ Planning project.

## On Start / After Compact

**MANDATORY**: At the beginning of every conversation and after every context compaction, read all memory files listed in `/sessions/stoic-admiring-carson/mnt/.auto-memory/MEMORY.md`. These contain critical user preferences, feedback rules, project context, and reference info that must inform your behavior. Do not rely on the one-line index alone — read the actual `.md` files so you have the full detail.

## Key Context

- **Company**: Lewers Logic LLC — parent company and copyright holder for all Recycler.IQ software
- **Owner**: Tommy Lewers (tommy@llogicsoftware.com)
- **Brand name**: Recycler.IQ (dot notation for branding; domain is recycler-iq.com)
- **Product namespace**: RecyclerIQ (no dot in code — e.g., `RecyclerIQ.Domain`, `RecyclerIQ.Link.Service`)
- **Copyright**: `© 2026 Lewers Logic LLC. All rights reserved.` — use in AssemblyInfo, LICENSE files, NuSpec, file headers
- **Domain**: recycler-iq.com (app subdomain: app.recycler-iq.com)
- **Tech stack**: .NET 10, C#, Blazor, MAUI Blazor Hybrid, Azure, Clean Architecture
- **Brand palette**: Deep Navy #0F084B, Dark Blue #26408B, Medium Blue #3D60A7, Light Blue #81B1D5, Pale Blue #A0D2E7, Body Text #2C3E50, Light Text #5A7A9B, BG Tint #E8F2F9
- **Font**: Arial
- **Target markets**: Tax authorities, retailers, c-stores, cannabis industry, financial institutions
- **Website hosting**: WordPress on hosting.com (WPAdmin + block editor + WPForms)
- **Icon variants**: Two icon designs exist — $ center (primary) and IQ center (alternate). Each has three color versions: original on white bg, original on transparent bg, and white on transparent bg.
- **Logo for dark backgrounds**: Use white variant or icon image + HTML text (tagline text baked into the full logo image is too small at typical header heights)

## Directory Layout 

Recycler.IQ Planning/
├── 01 - Branding/                          ← All branding docs, logos, icons
│   ├── RecyclerIQ_Logo.pdf                    ← Full logo (v6c — twisting arrows + $)
│   ├── RecyclerIQ_Logo_preview.png            ← Full logo PNG preview
│   ├── RecyclerIQ_Logo_transparent.png        ← Full logo, original colors, transparent bg
│   ├── RecyclerIQ_Logo_White_transparent.png  ← Full logo, white, transparent bg
│   ├── RecyclerIQ_Icon.pdf                    ← App icon PDF ($ center)
│   ├── RecyclerIQ_Icon_*.png                  ← $ icon — original on white bg (512/192/48/32/16)
│   ├── RecyclerIQ_Icon_Transparent_*.png      ← $ icon — original colors, transparent bg (512/192/48/32/16)
│   ├── RecyclerIQ_Icon_White_*.png            ← $ icon — white on transparent bg (512/192/48/32/16)
│   ├── RecyclerIQ_Icon_IQ.pdf                 ← Alt icon PDF (IQ center)
│   ├── RecyclerIQ_Icon_IQ_*.png               ← IQ icon — original on white bg (512/192/48/32/16)
│   ├── RecyclerIQ_Icon_IQ_Transparent_*.png   ← IQ icon — original colors, transparent bg (512/192/48/32/16)
│   ├── RecyclerIQ_Icon_IQ_White_*.png         ← IQ icon — white on transparent bg (512/192/48/32/16)
│   ├── RecyclerIQ_BrandGuide.docx
│   ├── RecyclerIQ_BrandGuide.md
│   ├── LogoDesign_Philosophy.md
│   └── blue-monochrome-color-scheme.png
│
├── 02 - PRDs/                              ← All PRDs, organized by Jira project key
│   ├── Platform/                              ← Umbrella / cross-cutting PRDs
│   │   ├── Master_PRD_v3.md                     ← Umbrella PRD v3 (⚠ stale — v4 is current)
│   │   ├── Master_PRD_v3.docx
│   │   ├── Master_PRD_v4.md                     ← Umbrella PRD v4 (current, .md is source of truth)
│   │   └── Master_PRD_v4.docx
│   ├── RCORE/                                 ← Shared Libraries
│   │   ├── PRD_SharedLibraries.md
│   │   └── PRD_SharedLibraries.docx
│   ├── RCLOUD/                                ← Cloud API + Blazor Web Portal
│   │   ├── PRD_CloudAPI.md
│   │   ├── PRD_CloudAPI.docx
│   │   ├── PRD_BlazorPortal.md
│   │   └── PRD_BlazorPortal.docx
│   ├── RLINK/                                 ← Link.Service + Local Architecture
│   │   ├── PRD_LinkService.md
│   │   ├── PRD_LinkService.docx
│   │   ├── Local_Architecture_PRD_v1.md
│   │   └── Local_Architecture_PRD_v1.docx
│   ├── RCLIENT/                               ← MAUI Blazor Hybrid
│   │   ├── PRD_MAUIBlazorHybrid.md
│   │   └── PRD_MAUIBlazorHybrid.docx
│   ├── RINFRA/                                ← Infrastructure
│   │   ├── PRD_Infrastructure.md
│   │   └── PRD_Infrastructure.docx
│   ├── RIQSIM/                                ← Simulator
│   │   ├── PRD_Simulator.md
│   │   └── PRD_Simulator.docx
│   └── Demo/                                  ← Tax Authority Demo
│       ├── RecyclerIQ_TaxAuthority_Demo_PRD.md
│       ├── RecyclerIQ_TaxAuthority_Demo_PRD.docx
│       ├── RecyclerIQ_TaxAuthority_Demo_TechSpec.md
│       └── RecyclerIQ_TaxAuthority_Demo_TechSpec.docx
│
├── 03 - Architecture Decisions/            ← All ADRs, organized by Jira project key
│   ├── Platform/                              ← Cross-cutting / all-repo ADRs
│   │   ├── repository-structure-decisions.md
│   │   └── repository-structure-decisions.docx
│   ├── RCORE/                                 ← Shared Libraries / Domain ADRs
│   │   ├── authentication-identity-decisions.md
│   │   └── authentication-identity-decisions.docx
│   ├── RCLOUD/                                ← Cloud API + Database ADRs
│   │   ├── database-architecture-decisions.md
│   │   ├── database-architecture-decisions.docx
│   │   ├── identity-provider-vs-azure-ad-b2c.md
│   │   └── identity-provider-vs-azure-ad-b2c.docx
│   ├── RCLIENT/                               ← MAUI Blazor Hybrid client ADRs
│   │   ├── client-architecture-decisions.md
│   │   └── client-architecture-decisions.docx
│   ├── RLINK/                                 ← Link.Service local architecture ADRs
│       ├── Local_Architecture_ADR_v1.md
│       └── Local_Architecture_ADR_v1.docx
│   └── RIQSIM/                                ← Simulator architecture ADRs
│       ├── simulator-architecture-decisions.md
│       └── simulator-architecture-decisions.docx
│
├── 04 - Project Management/                ← All project management docs
│   ├── RecyclerIQ_Roadmap.docx                ← Product Roadmap (generated from .md, formatted for stakeholders)
│   └── RecyclerIQ_Roadmap.md                  ← Product Roadmap (generated daily from Jira by scheduled task)
│
├── 05 - Research/                          ← All research docs
│   ├── Market research.docx
│   └── Master Platform Name Options.docx
│
└── 06 - Website Landing page/              ← Marketing website assets
    ├── Recycler.IQ.html                      ← Standalone landing page (fully self-contained)
    ├── RecyclerIQ_Icon_white_web_2x.png      ← White icon for dark header (122x120 retina)
    └── wordpress/                            ← WordPress-ready version for WPAdmin
        ├── recycleriq-landing-content.html     ← Page body — paste into Custom HTML block
        ├── recycleriq-landing.css              ← Scoped styles (riq- prefix) — paste into Additional CSS
        ├── recycleriq-landing.js               ← Modal + countdown JS — wrap in <script> block
        └── WORDPRESS_SETUP_GUIDE.md            ← Step-by-step setup: WPForms, CSS, content, SEO

