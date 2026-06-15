import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isLoaded, getSpec, getEndpoints, getSchemas, getTags, getServerUrl } from "../services/swagger-service.js";

export function registerInfoTools(server: McpServer) {
  server.registerTool(
    "swagger_get_info",
    {
      title: "Get API Info",
      description: `Get general information about a loaded OpenAPI/Swagger specification, including title, version, description, server URL, contact info, and license.

Use this tool to get a high-level summary of an API spec.

Args:
  - spec_name (string): Name of the previously loaded spec (use swagger_list_loaded to see available names)

Returns:
  {
    "title": string,           // API title
    "version": string,         // API version
    "description": string,     // API description
    "server_url": string,      // Base server URL
    "endpoints": number,       // Total endpoint count
    "schemas": number,         // Total schema count
    "tags": number,            // Total tag count
    "openapi_version": string  // OpenAPI spec version
  }

Examples:
  - Use when: "Tell me about this API" -> params with spec_name="<name>"
  - Use when: "What's the base URL for this API?" -> params with spec_name="<name>"

Error Handling:
  - Returns error if the spec name has not been loaded`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the previously loaded OpenAPI/Swagger spec (use swagger_list_loaded to see available names)"),
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

        const store = getSpec(params.spec_name);
        if (!store) return { content: [{ type: "text", text: "Error: Spec data not found in memory." }] };

        const spec = store.spec;
        const endpoints = getEndpoints(params.spec_name);
        const schemas = getSchemas(params.spec_name);
        const tags = getTags(params.spec_name);
        const serverUrl = getServerUrl(params.spec_name);
        const specVersion = spec.openapi || spec.swagger || "unknown";

        const output = {
          title: spec.info.title, version: spec.info.version,
          description: spec.info.description || "", server_url: serverUrl,
          endpoints: endpoints.length, schemas: schemas.length, tags: tags.length,
          openapi_version: specVersion,
          contact: (spec.info as Record<string, unknown>).contact || null,
          license: (spec.info as Record<string, unknown>).license || null,
        };

        const lines = [
          `# ${spec.info.title}`,
          "",
          `**Version**: ${spec.info.version}`,
          `**OpenAPI Version**: ${specVersion}`,
          `**Server**: \`${serverUrl || "Not specified"}\``,
          "",
          spec.info.description || "",
          "",
          "## Summary",
          `- **Endpoints**: ${endpoints.length}`,
          `- **Schemas**: ${schemas.length}`,
          `- **Tags**: ${tags.length}`,
        ];

        const contact = (spec.info as Record<string, unknown>).contact as Record<string, string> | undefined;
        if (contact) {
          lines.push("", "## Contact");
          if (contact.name) lines.push(`- **Name**: ${contact.name}`);
          if (contact.email) lines.push(`- **Email**: ${contact.email}`);
          if (contact.url) lines.push(`- **URL**: ${contact.url}`);
        }

        const license = (spec.info as Record<string, unknown>).license as Record<string, string> | undefined;
        if (license) {
          lines.push("", "## License");
          lines.push(`- **Name**: ${license.name}`);
          if (license.url) lines.push(`- **URL**: ${license.url}`);
        }

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
    "swagger_list_tags",
    {
      title: "List API Tags",
      description: `List all API tags/groups and their associated endpoint counts from a loaded OpenAPI spec.

Tags are used to group related endpoints. This tool helps with progressive exploration by showing available filter categories.

Args:
  - spec_name (string): Name of the previously loaded spec

Returns:
  {
    "tags": [{ "name": string, "count": number }]
  }

Examples:
  - Use when: "What tags/groups are available?" -> params with spec_name="<name>"
  - Use when: "How are the endpoints organized?" -> params with spec_name="<name>"

Error Handling:
  - Returns error if the spec name has not been loaded`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the previously loaded OpenAPI/Swagger spec (use swagger_list_loaded to see available names)"),
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

        const tags = getTags(params.spec_name);
        const store = getSpec(params.spec_name);

        if (tags.length === 0) {
          return { content: [{ type: "text", text: "No tags found in this spec. Endpoints may be untagged." }] };
        }

        const lines = [
          `# ${store?.spec.info.title || "API"} - Tags`,
          "",
          "| Tag | Endpoints |",
          "|-----|-----------|",
        ];
        for (const tag of tags) {
          lines.push(`| \`${tag.name}\` | ${tag.count} |`);
        }
        lines.push("", "Use `swagger_list_paths` with a `tag` parameter to filter by group.");

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: { tags },
        };
      } catch (error) {
        return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    }
  );
}