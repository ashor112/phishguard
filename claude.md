# n8n Workflow Development — Claude Code Project

## Overview

This repo is a Claude Code workspace for building, testing, and fixing **n8n workflows** on **n8n Cloud**. Claude Code acts as the primary workflow engineer, with two integrations:

| Integration | Repo | Role |
|-------------|------|------|
| **n8n-MCP** | [czlonkowski/n8n-mcp](https://github.com/czlonkowski/n8n-mcp) | MCP server — exposes 20 n8n API tools Claude calls directly |
| **n8n-skills** | [czlonkowski/n8n-skills](https://github.com/czlonkowski/n8n-skills) | 7 Claude Code skills that auto-activate to guide workflow building |

---

## Environment Setup

### Credentials (`.env`)
Create a `.env` file at the project root — **never commit this file**:

```
N8N_API_URL=https://dina-n8n-aws.duckdns.org/
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2ZmZkZjA2Ny02NWIxLTQ3NDktOGViMS1hNzk0YjY4MzdlY2IiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiZGFlMGExZjctZGM0NS00MDgwLWE3NmUtMmZhNTMzOGRkMTlmIiwiaWF0IjoxNzc3NTIxNzE0fQ.OF6KwgEoDuBKBHe9kijueEJYs_XdO6Tb8DZmhMGKbTc
```

Get your API key: n8n Cloud dashboard -> Settings -> API -> Create API Key.

### MCP Server (n8n-MCP)
Already installed and built at `./n8n-mcp/`. The `.mcp.json` in this repo points Claude Code to the local build at:
```
./n8n-mcp/dist/mcp/index.js
```
Claude Code loads it automatically on startup. To verify, run `/mcp` in Claude Code and confirm `n8n` appears in the list.

If you ever need to rebuild (after pulling updates):
```bash
cd n8n-mcp
"C:/Program Files/nodejs/npm.cmd" install
"C:/Program Files/nodejs/npm.cmd" run build
```

### n8n-Skills
Already installed. All 7 skills were copied to `~/.claude/skills/`:
- n8n-mcp-tools-expert
- n8n-workflow-patterns
- n8n-node-configuration
- n8n-expression-syntax
- n8n-validation-expert
- n8n-code-javascript
- n8n-code-python

Skills activate automatically based on context — no manual invocation needed. Source: `./n8n-skills/`

---

## MCP Tools Reference

The n8n-MCP server exposes 20 tools. Always call `tools_documentation` first in a new session.

### Knowledge Tools (no n8n connection required)
| Tool | Purpose |
|------|---------|
| `tools_documentation` | Full reference for all MCP tools — call this first |
| `search_nodes` | Full-text search across 1,396+ n8n nodes |
| `get_node` | Get node details (minimal / standard / full) |
| `validate_node` | Validate a node's configuration |
| `validate_workflow` | Validate a complete workflow JSON |
| `search_templates` | Search 2,709+ community workflow templates |
| `get_template` | Get complete workflow JSON from a template |

### n8n API Tools (requires `N8N_API_URL` + `N8N_API_KEY`)
| Tool | Purpose |
|------|---------|
| `list_workflows` | List all workflows in the instance |
| `get_workflow` | Get full workflow JSON by ID |
| `create_workflow` | Create a new workflow |
| `update_workflow` | Full or partial update of a workflow |
| `delete_workflow` | Delete a workflow (irreversible — confirm with user first) |
| `activate_workflow` | Activate a workflow |
| `deactivate_workflow` | Deactivate a workflow |
| `execute_workflow` | Trigger a manual test execution |
| `get_execution` | Get result/logs of a specific execution |
| `list_executions` | List recent executions for a workflow |
| `validate_workflow` | Validate workflow before pushing |
| `get_workflow_versions` | List version history |

---

## n8n-Skills Auto-Activated Guidance

Once installed, these 7 skills activate automatically based on what you're working on:

| Skill | Activates when... |
|-------|------------------|
| **n8n MCP Tools Expert** | Using any MCP tool (highest priority) |
| **n8n Workflow Patterns** | Designing workflow structure |
| **n8n Node Configuration** | Configuring specific nodes |
| **n8n Expression Syntax** | Writing `{{ }}` expressions |
| **n8n Validation Expert** | Interpreting validation errors |
| **n8n Code JavaScript** | Writing Code node JS |
| **n8n Code Python** | Writing Code node Python |

---

## Workflow Development Process

### 1. Start of Session
```
mcp: tools_documentation   -- get full tool reference
mcp: list_workflows        -- see what already exists
```

### 2. Understand the Goal
- Identify trigger type: webhook, schedule, manual, or app event
- Identify integrations: APIs, databases, AI models, etc.
- Search templates before building from scratch:
  ```
  mcp: search_templates   -- search by keyword (e.g. "slack notification", "OpenAI")
  mcp: get_template       -- retrieve the full workflow JSON if a match is found
  ```

### 3. Design the Workflow
- Map out the node sequence before building
- Search for the right nodes:
  ```
  mcp: search_nodes   -- e.g. "HTTP Request", "Postgres", "AI Agent"
  mcp: get_node       -- get full parameter details for a specific node
  ```
- Prefer native n8n nodes over HTTP Request when a native node exists
- For AI/agent workflows: use the **AI Agent** node with tool nodes attached

### 4. Create or Update
```
mcp: create_workflow   -- new workflow
mcp: update_workflow   -- modify existing workflow
```
Always include a descriptive `name` and `tags`.

### 5. Validate Before Activating
```
mcp: validate_workflow   -- check for errors before going live
```
Fix all validation errors before proceeding.

### 6. Activate and Test
```
mcp: activate_workflow   -- enable the workflow
mcp: execute_workflow    -- trigger a manual test run
mcp: get_execution       -- inspect the result
```
Check `get_execution` for `finished: true` and `status: "success"`.

### 7. Iterate on Errors
- Read the error message from `get_execution`
- Use `validate_node` to pinpoint misconfigured nodes
- Fix the workflow JSON and re-run `update_workflow` -> `execute_workflow` -> `get_execution`
- For webhook workflows: use the **test URL** during development, switch to **production URL** when done

### 8. Document
Add the workflow to [workflows/README.md](workflows/README.md) with its name, ID, trigger, and credentials used.

---

## Best Practices

### General
- **Search templates first** (`search_templates`) — never build from scratch what already exists
- **Validate always** (`validate_workflow`) before activating
- Prefer native n8n nodes over HTTP Request nodes
- Use **Set** / **Edit Fields** nodes to normalize data between steps
- Keep each node single-purpose

### Error Handling
- Every production workflow **must** include an **Error Trigger** node connected to a notification node (e.g., Email, Slack, webhook)
- Use the Error output pin on nodes that can fail and route to a handler node

### Credentials & Security
- All credentials must live in the **n8n credential store** — never hardcode keys in node parameters
- Call `list_credentials` to find the right credential name to reference
- Never log or print credential values in expressions or Code nodes

### AI / LLM Workflows
- Use the **AI Agent** node as the orchestrator; attach tool nodes for actions
- Always set a **system prompt** on the AI Agent node
- Include a fallback/error branch for unexpected LLM output formats

### Testing
- Test with **small, representative sample data** before activating on live triggers
- For scheduled workflows: run manually first to confirm correctness
- Cover at least: one happy-path and one error-path execution

### Scheduling
- Use **n8n's Schedule Trigger** node
- Use UTC times to avoid timezone issues

---

## Workflow Categories in This Project

| Category | Notes |
|----------|-------|
| AI / LLM Agents | Claude, OpenAI, or other models via AI Agent node |
| API Integrations | Third-party service connections |
| Data Processing | ETL, transforms, database read/write |
| Automation / Scheduling | Cron-triggered, webhook-triggered, or event-driven tasks |

---

## Workflow Registry

All workflows are tracked in [workflows/README.md](workflows/README.md). Update it after every create or significant change.
