---
name: roadmap-and-productivity-update
description: Daily Jira sync, PRD→Jira tracking, roadmap status update, and Slack productivity report.
model: sonnet
---

Run a daily productivity and roadmap update for Recycler.IQ:

**Model Strategy**
- Main task: Claude Sonnet (orchestration, compilation, Slack/email drafting)
- Jira lookups: Delegate to Haiku agent (Phase 1 queries, PRD sync checks)

**Phase 1: Query Jira for Slack/Email Metrics** *(Delegate to Haiku Agent)*
- Kick off haiku agent to query Jira and return structured metrics for Slack/email outputs
- Agent task: Pull Sprint 1 status across all 6 projects (RCORE, RCLIENT, RCLOUD, RLINK, RIQSIM, LM)
- Agent collects:
  - Total issues, Done count, In Progress, Ready (backlog), Pending Dev Review, Blocked items
  - Per-project breakdown (status counts by project)
  - List of all blocked items with keys and titles
- Agent returns structured JSON:
  ```json
  {
    "totalIssues": number,
    "done": number,
    "inProgress": number,
    "ready": number,
    "pendingReview": number,
    "blocked": number,
    "blockedIssues": [{"key": "RLINK-3", "title": "Sync & Background Services"}],
    "perProjectStatus": {
      "RCORE": {"done": ..., "inProgress": ..., "ready": ..., ...},
      "RCLIENT": {...},
      ...
    }
  }
  ```
- Sonnet receives metrics for use in Phase 4-5 (Slack/email)

**Phase 2: Invoke Productivity Skills** *(Skill connects to Jira directly)*
- Run `/product-management:roadmap-update` skill — update RecyclerIQ_Roadmap.md with current Jira state
  - Skill has access to `~~project tracker` (Jira) and will pull metrics directly
  - Updates roadmap with: current epic statuses, sprint progress, per-project breakdown
  - Extracts Executive Summary from updated roadmap for Phase 5 email
- Run `/productivity:update` skill — sync tasks and refresh memory with latest sprint data

**Phase 3: PRD Sync & Drift Check** *(Haiku Agent, continued from Phase 1)*
- Scan all PRD files in `/Lewers Logic LLC/Recycler.IQ/Recycler.IQ Planning/02 - PRDs/` for unsynced markers `<!-- Jira: NONE | Synced: N/A -->`
- Report any unsynced sections as candidates for Jira story creation
- Verify Master_PRD_v4.md references all sub-PRDs correctly and uses correct product name ("Recycler.IQ")
- Check for drift between Master_PRD_v4.md and sub-PRDs
- Also scan `/legal-mind/Legal Mind Planning/02 - PRDs/` for same unsynced markers
- Agent returns: list of unsynced sections (if any), drift findings (if any)

**Phase 4: Slack Report**
- Compile daily metrics from Phase 1 Jira query
- Include per-project status table with accurate counts (Done, In Progress, In Test, Ready, etc.)
- Include direct link to RecyclerIQ_Roadmap.md (updated in Phase 2)
- Include link to Master_PRD_v4.md for reference
- Format as concise daily status update with sprint metrics, blockers, per-project status, and any unsynced PRD sections needing review

**Phase 5: Email Draft to Investors**
- Extract the **Executive Summary** section from the updated RecyclerIQ_Roadmap.md (created in Phase 2)
  - Pull the metrics table (Total Epics, In Progress, Backlog, Completed, At Risk)
  - Pull the Projects Status Overview table (RCORE, RCLIENT, RCLOUD, RLINK, RIQSIM status)
- Create a draft email to Kyle Tate and Brenda Tate (investing partners & legal counsel)
- Subject: "Recycler.IQ Sprint 1 Status Update — {date}"
- Include:
  - The extracted Executive Summary tables from the roadmap
  - Key blockers (note: RLINK-3 if present)
  - Any legal/compliance-relevant decisions needed
  - Link to Master_PRD_v4.md for full product context
  - Tone: Professional but conversational, suitable for co-founders with legal/investment background
- Save as a draft in Gmail (do NOT send automatically)

**Output:**
- Slack DM to Tommy with roadmap and Master PRD links, current per-project metrics, blockers, and unsynced sections flagged for manual review
- Gmail draft email to Kyle and Brenda with Sprint 1 status update ready for review/send