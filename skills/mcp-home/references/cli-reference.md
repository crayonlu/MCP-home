# CLI Reference

## auth

```bash
mcp-home auth login --url https://mcp.example.com --control-key "$KEY"
mcp-home auth logout
```

Credentials saved to `~/.config/mcp-home/config.json` (0600). Supports env vars `MCP_HOME_URL` and `MCP_HOME_CONTROL_KEY`.

## server

```bash
mcp-home server list                          # list all servers
mcp-home server get <id>                      # get a server by id
mcp-home server add <file|-                   # add from JSON file or stdin
mcp-home server update <id> <file|->          # update fields (partial)
mcp-home server delete <id>                   # delete a server
mcp-home server enable <id>                   # enable
mcp-home server disable <id>                  # disable
mcp-home server refresh <id>                  # force reconnect + snapshot
mcp-home server restart <id>                  # restart home-hosted stdio
mcp-home server test <id>                     # test connectivity
mcp-home server capabilities <id>             # show capability snapshot
mcp-home server status <id>                   # runtime status + last error
mcp-home server logs <id>                     # recent log entries
mcp-home server endpoint <id>                 # per-server endpoint URL
```

Server JSON (create):
```json
{
  "slug": "firecrawl",
  "name": "Firecrawl",
  "kind": "remote",
  "transport": { "type": "streamable-http", "url": "https://mcp.firecrawl.dev/v2/mcp" },
  "credentialId": "<uuid>",
  "enabled": true,
  "settings": { "urlClientId": false }
}
```

Home-hosted stdio:
```json
{
  "slug": "resend",
  "name": "Resend",
  "kind": "home",
  "transport": { "type": "stdio", "command": "/data/market/node_modules/.bin/resend-mcp", "args": [] },
  "credentialId": "<uuid>",
  "enabled": true
}
```

## credential

```bash
mcp-home credential list                     # list all credentials
mcp-home credential get <id>                 # get a credential
mcp-home credential add <file|->             # add from JSON
mcp-home credential update <id> <file|->     # update
mcp-home credential delete <id>              # delete
mcp-home credential test <id>                # validate + refresh
mcp-home credential revoke <id>              # revoke OAuth tokens
mcp-home credential authorize <name>         # start OAuth flow (by name or id)
```

Authorize options:
```
--server <slug>    specify the server (auto-resolved if omitted)
--force            clear old client + re-authorize
--no-open          don't open browser
--no-wait          print URL and exit
--timeout <sec>    wait time (default 600)
```

Credential JSON (create):
```json
{ "name": "firecrawl", "payload": { "type": "bearer", "token": "fc-xxx" } }
{ "name": "apifox", "payload": { "type": "headers", "headers": { "Authorization": "Bearer xxx", "X-Apifox-Api-Version": "2025-09-01" } } }
{ "name": "cloudflare", "payload": { "type": "oauth" } }
{ "name": "resend", "payload": { "type": "env", "variables": { "RESEND_API_KEY": "re_xxx" } } }
```

## access-key

```bash
mcp-home access-key create <name>             # returns secret once
mcp-home access-key list
mcp-home access-key revoke <id>
```

## control-key

```bash
mcp-home control-key create <name>            # returns secret once
mcp-home control-key list
mcp-home control-key revoke <id>
```

## market

```bash
mcp-home market list                          # browse catalog with install status
mcp-home market install <id> --set KEY=value  # install (repeatable --set)
mcp-home market uninstall <id>                # remove server + credential
```

## config

```bash
mcp-home config export <file>                 # redacted export
mcp-home config export <file> --include-secrets  # full backup (0600)
mcp-home config import <file>                 # restore (atomic transaction)
```

## endpoint

```bash
mcp-home endpoint aggregate                   # aggregate /mcp URL
mcp-home endpoint server <id>                 # per-server /mcp/{slug} URL
```

## diagnostics

```bash
mcp-home status                               # overview (servers, credentials, keys, endpoints)
mcp-home doctor                               # health check per server
mcp-home events                               # recent events
mcp-home events --level error                 # filter by level
```

## api (raw)

```bash
mcp-home api GET /api/v1/openapi.json
mcp-home api POST /api/v1/servers -d '{"slug":"test",...}'
```

## global options

```
--url <url>           control API URL (or MCP_HOME_URL env)
--control-key <key>   control key (or MCP_HOME_CONTROL_KEY env)
--output <human|json> output format (default human)
```
