# Swagger Doc Explorer MCP

MCP server for progressive exploration of Swagger/OpenAPI documentation. Supports **stdio** (local) and **HTTP** (remote) transports.

Each loaded spec is identified by a unique name (`{title} v{version}`) assigned at load time. All downstream tools reference the spec by name, so you can load and inspect multiple specs simultaneously.

## Tools

| Tool | Description |
|------|-------------|
| `swagger_load_spec` | Load spec from a remote URL. `url` (required), `auth_header` (optional). Returns the assigned `spec_name` |
| `swagger_load_local_spec` | Load spec from a local JSON file. `file_path` (required). Returns the assigned `spec_name` |
| `swagger_list_loaded` | List all specs currently loaded (name, title, version, source) |
| `swagger_remove_spec` | Remove a loaded spec from memory. `spec_name` (required) |
| `swagger_get_info` | Get API title, version, description, server URL. `spec_name` (required) |
| `swagger_list_tags` | List all tags/groups with endpoint counts. `spec_name` (required) |
| `swagger_list_paths` | List endpoints, optionally filtered by `tag`. Supports `limit` (default 50) and `offset` pagination. `spec_name` (required) |
| `swagger_get_endpoint` | Drill into a specific endpoint: `path`, `method`. `spec_name` (required) |
| `swagger_get_endpoint_full` | Drill into endpoint with all `$ref` recursively resolved. Single-call completeness |
| `swagger_list_schemas` | List all data models/schemas. Supports `limit` and `offset`. `spec_name` (required) |
| `swagger_get_schema` | Get full details of a specific schema: `schema_name`. `spec_name` (required) |
| `swagger_search` | Full-text search across endpoints and schemas: `query`. `spec_name` (required) |

## Installation

```bash
npm install -g swagger-doc-explorer-mcp
```

Or use directly with `npx` (no install needed):

```bash
npx -y swagger-doc-explorer-mcp
```

## Usage

### stdio (default)

```bash
npx -y swagger-doc-explorer-mcp
```

### HTTP

```bash
SWAGGER_HTTP_PORT=3000 npx -y swagger-doc-explorer-mcp
```

The HTTP server accepts POST requests at `/` following the [MCP Streamable HTTP](https://spec.modelcontextprotocol.io) protocol. Clients must include `Accept: application/json, text/event-stream` and use the `mcp-session-id` header for session affinity:

```bash
# Initialize session
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"my-client","version":"1.0"}}}'

# Copy the mcp-session-id from response headers, then:
curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}'

curl -X POST http://localhost:3000/ \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: <session-id>" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"swagger_load_spec","arguments":{"url":"https://petstore.swagger.io/v2/swagger.json"}}}'
```

### Development

```bash
npm run dev          # stdio mode with hot reload
npm run dev:http     # HTTP mode on port 3000 with hot reload
```

### MCP client configuration

Use `npx` so the client auto-installs the package:

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "swagger-doc-explorer": {
      "command": "npx",
      "args": ["-y", "swagger-doc-explorer-mcp"]
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "swagger-doc-explorer": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "swagger-doc-explorer-mcp"]
    }
  }
}
```

If installed globally, use `swagger-doc-explorer-mcp` directly as the command.

**opencode** (`~/.config/opencode/opencode.json`):

```json
{
  "mcp": {
    "swagger-doc-explorer": {
      "type": "local",
      "command": ["npx", "-y", "swagger-doc-explorer-mcp"],
      "enabled": true
    }
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SWAGGER_HTTP_PORT` | Set to enable HTTP mode (e.g. `3000`). Omit for stdio mode |

## Progressive Exploration Workflow

```
1. swagger_load_spec / swagger_load_local_spec  → load the API spec (returns spec_name)
2. swagger_get_info(spec_name="...")             → overview of the API
3. swagger_list_tags(spec_name="...")            → see available groups
4. swagger_list_paths(spec_name="...", tag="users") → browse endpoints in a group
5. swagger_get_endpoint(spec_name="...", path, method) → drill into endpoint details
6. swagger_list_schemas(spec_name="...")         → see available data models
7. swagger_get_schema(spec_name="...", schema_name) → inspect a model
8. swagger_search(spec_name="...", query)        → find anything across the spec
```

Multiple specs can be loaded and queried simultaneously — each identified by its unique `spec_name`.

## Compatibility

- OpenAPI v3.x (`openapi` field)
- Swagger v2 (`swagger` field)
- JSON format only (YAML is not supported)
- Remote URLs and local file paths

## Build & Test

```bash
npm run build
npm test
```