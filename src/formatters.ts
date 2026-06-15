import type { SchemaObject, ParameterObject } from "./types.js";

export function formatSchema(schema: SchemaObject, indent: number = 0): string {
  const pad = "  ".repeat(indent);
  const parts: string[] = [];

  if (schema.description) {
    parts.push(`${pad}// ${schema.description}`);
  }

  if (schema.$ref) {
    const refName = schema.$ref.split("/").pop() || schema.$ref;
    parts.push(`${pad}$ref: "${refName}"`);
    return parts.join("\n");
  }

  if (schema.enum) {
    parts.push(`${pad}enum: [${schema.enum.map((v) => JSON.stringify(v)).join(", ")}]`);
    return parts.join("\n");
  }

  if (schema.oneOf) {
    parts.push(`${pad}oneOf:`);
    for (const s of schema.oneOf) {
      parts.push(formatSchema(s, indent + 1));
    }
    return parts.join("\n");
  }

  if (schema.anyOf) {
    parts.push(`${pad}anyOf:`);
    for (const s of schema.anyOf) {
      parts.push(formatSchema(s, indent + 1));
    }
    return parts.join("\n");
  }

  if (schema.allOf) {
    parts.push(`${pad}allOf:`);
    for (const s of schema.allOf) {
      parts.push(formatSchema(s, indent + 1));
    }
    return parts.join("\n");
  }

  const typeStr = schema.type || "any";
  const formatStr = schema.format ? `<${schema.format}>` : "";
  const nullableStr = schema.nullable ? " | null" : "";
  parts.push(`${pad}type: ${typeStr}${formatStr}${nullableStr}`);

  if (schema.properties) {
    const required = new Set(schema.required || []);
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const req = required.has(propName) ? " (required)" : "";
      parts.push(`${pad}${propName}${req}:`);
      parts.push(formatSchema(propSchema, indent + 1));
    }
  }

  if (schema.items) {
    parts.push(`${pad}items:`);
    parts.push(formatSchema(schema.items, indent + 1));
  }

  if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
    parts.push(`${pad}additionalProperties:`);
    parts.push(formatSchema(schema.additionalProperties, indent + 1));
  }

  if (schema.example !== undefined) {
    parts.push(`${pad}example: ${JSON.stringify(schema.example)}`);
  }

  if (schema.default !== undefined) {
    parts.push(`${pad}default: ${JSON.stringify(schema.default)}`);
  }

  if (schema.minLength !== undefined) parts.push(`${pad}minLength: ${schema.minLength}`);
  if (schema.maxLength !== undefined) parts.push(`${pad}maxLength: ${schema.maxLength}`);
  if (schema.minimum !== undefined) parts.push(`${pad}minimum: ${schema.minimum}`);
  if (schema.maximum !== undefined) parts.push(`${pad}maximum: ${schema.maximum}`);
  if (schema.pattern) parts.push(`${pad}pattern: ${schema.pattern}`);

  return parts.join("\n");
}

export function formatEndpointDetail(endpoint: {
  path: string;
  method: string;
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: ParameterObject[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content: Record<string, { schema?: SchemaObject }>;
  };
  responses?: Record<string, { description: string; content?: Record<string, { schema?: SchemaObject }> }>;
  security?: Array<Record<string, string[]>>;
}): string {
  const lines: string[] = [];

  lines.push(`# ${endpoint.method.toUpperCase()} ${endpoint.path}`);

  if (endpoint.deprecated) {
    lines.push("");
    lines.push("> **DEPRECATED**");
  }

  if (endpoint.summary) {
    lines.push("");
    lines.push(endpoint.summary);
  }
  if (endpoint.description) {
    lines.push("");
    lines.push(endpoint.description);
  }

  if (endpoint.operationId) {
    lines.push("");
    lines.push(`**Operation ID**: \`${endpoint.operationId}\``);
  }

  if (endpoint.tags && endpoint.tags.length > 0) {
    lines.push("");
    lines.push(`**Tags**: ${endpoint.tags.map((t) => `\`${t}\``).join(", ")}`);
  }

  if (endpoint.parameters && endpoint.parameters.length > 0) {
    lines.push("");
    lines.push("## Parameters");
    lines.push("");
    lines.push("| Name | In | Type | Required | Description |");
    lines.push("|------|----|------|----------|-------------|");
    for (const param of endpoint.parameters) {
      const typeStr = param.schema?.type || param.type || "string";
      const requiredStr = param.required ? "Yes" : "No";
      const desc = param.description || "";
      lines.push(`| \`${param.name}\` | ${param.in} | ${typeStr} | ${requiredStr} | ${desc} |`);
    }
  }

  if (endpoint.requestBody) {
    lines.push("");
    lines.push("## Request Body");
    if (endpoint.requestBody.required) {
      lines.push("> **Required**");
    }
    if (endpoint.requestBody.description) {
      lines.push("");
      lines.push(endpoint.requestBody.description);
    }
    for (const [contentType, mediaType] of Object.entries(endpoint.requestBody.content)) {
      lines.push("");
      lines.push(`**${contentType}**:`);
      if (mediaType.schema) {
        lines.push("```");
        lines.push(formatSchema(mediaType.schema));
        lines.push("```");
      }
    }
  }

  if (endpoint.responses) {
    lines.push("");
    lines.push("## Responses");
    for (const [statusCode, response] of Object.entries(endpoint.responses)) {
      lines.push("");
      lines.push(`### ${statusCode}`);
      lines.push(response.description);
      if (response.content) {
        for (const [contentType, mediaType] of Object.entries(response.content)) {
          lines.push("");
          lines.push(`**${contentType}**:`);
          if (mediaType.schema) {
            lines.push("```");
            lines.push(formatSchema(mediaType.schema));
            lines.push("```");
          }
        }
      }
    }
  }

  if (endpoint.security && endpoint.security.length > 0) {
    lines.push("");
    lines.push("## Security");
    for (const sec of endpoint.security) {
      for (const [scheme, scopes] of Object.entries(sec)) {
        const scopeStr = scopes.length > 0 ? ` [${scopes.join(", ")}]` : "";
        lines.push(`- \`${scheme}\`${scopeStr}`);
      }
    }
  }

  return lines.join("\n");
}