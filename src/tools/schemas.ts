import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isLoaded, getSchemas, getSchemaDetail, getSpec } from "../services/swagger-service.js";
import { formatSchema } from "../formatters.js";

export function registerSchemasTools(server: McpServer) {
  server.registerTool(
    "swagger_list_schemas",
    {
      title: "List Component Schemas",
      description: `List all component schemas (data models) defined in the loaded OpenAPI spec.

Use this tool to get an overview of all data models used by the API, including their types and number of properties.

Args:
  - spec_name (string): Name of the previously loaded spec
  - limit (number): Maximum results to return (default: 50)
  - offset (number): Number of results to skip (default: 0)

Returns:
  {
    "total": number,             // Total number of schemas
    "count": number,             // Number of results in this response
    "offset": number,            // Current pagination offset
    "schemas": [{ "name", "type", "description", "properties" }],
    "has_more": boolean,
    "next_offset": number
  }

Examples:
  - Use when: "What data models are defined?" -> params with spec_name="<name>"
  - Use when: "Show me all schemas" -> params with spec_name="<name>"

Error Handling:
  - Returns error if the spec name has not been loaded yet`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the previously loaded OpenAPI/Swagger spec (use swagger_list_loaded to see available names)"),
        limit: z.number().int().min(1).max(200).default(50).describe("Maximum results to return (default: 50)"),
        offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination (default: 0)"),
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

        const allSchemas = getSchemas(params.spec_name);
        const total = allSchemas.length;
        const paginated = allSchemas.slice(params.offset, params.offset + params.limit);

        if (paginated.length === 0) {
          const msg = total === 0 ? "No schemas defined in this spec." : `No more schemas to show (offset ${params.offset} of ${total}).`;
          return { content: [{ type: "text", text: msg }] };
        }

        const hasMore = total > params.offset + paginated.length;
        const store = getSpec(params.spec_name);

        const output = {
          total, count: paginated.length, offset: params.offset,
          schemas: paginated, has_more: hasMore,
          ...(hasMore ? { next_offset: params.offset + paginated.length } : {}),
        };

        const lines = [
          `# ${store?.spec.info.title || "API"} - Component Schemas`,
          "",
          `**${total} total schemas** (showing ${paginated.length})`,
          "",
          "| Name | Type | Properties | Description |",
          "|------|------|------------|-------------|",
        ];
        for (const schema of paginated) {
          lines.push(`| \`${schema.name}\` | ${schema.type || "object"} | ${schema.properties} | ${(schema.description || "").slice(0, 80)} |`);
        }
        if (hasMore) {
          lines.push(`\n> Showing ${paginated.length} of ${total} schemas. Use offset=${params.offset + paginated.length} to see more.`);
        }
        lines.push("\nUse `swagger_get_schema` to see full details of a specific schema.");

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    }
  );

  server.registerTool(
    "swagger_get_schema",
    {
      title: "Get Schema Details",
      description: `Get detailed information about a specific component schema (data model), including all properties, types, constraints, and examples.

Use this tool to drill down into a specific data model after using swagger_list_schemas.

Args:
  - spec_name (string): Name of the previously loaded spec
  - schema_name (string): Name of the schema/model (e.g., "Pet", "User", "Order", "Error")

Returns:
  Formatted output with the full schema definition including type, properties, required fields, enums, constraints, and examples.

Examples:
  - Use when: "Show me the Pet model" -> params with spec_name="<name>", schema_name="Pet"
  - Use when: "What fields does the User schema have?" -> params with spec_name="<name>", schema_name="User"

Error Handling:
  - Returns error if the spec name has not been loaded
  - Returns error if the schema name is not found, suggesting available schemas`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the previously loaded OpenAPI/Swagger spec (use swagger_list_loaded to see available names)"),
        schema_name: z.string().min(1).describe("Name of the schema/model (e.g., 'Pet', 'User', 'Order', 'Error'). Case-sensitive."),
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

        const schema = getSchemaDetail(params.spec_name, params.schema_name);
        if (!schema) {
          const allSchemas = getSchemas(params.spec_name);
          const suggestions = allSchemas.slice(0, 10).map((s) => s.name);
          return {
            content: [{
              type: "text",
              text: `Error: Schema '${params.schema_name}' not found.\n\nAvailable schemas:\n${suggestions.map((name) => `  - ${name}`).join("\n")}${allSchemas.length > 10 ? "\n  ... and more" : ""}`,
            }],
          };
        }

        return {
          content: [{ type: "text", text: [`# Schema: ${params.schema_name}`, "", "```", formatSchema(schema), "```"].join("\n") }],
          structuredContent: schema,
        };
      } catch (error) {
        return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    }
  );
}