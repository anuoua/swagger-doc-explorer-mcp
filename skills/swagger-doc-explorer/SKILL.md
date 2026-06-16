---
name: swagger-doc-explorer
description: |
  Explore and inspect OpenAPI/Swagger API documentation via a command-line tool.
  Use this when the user asks to browse API docs, inspect endpoints, view data models,
  search across schemas, or understand any OpenAPI/Swagger specification.
  Each command takes a spec source (URL or local file path) directly — no pre-loading needed.
---

# Swagger Doc Explorer

A CLI tool for exploring OpenAPI/Swagger specs. Each command takes a spec source — a URL or local file path — and loads it on the fly. No pre-loading, no state management.

## Setup

Requires Node.js 18+. Install globally for best performance (no npx overhead):

```bash
npm install -g swagger-doc-explorer-mcp
```

Then use `swagger-doc-explorer-mcp` directly:

```
swagger-doc-explorer-mcp <command> <source> [args...]
```

Alternatively, use via `npx` (no install, but slightly slower each first run):

```
npx swagger-doc-explorer-mcp <command> <source> [args...]
```

`<source>` is either a URL (`https://...`) or a local file path.

## Commands

| Command | Description |
|---------|-------------|
| `info <source>` | API overview: title, version, server, endpoint/schema/tag counts |
| `tags <source>` | List tag groups with endpoint counts |
| `paths <source> [--tag <t>] [--limit N] [--offset N]` | List endpoints, optionally filtered by tag, with pagination |
| `endpoint <source> <path> <method> [--full]` | Endpoint detail. `--full` resolves all `$ref` recursively |
| `schemas <source> [--limit N] [--offset N]` | List component schemas with pagination |
| `schema <source> <schema_name>` | Full schema detail with properties, types, constraints |
| `search <source> <query>` | Full-text search across endpoints, schemas, and properties |

## Workflow

Progressive exploration:

1. **Overview** — `info <source>` to understand the API
2. **Browse groups** — `tags <source>`, then `paths <source> --tag <group>` for endpoints
3. **Drill into endpoint** — `endpoint <source> <path> <method> --full` for complete detail with all schemas expanded
4. **Inspect models** — `schemas <source>` then `schema <source> <name>` for data definitions
5. **Search** — `search <source> <query>` for fuzzy search

## Best Practices

- Use `--full` on `endpoint` to get all `$ref` resolved in one call — no extra steps needed
- Use `--tag` + `--limit`/`--offset` for large APIs to keep output manageable
- Source auto-detects URL vs file; no flags needed

## Examples

```bash
# Global install (fastest):
swagger-doc-explorer-mcp info https://petstore.swagger.io/v2/swagger.json
swagger-doc-explorer-mcp endpoint ./spec.json /pets/{petId} get --full
swagger-doc-explorer-mcp paths ./local-spec.json --tag users --limit 10
swagger-doc-explorer-mcp search https://api.example.com/openapi.json "payment"

# Or via npx (no install needed):
npx swagger-doc-explorer-mcp info https://petstore.swagger.io/v2/swagger.json
```