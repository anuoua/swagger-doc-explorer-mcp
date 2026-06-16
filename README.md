# Swagger Doc Explorer

CLI tool for progressive exploration of OpenAPI/Swagger API documentation. Load a spec from URL or local file and inspect endpoints, schemas, tags — all in one command, no state, no server.

## Quick Start

```bash
# Run from source (no install):
node src/main.ts info https://petstore.swagger.io/v2/swagger.json

# Or install globally:
npm install -g swagger-doc-explorer-mcp
swagger-doc-explorer-mcp endpoint ./spec.json /pets/{petId} get --full

# Or npx (no install):
npx swagger-doc-explorer-mcp endpoint ./spec.json /pets/{petId} get --full
```

## Commands

| Command | Description |
|---------|-------------|
| `info <source>` | API overview: title, version, endpoint/schema/tag counts |
| `tags <source>` | List tag groups with endpoint counts |
| `paths <source> [--tag <t>] [--limit N] [--offset N]` | List endpoints, filtered by tag, with pagination |
| `endpoint <source> <path> <method> [--full]` | Endpoint detail. `--full` resolves all `$ref` |
| `schemas <source> [--limit N] [--offset N]` | List component schemas with pagination |
| `schema <source> <schema_name>` | Schema detail with properties, types, constraints |
| `search <source> <query>` | Full-text search across endpoints, schemas, properties |

`<source>` is a URL (`https://...`) or local file path — auto-detected.

## Progressive Exploration Workflow

```
1. info <source>               → overview of the API
2. tags <source>                → see available groups
3. paths <source> --tag users   → browse endpoints in a group
4. endpoint <source> <path> <method> --full  → drill into endpoint
5. schemas <source>             → see available data models
6. schema <source> <name>       → inspect a model
7. search <source> <query>      → find anything across the spec
```

## Examples

```bash
# Global install (fastest):
swagger-doc-explorer-mcp info https://petstore.swagger.io/v2/swagger.json
swagger-doc-explorer-mcp tags ./spec.json
swagger-doc-explorer-mcp paths ./spec.json --tag pets --limit 10
swagger-doc-explorer-mcp endpoint ./test/opencode-swaggerdoc.json /global/health get --full
swagger-doc-explorer-mcp schemas ./spec.json --limit 5
swagger-doc-explorer-mcp schema ./spec.json Config
swagger-doc-explorer-mcp search ./spec.json "payment"

# Or via npx (no install):
npx swagger-doc-explorer-mcp info https://petstore.swagger.io/v2/swagger.json
```

## Installation

```bash
npm install -g swagger-doc-explorer-mcp
```

Then use `swagger-doc-explorer-mcp` directly (no `npx` needed).

## Development

Requires Node.js 24+ (native TypeScript). No build step needed.

```bash
pnpm install
pnpm test            # 79+ tests with node:test
pnpm run preview     # node src/main.ts <args>
pnpm run start       # same
```

The source is TypeScript at `src/`, organized by module:

```
src/
├── main.ts                  # Entry point
├── types.ts                 # Shared types
├── cli/args.ts              # Argument parsing
├── cli/dispatch.ts          # Command routing
├── commands/                # One file per command
├── core/loader.ts           # Spec loading (URL/file)
├── core/queries.ts          # Query functions
├── core/resolve.ts          # $ref resolution
└── formatters/              # Schema & endpoint formatting
```

## Skill

The `skills/swagger-doc-explorer/SKILL.md` is an opencode skill. Install it by symlinking or copying to `~/.config/opencode/skills/swagger-doc-explorer/`. The skill uses `npx swagger-doc-explorer-mcp` — no local repo needed.

## Publish

```bash
pnpm test
npm publish
```

No build step — Node.js 24+ runs the TypeScript source natively.

## Compatibility

- OpenAPI v3.x, Swagger v2
- JSON format only (YAML not supported)
- Remote URLs and local file paths
- Node.js 24+ (native TypeScript support required)

## License

MIT