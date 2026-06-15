import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadSpec, loadSpecFromFile, isLoaded, getSpecKeys, getSpec, getEndpoints, getSchemas, getTags, getServerUrl, removeSpec } from "../services/swagger-service.js";

export function registerLoadSpecTools(server: McpServer) {
  server.registerTool(
    "swagger_load_spec",
    {
      title: "Load Swagger/OpenAPI Spec",
      description: `Load and parse an OpenAPI (Swagger) specification document from a URL.

This tool fetches a JSON OpenAPI/Swagger spec from the given URL and stores it in memory for subsequent exploration. You must load a spec before using any other tools.

Each loaded spec is assigned a unique name (title + version). If a spec with the same name already exists, a numeric suffix is appended.

Args:
  - url (string): URL to the OpenAPI/Swagger JSON spec (e.g., "https://petstore.swagger.io/v2/swagger.json")
  - auth_header (string, optional): Authorization header value for protected specs (e.g., "Bearer token123" or "Basic base64encoded"). Only needed for authenticated endpoints.

Returns:
  {
    "spec_name": string,      // The assigned spec name for subsequent tools
    "title": string,          // API title from the spec
    "version": string,        // API version from the spec
    "description": string,    // API description (if available)
    "endpoints": number,      // Total number of API endpoints found
    "schemas": number,        // Total number of schemas/components found
    "tags": number,           // Total number of unique tags found
    "server_url": string      // Base server URL from the spec
  }

Examples:
  - Use when: "Load the Petstore API spec" -> params with url="https://petstore.swagger.io/v2/swagger.json"
  - Use when: "Load our internal API docs" -> params with url="https://api.internal.company.com/openapi.json"

Error Handling:
  - Returns error if URL is unreachable or times out
  - Returns error if the document is not valid OpenAPI/Swagger JSON
  - Returns error if YAML format is provided (only JSON is supported)`,
      inputSchema: z.object({
        url: z.string().url().describe("URL to the OpenAPI/Swagger JSON spec (e.g., 'https://petstore.swagger.io/v2/swagger.json')"),
        auth_header: z.string().optional().describe("Authorization header value for protected specs (e.g., 'Bearer eyJhbGci...' or 'Basic base64string'). Only needed if the spec requires authentication."),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const store = await loadSpec(params.url, params.auth_header);
        const endpoints = getEndpoints(store.name);
        const schemas = getSchemas(store.name);
        const tags = getTags(store.name);
        const serverUrl = getServerUrl(store.name);

        const output = {
          spec_name: store.name,
          title: store.spec.info.title,
          version: store.spec.info.version,
          description: store.spec.info.description || "",
          endpoints: endpoints.length,
          schemas: schemas.length,
          tags: tags.length,
          server_url: serverUrl,
        };

        return {
          content: [{
            type: "text",
            text: [
              `# ${output.title} v${output.version}`,
              "",
              output.description,
              "",
              "## Summary",
              `- **Spec Name**: \`${output.spec_name}\``,
              `- **Endpoints**: ${output.endpoints} paths`,
              `- **Schemas**: ${output.schemas} component schemas`,
              `- **Tags**: ${output.tags} groups`,
              `- **Server**: \`${output.server_url || "Not specified"}\``,
            ].join("\n"),
          }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        };
      }
    }
  );

  server.registerTool(
    "swagger_load_local_spec",
    {
      title: "Load Local Swagger/OpenAPI Spec File",
      description: `Load and parse an OpenAPI (Swagger) specification document from a local JSON file.

This tool reads a JSON OpenAPI/Swagger spec from a local file path and stores it in memory for subsequent exploration. The file path can be absolute or relative to the current working directory.

Each loaded spec is assigned a unique name (title + version). If a spec with the same name already exists, a numeric suffix is appended.

Args:
  - file_path (string): Path to a local OpenAPI/Swagger JSON file (e.g., "./swagger.doc.json" or "/path/to/api-spec.json")

Returns:
  {
    "spec_name": string,      // The assigned spec name for subsequent tools
    "title": string,          // API title from the spec
    "version": string,        // API version from the spec
    "description": string,    // API description (if available)
    "endpoints": number,      // Total number of API endpoints found
    "schemas": number,        // Total number of schemas/components found
    "tags": number,           // Total number of unique tags found
    "server_url": string      // Base server URL from the spec
  }

Examples:
  - Use when: "Load the local swagger.doc.json" -> params with file_path="./swagger.doc.json"
  - Use when: "Load our API spec from disk" -> params with file_path="/home/user/projects/api/openapi.json"

Error Handling:
  - Returns error if the file path does not exist
  - Returns error if the file is not valid JSON
  - Returns error if the JSON is not a valid OpenAPI/Swagger spec`,
      inputSchema: z.object({
        file_path: z.string().min(1).describe("Path to a local OpenAPI/Swagger JSON file (e.g., './swagger.doc.json' or '/absolute/path/to/spec.json')"),
      }).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        const store = await loadSpecFromFile(params.file_path);
        const endpoints = getEndpoints(store.name);
        const schemas = getSchemas(store.name);
        const tags = getTags(store.name);
        const serverUrl = getServerUrl(store.name);

        const output = {
          spec_name: store.name,
          title: store.spec.info.title,
          version: store.spec.info.version,
          description: store.spec.info.description || "",
          endpoints: endpoints.length,
          schemas: schemas.length,
          tags: tags.length,
          server_url: serverUrl,
        };

        return {
          content: [{
            type: "text",
            text: [
              `# ${output.title} v${output.version}`,
              "",
              output.description,
              "",
              "## Summary",
              `- **Spec Name**: \`${output.spec_name}\``,
              `- **Source**: \`${store.source}\``,
              `- **Endpoints**: ${output.endpoints} paths`,
              `- **Schemas**: ${output.schemas} component schemas`,
              `- **Tags**: ${output.tags} groups`,
              `- **Server**: \`${output.server_url || "Not specified"}\``,
            ].join("\n"),
          }],
          structuredContent: output,
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        };
      }
    }
  );

  server.registerTool(
    "swagger_list_loaded",
    {
      title: "List Loaded Specs",
      description: `List all currently loaded OpenAPI/Swagger specifications in memory.

Use this tool to see which specs have been loaded and are available for exploration.

Args: None

Returns:
  {
    "loaded": [              // Array of loaded specs
      { "name": string, "title": string, "version": string, "source": string, "loaded_at": string }
    ]
  }

Examples:
  - Use when: "What specs have I loaded?" -> no params needed
  - Use when: "Show my loaded APIs" -> no params needed`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      try {
        const names = getSpecKeys();
        const specs = names.map((name) => {
          const store = getSpec(name);
          return {
            name,
            title: store?.spec.info.title || "Unknown",
            version: store?.spec.info.version || "?",
            source: store?.source || "?",
            loaded_at: store?.loadedAt || "?",
          };
        });

        if (specs.length === 0) {
          return {
            content: [{ type: "text", text: "No specs loaded. Use `swagger_load_spec` to load an OpenAPI/Swagger spec." }],
          };
        }

        const lines = [
          "# Loaded Specifications",
          "",
          "| # | Name | Title | Version | Source |",
          "|---|------|-------|---------|--------|",
        ];
        for (let i = 0; i < specs.length; i++) {
          lines.push(`| ${i + 1} | \`${specs[i].name}\` | ${specs[i].title} | ${specs[i].version} | \`${specs[i].source}\` |`);
        }

        return {
          content: [{ type: "text", text: lines.join("\n") }],
          structuredContent: { loaded: specs },
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        };
      }
    }
  );

  server.registerTool(
    "swagger_remove_spec",
    {
      title: "Remove Loaded Spec",
      description: `Remove a loaded OpenAPI/Swagger specification from memory.

Use this tool to free up memory or reload a spec that has changed.

Args:
  - spec_name (string): Name of the spec to remove

Returns:
  Confirmation message.

Examples:
  - Use when: "Remove the Petstore API spec" -> params with spec_name="Petstore v1.0.0"
  - Use when: "Unload the internal API spec" -> params with spec_name="Internal API v2.0"

Error Handling:
  - Returns error if the spec name is not found`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the spec to remove (use swagger_list_loaded to see available names)"),
      }).strict(),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    async (params) => {
      try {
        if (!isLoaded(params.spec_name)) {
          return { content: [{ type: "text", text: `Error: Spec '${params.spec_name}' not found. Use swagger_list_loaded to see available specs.` }] };
        }

        removeSpec(params.spec_name);
        return {
          content: [{ type: "text", text: `Removed spec: \`${params.spec_name}\`` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        };
      }
    }
  );
}