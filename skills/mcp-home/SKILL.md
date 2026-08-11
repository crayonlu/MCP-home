---
name: mcp-home
description: >
  Deploy and manage a self-hosted MCP gateway that aggregates upstream MCP
  servers behind stable URLs. Use when the user wants to set up MCP Home,
  add or manage MCP servers and credentials, authorize OAuth upstreams,
  install from the Market catalog, configure harnesses (Claude Code, Cursor,
  Codex, Grok) to connect through a single gateway URL, or troubleshoot MCP
  Home issues. Covers CLI, web console, Docker deployment, and CI/CD.
---

# MCP Home

MCP Home is a single-user, self-hosted Remote MCP control plane and protocol gateway. Manage upstream MCP servers and credentials in one place, then point any harness at stable, standard MCP URLs.

## When to Use This Skill

- User wants to deploy or manage an MCP gateway
- User wants to aggregate multiple MCP servers behind one URL
- User needs to authorize OAuth for MCP upstreams (Cloudflare, Notion, Linear, etc.)
- User wants to install MCP servers from a catalog (Market)
- User wants to connect Claude Code, Cursor, Codex, or Grok to a self-hosted MCP gateway
- User is troubleshooting MCP Home (status, OAuth, connectivity)

## Installation

MCP Home has three components. Install what you need:

### 1. Deploy the server (Docker)

```bash
docker run -d \
  --name mcp-home \
  -p 3344:3344 \
  -v mcp-home-data:/data \
  -e MCP_HOME_MASTER_KEY="$(openssl rand -base64 48)" \
  -e MCP_HOME_BOOTSTRAP_CONTROL_KEY="$(openssl rand -base64 48)" \
  -e MCP_HOME_PUBLIC_URL="https://mcp.example.com" \
  ghcr.io/crayonlu/mcp-home:latest
```

Or with Docker Compose (see `references/deployment.md`). After startup, open the web console at `MCP_HOME_PUBLIC_URL` and sign in with the bootstrap Control Key.

### 2. Install the CLI (npm)

```bash
npm install -g mcp-home
mcp-home auth login --url https://mcp.example.com --control-key "$MCP_HOME_CONTROL_KEY"
```

The CLI manages servers, credentials, OAuth, Market, and diagnostics from any terminal.

### 3. Install this skill (for AI agents)

```bash
npx skills add crayonlu/mcp-home -g -y
```

Teaches the agent all CLI commands, OAuth flows, Market installation, and troubleshooting.

## CLI Quick Reference

```bash
mcp-home status                         # overview
mcp-home doctor                         # health check
mcp-home server list                    # list servers
mcp-home server add ./server.json       # add a server
mcp-home credential list                # list credentials
mcp-home credential authorize <name>    # OAuth authorization (opens browser, waits)
mcp-home access-key create laptop       # create an MCP Access Key for harnesses
mcp-home endpoint aggregate             # show the aggregate endpoint URL
mcp-home market list                    # browse the Market catalog
mcp-home market install resend --set RESEND_API_KEY=re_xxx  # install from Market
```

## Common Workflows

### Deploy MCP Home

1. Generate two random keys (master + bootstrap control, each 32+ chars)
2. Start the Docker container with the keys and public URL
3. Open the web console, sign in with the bootstrap key
4. Create a new Control Key, revoke bootstrap
5. Run `mcp-home doctor` to verify health

### Add an Upstream Server

1. Create a credential:
   ```bash
   echo '{"name":"firecrawl","payload":{"type":"bearer","token":"fc-xxx"}}' | mcp-home credential add -
   ```
2. Get the credential ID from `mcp-home credential list`
3. Create a server:
   ```bash
   echo '{"slug":"firecrawl","name":"Firecrawl","kind":"remote","transport":{"type":"streamable-http","url":"https://mcp.firecrawl.dev/v2/mcp"},"credentialId":"<id>","enabled":true}' | mcp-home server add -
   ```
4. Verify: `mcp-home doctor`

### Authorize OAuth Upstream

```bash
mcp-home credential authorize cloudflare
```

This resolves the credential by name, opens the browser, and waits until authorization succeeds, fails, or times out (default 600s). For force re-authorization:

```bash
mcp-home credential authorize cloudflare --force
```

If OAuth fails with "Invalid client" or "Incompatible auth server", switch the registration method per-server:
- URL-based (default): works for most providers
- DCR: needed for Cloudflare, Notion, Linear (set `urlClientId: false` in server settings)

See `references/oauth-guide.md` for per-provider compatibility.

### Install from Market

```bash
mcp-home market list                                    # browse 24+ curated entries
mcp-home market install resend --set RESEND_API_KEY=re_xxx   # home-stdio (npm)
mcp-home market install context7 --set CONTEXT7_API_KEY=xxx  # remote (bearer)
mcp-home market install deepwiki                        # remote (no auth)
mcp-home market install fetch                           # uvx (Python, no config)
mcp-home market uninstall resend                        # remove
```

Market installs are async with progress: the CLI shows `npm install` steps, the web console shows a live log.

### Connect a Harness

Create an MCP Access Key:

```bash
mcp-home access-key create laptop
# Returns: mch_mcp_xxx (shown once, copy it)
```

Configure the harness (aggregate endpoint):

```json
{
  "url": "https://mcp.example.com/mcp",
  "headers": { "Authorization": "Bearer mch_mcp_xxx" }
}
```

Or per-server (independent endpoint, original tool names):

```json
{
  "url": "https://mcp.example.com/mcp/firecrawl",
  "headers": { "Authorization": "Bearer mch_mcp_xxx" }
}
```

Aggregate tool names are `{server_slug}.{tool_name}`. Per-server preserves original names.

### Diagnose Issues

```bash
mcp-home doctor              # check all servers
mcp-home server status <id>  # detailed runtime state + last error
mcp-home server logs <id>    # recent log entries
mcp-home events              # recent events with level filter
```

## Configuration

| Env | Description | Default |
|---|---|---|
| `MCP_HOME_PUBLIC_URL` | External HTTPS origin | required |
| `MCP_HOME_MASTER_KEY` | Secret encryption key (32+ chars) | required |
| `MCP_HOME_BOOTSTRAP_CONTROL_KEY` | First-boot Control Key | required on first boot |
| `MCP_HOST` / `MCP_HOME_PORT` | Listen address | `127.0.0.1:3344` |
| `MCP_HOME_DATA_DIR` | SQLite + market data | `/data` |
| `MCP_HOME_MARKET_DIR` | Market npm install dir | `<dataDir>/market` |
| `MCP_HOME_WEB_DIR` | Web console static files | disabled (set in Docker image) |
| `MCP_HOME_OAUTH_URL_CLIENT_ID` | Global OAuth client registration | `true` (URL-based) |
| `MCP_HOME_UV_INDEX_URL` | PyPI mirror for uvx Market installs | unset (pypi.org) |
| `MCP_HOME_CALLS_RETENTION_DAYS` | Tool call record retention in days (metadata only) | `30` |

## Deep Dives

For detailed information, read the reference files:

- `references/cli-reference.md` — Full CLI command reference with all flags
- `references/oauth-guide.md` — OAuth registration methods, per-provider compatibility, troubleshooting
- `references/market-guide.md` — Market catalog entries, installation details
- `references/deployment.md` — Docker Compose, CI/CD, reverse proxy, data persistence
- `references/troubleshooting.md` — Common issues and solutions
