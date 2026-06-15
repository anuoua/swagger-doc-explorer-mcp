import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isLoaded, searchSpec } from "../services/swagger-service.js";

export function registerSearchTools(server: McpServer) {
  server.registerTool(
    "swagger_search",
    {
      title: "Search API Spec",
      description: `Search across all endpoints and schemas in a loaded OpenAPI spec for a given query string.

Searches through endpoint paths, operation summaries, operationIds, descriptions, tags, schema names, and property names.

Args:
  - spec_name (string): Name of the previously loaded spec
  - query (string): Search term to find in endpoint paths, summaries, operationIds, tags, schema names, and property descriptions

Returns:
  {
    "total": number,             // Total number of matches
    "results": [
      {
        "type": "endpoint" | "schema" | "property",
        "path": string,          // URL path (for endpoints)
        "method": string,        // HTTP method (for endpoints)
        "schemaName": string,    // Schema name (for schemas/properties)
        "propertyName": string,  // Property name (for properties)
        "match": string,         // Human-readable match description
        "summary": string        // Brief description
      }
    ]
  }

Examples:
  - Use when: "Search for anything about pets" -> params with spec_name="<name>", query="pet"
  - Use when: "Find endpoints related to users" -> params with spec_name="<name>", query="user"

Error Handling:
  - Returns error if the spec name has not been loaded`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the previously loaded OpenAPI/Swagger spec (use swagger_list_loaded to see available names)"),
        query: z.string().min(1).max(200).describe("Search term to find in endpoint paths, summaries, operationIds, tags, schema names, and property descriptions"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        if (!isLoaded(params.spec_name)) {
          return { content: [{ type: "text", text: `Error: Spec '${params.spec_name}' has not been loaded yet. Use swagger_load_spec to load it first.` }] };
        }

        const results = searchSpec(params.spec_name, params.query);

        if (results.length === 0) {
          return {
            content: [{
              type: "text",
              text: `No results found for '${params.query}'. Try a different search term or browse the spec with swagger_list_paths and swagger_list_schemas.`,
            }],
          };
        }

        const endpoints = results.filter((r) => r.type === "endpoint");
        const schemas = results.filter((r) => r.type === "schema");
        const properties = results.filter((r) => r.type === "property");

        const lines = [
          `# Search Results for '${params.query}'`,
          "",
          `Found ${results.length} matches`,
          "",
        ];

        if (endpoints.length > 0) {
          lines.push(`## Endpoints (${endpoints.length})`);
          for (const ep of endpoints) {
            lines.push(`- **${ep.method?.toUpperCase()}** \`${ep.path}\` - ${ep.summary || ""}`);
          }
          lines.push("");
        }

        if (schemas.length > 0) {
          lines.push(`## Schemas (${schemas.length})`);
          for (const s of schemas) {
            lines.push(`- **${s.schemaName}** - ${s.summary || ""}`);
          }
          lines.push("");
        }

        if (properties.length > 0) {
          lines.push(`## Properties (${properties.length})`);
          for (const p of properties) {
            lines.push(`- \`${p.schemaName}.${p.propertyName}\` - ${p.summary || ""}`);
          }
          lines.push("");
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: { total: results.length, query: params.query, results },
        };
      } catch (error) {
        return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    }
  );
}