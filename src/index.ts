#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { randomUUID } from "crypto";
import { createServer } from "http";
import { registerLoadSpecTools } from "./tools/load-spec.js";
import { registerPathsTools } from "./tools/paths.js";
import { registerSchemasTools } from "./tools/schemas.js";
import { registerInfoTools } from "./tools/info.js";
import { registerSearchTools } from "./tools/search.js";

const server = new McpServer({
  name: "swagger-doc-explorer-mcp",
  version: "1.0.0",
});

registerLoadSpecTools(server);
registerPathsTools(server);
registerSchemasTools(server);
registerInfoTools(server);
registerSearchTools(server);

async function startHttpServer(port: number): Promise<void> {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    enableJsonResponse: true,
  });
  await server.connect(transport);

  const httpServer = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, mcp-session-id");
    res.setHeader("Access-Control-Expose-Headers", "mcp-session-id");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST") {
      try {
        await transport.handleRequest(req, res);
      } catch (error) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid request" }));
      }
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Swagger Doc Explorer MCP Server\n");
  });

  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      console.error(`Swagger Doc Explorer MCP server running via HTTP on port ${port}`);
      resolve();
    });
  });
}

async function main() {
  const httpPort = process.env.SWAGGER_HTTP_PORT;

  if (httpPort) {
    await startHttpServer(parseInt(httpPort, 10));
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Swagger Doc Explorer MCP server running via stdio");
  }
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});