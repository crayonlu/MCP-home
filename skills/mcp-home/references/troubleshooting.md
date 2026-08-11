# Troubleshooting

## Server Status Shows "Unknown"

**Cause**: The `/api/v1/servers` endpoint wasn't returning runtime state (fixed in recent versions).

**Fix**: Update to the latest image. Verify:
```bash
mcp-home server list --output json | jq '.[0].runtime.status'
```
If `runtime` is missing, the server is running an old version. Pull the latest image.

## OAuth "Invalid client"

**Cause**: The upstream rejected the URL-based client metadata.

**Fix**: Switch to DCR for that server:
```bash
mcp-home api PATCH /api/v1/servers/<id> -d '{"settings":{"urlClientId":false}}'
mcp-home credential authorize <name> --force
```

See `oauth-guide.md` for per-provider compatibility.

## OAuth "Incompatible auth server: does not support dynamic client registration"

**Cause**: The upstream has no `registration_endpoint` and DCR was forced.

**Fix**: Switch to URL-based (the default):
```bash
mcp-home api PATCH /api/v1/servers/<id> -d '{"settings":{"urlClientId":true}}'
mcp-home credential authorize <name> --force
```

## OAuth "invalid_redirect_uri"

**Cause**: The upstream only approves specific redirect URIs (e.g., Vercel only allows `http://localhost:<port>/callback`).

**Fix**: This provider is incompatible with a remote gateway. Use a PAT (Personal Access Token) as a bearer credential, or keep the MCP configured locally in the harness.

## npm Install Corruption (home-stdio)

**Symptom**: Home-hosted stdio server shows "unreachable" with module resolution errors (e.g., `Cannot find module '.../dist/index.js'`).

**Cause**: npm cache corruption on the server. The tarball was partially extracted.

**Fix**: Wipe the market directory and reinstall:
```bash
docker exec mcp-home rm -rf /data/market/node_modules /data/market/package-lock.json
mcp-home market install <id> --set KEY=value
```

## Fetch Server Won't Start (package name squatting)

**Symptom**: Installing `fetch` from Market produces a server that never reaches "ready", or the installed package description mentions "security research canary".

**Cause**: The npm name `mcp-server-fetch` is **squatted** — the official Fetch server is Python (PyPI `mcp-server-fetch`). The npm package is a canary that runs code in a `postinstall` script.

**Fix**: Ensure the catalog entry uses `kind: "uvx"` (installs via `uv tool install`, runs via `uvx`). Remove any npm-installed copy:
```bash
docker exec mcp-home rm -rf /data/market/node_modules/mcp-server-fetch /data/market/node_modules/.bin/mcp-server-fetch
mcp-home server delete <fetch-server-id>
mcp-home market install fetch
```

## Fetch Server "Unreachable" with `ImportError: McpError`

**Symptom**: The uvx-installed fetch server shows unreachable with `ImportError: cannot import name 'McpError' from 'mcp.shared.exceptions'`.

**Cause**: `mcp-server-fetch` (2026.7.10) still imports the pre-2.0 `McpError` name; uv resolves the latest `mcp==2.0` which renamed it to `MCPError`. This is an upstream compatibility break.

**Fix**: Reinstall with the pinned dependency (the catalog already ships `uvWith: ['mcp<2']`):
```bash
mcp-home market uninstall fetch
mcp-home market install fetch
```
If upgrading an existing broken install without the pin, fix the tool env directly:
```bash
docker exec mcp-home sh -c 'uv tool install mcp-server-fetch --with "mcp<2"'
mcp-home server restart fetch
```

## Cloudflare Proxy SSE Delay (~25s per request)

**Symptom**: Every MCP request (initialize, tools/list, tools/call) takes ~25s through Cloudflare, but works fine direct.

**Cause**: Cloudflare buffers SSE POST responses.

**Fix**: Set the DNS record for the MCP Home subdomain to "DNS only" (grey cloud), bypassing Cloudflare's proxy. The origin server has a valid TLS certificate (Let's Encrypt via the reverse proxy).

## Credential Shows "Expired"

**Cause**: OAuth access tokens expire (typically 1 hour). MCP Home refreshes lazily.

**Fix**: The web console auto-refreshes expired OAuth credentials on page load. Manually:
```bash
mcp-home credential test <id>
mcp-home server refresh <server-id>
```

## Upstream "unreachable" Intermittently

**Cause**: Network flakiness between the MCP Home server and the upstream (common for overseas providers from China-based servers).

**Fix**: MCP Home auto-reconnects. Check `mcp-home doctor` periodically. For persistent issues, consider relocating the MCP Home server closer to the upstreams, or using a proxy.

## Delete Access Key Returns 404

**Cause**: The key was already revoked. The list endpoint only shows active keys (fixed in recent versions).

**Fix**: This is expected behavior. Revoked keys are gone from the list. No action needed.

## Docker Build Fails (OOM)

**Cause**: The server has limited RAM (<2GB). In-container `npm ci` + `vite build` + `tsc` thrashes memory.

**Fix**: Use the prebuilt GHCR image (`ghcr.io/crayonlu/mcp-home:latest`) instead of building locally. The CI pipeline builds on GitHub runners (ample RAM) and pushes the image.

## CLI "command.opts is not a function"

**Cause**: Commander action handler parameter ordering bug (fixed in recent versions).

**Fix**: Update to the latest version: `npm install -g mcp-home@latest`.
