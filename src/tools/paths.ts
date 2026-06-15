import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { HttpMethod } from "../types.js";
import { CHARACTER_LIMIT } from "../constants.js";
import { isLoaded, getEndpoints, getEndpointDetail, getPathParameterNames, getSpec, getTags } from "../services/swagger-service.js";
import { formatEndpointDetail } from "../formatters.js";

export function registerPathsTools(server: McpServer) {
  server.registerTool(
    "swagger_list_paths",
    {
      title: "List API Endpoints",
      description: `List all API endpoints (paths and HTTP methods) from a loaded OpenAPI spec, optionally filtered by tag.

Use this tool to get a high-level overview of all available API operations. Results can be filtered by tag for progressive exploration.

Args:
  - spec_name (string): Name of the previously loaded spec
  - tag (string, optional): Filter endpoints by this tag/group name
  - limit (number): Maximum results to return, between 1-200 (default: 50)
  - offset (number): Number of results to skip for pagination (default: 0)

Returns:
  {
    "total": number,                 // Total number of matching endpoints
    "count": number,                 // Number of results in this response
    "offset": number,                // Current pagination offset
    "endpoints": [...],
    "has_more": boolean,
    "next_offset": number
  }

Examples:
  - Use when: "Show me all endpoints" -> params with spec_name="<name>"
  - Use when: "List all user-related endpoints" -> params with spec_name="<name>", tag="users"

Error Handling:
  - Returns error if the spec name has not been loaded yet`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the previously loaded OpenAPI/Swagger spec (use swagger_list_loaded to see available names)"),
        tag: z.string().optional().describe("Filter endpoints by tag/group name (e.g., 'users', 'pets', 'store'). Use swagger_list_tags to see available tags."),
        limit: z.number().int().min(1).max(200).default(50).describe("Maximum results to return (default: 50, max: 200)"),
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

        const allEndpoints = getEndpoints(params.spec_name, params.tag);
        const total = allEndpoints.length;
        const paginated = allEndpoints.slice(params.offset, params.offset + params.limit);

        if (paginated.length === 0) {
          return {
            content: [{
              type: "text",
              text: total === 0
                ? `No endpoints found${params.tag ? ` for tag '${params.tag}'` : ""} in the spec.`
                : `No more endpoints to show (showing ${params.offset} of ${total}).`,
            }],
          };
        }

        const hasMore = total > params.offset + paginated.length;
        const tags = getTags(params.spec_name);
        const store = getSpec(params.spec_name);

        const output = {
          total,
          count: paginated.length,
          offset: params.offset,
          endpoints: paginated,
          has_more: hasMore,
          ...(hasMore ? { next_offset: params.offset + paginated.length } : {}),
        };

        const lines: string[] = [];
        lines.push(`# ${store?.spec.info.title || "API"} - Endpoints`);
        if (params.tag) {
          lines.push(`\nFiltered by tag: \`${params.tag}\``);
        }
        lines.push(`\n**${total} total endpoints** (showing ${paginated.length})`);
        lines.push("");

        for (const ep of paginated) {
          const deprecationBadge = ep.deprecated ? " ~~(deprecated)~~" : "";
          lines.push(`### \`${ep.method.toUpperCase()}\` ${ep.path}${deprecationBadge}`);
          if (ep.summary) lines.push(`${ep.summary}`);
          if (ep.operationId) lines.push(`- Operation ID: \`${ep.operationId}\``);
          if (ep.tags.length > 0) lines.push(`- Tags: ${ep.tags.map((t) => `\`${t}\``).join(", ")}`);
          lines.push("");
        }

        if (hasMore) {
          lines.push(`> Showing ${paginated.length} of ${total} endpoints. Use offset=${params.offset + paginated.length} to see more.`);
        }

        if (tags.length > 0 && !params.tag) {
          lines.push("---");
          lines.push("## Available Tags");
          lines.push("Use the `tag` parameter to filter by group:");
          lines.push("");
          for (const tag of tags) {
            lines.push(`- \`${tag.name}\` (${tag.count} endpoints)`);
          }
        }

        let textContent = lines.join("\n");
        if (textContent.length > CHARACTER_LIMIT) {
          textContent = textContent.slice(0, CHARACTER_LIMIT) + "\n\n... (truncated)";
        }

        return {
          content: [{ type: "text", text: textContent }],
          structuredContent: output,
        };
      } catch (error) {
        return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    }
  );

  server.registerTool(
    "swagger_get_endpoint",
    {
      title: "Get Endpoint Details",
      description: `Get detailed information about a specific API endpoint, including parameters, request body, responses, and security requirements.

Use this tool after swagger_list_paths to drill down into a specific endpoint's complete details.

Args:
  - spec_name (string): Name of the previously loaded spec
  - path (string): URL path of the endpoint (e.g., "/pets/{petId}")
  - method (string): HTTP method (get, post, put, patch, delete, options, head)

Returns:
  Full endpoint details with parameters, request body, responses, and security.

Examples:
  - Use when: "Show me the details of GET /pets/{petId}" -> params with spec_name="<name>", path="/pets/{petId}", method="get"
  - Use when: "What parameters does the create user endpoint take?" -> params with spec_name="<name>", path="/users", method="post"

Error Handling:
  - Returns error if the spec name has not been loaded
  - Returns error if the path or method is not found, with suggestions`,
      inputSchema: z.object({
        spec_name: z.string().min(1).describe("Name of the previously loaded OpenAPI/Swagger spec (use swagger_list_loaded to see available names)"),
        path: z.string().describe("URL path of the endpoint (e.g., '/pets/{petId}', '/users', '/store/order'). Must start with '/'."),
        method: z.enum(["get", "post", "put", "patch", "delete", "options", "head"]).describe("HTTP method (get, post, put, patch, delete, options, head)"),
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

        const detail = getEndpointDetail(params.spec_name, params.path, params.method as HttpMethod);
        if (!detail) {
          const allEndpoints = getEndpoints(params.spec_name);
          const similarPaths = allEndpoints
            .filter((ep) => ep.path.includes(params.path) || params.path.includes(ep.path))
            .slice(0, 5);

          let suggestion = "";
          if (similarPaths.length > 0) {
            suggestion = `\n\nDid you mean one of these?\n${similarPaths.map((ep) => `  - ${ep.method.toUpperCase()} ${ep.path}`).join("\n")}`;
          }
          return { content: [{ type: "text", text: `Error: No ${params.method.toUpperCase()} operation found for path '${params.path}'.${suggestion}` }] };
        }

        const paramNames = getPathParameterNames(params.path);

        const mergedParameters = [
          ...paramNames.map((name) => {
            const existingParam = (detail.parameters || []).find((p) => p.name === name);
            if (existingParam) return existingParam;
            return { name, in: "path" as const, required: true, description: `Path parameter: ${name}`, schema: { type: "string" } };
          }),
          ...(detail.parameters || []).filter((p) => !paramNames.includes(p.name)),
        ];

        const endpointInfo = {
          path: params.path,
          method: params.method,
          summary: detail.summary,
          description: detail.description,
          operationId: detail.operationId,
          tags: detail.tags || [],
          deprecated: detail.deprecated || false,
          parameters: mergedParameters,
          requestBody: detail.requestBody
            ? {
                description: detail.requestBody.description,
                required: detail.requestBody.required,
                content: Object.fromEntries(
                  Object.entries(detail.requestBody.content).map(([ct, mt]) => [ct, { schema: mt.schema }])
                ),
              }
            : undefined,
          responses: detail.responses
            ? Object.fromEntries(
                Object.entries(detail.responses).map(([code, resp]) => [
                  code,
                  {
                    description: resp.description,
                    content: resp.content
                      ? Object.fromEntries(
                          Object.entries(resp.content).map(([ct, mt]) => [ct, { schema: mt.schema }])
                        )
                      : undefined,
                  },
                ])
              )
            : undefined,
          security: detail.security,
        };

        return {
          content: [{ type: "text", text: formatEndpointDetail(endpointInfo) }],
          structuredContent: endpointInfo,
        };
      } catch (error) {
        return { content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }] };
      }
    }
  );
}