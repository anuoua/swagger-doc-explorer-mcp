import axios, { AxiosError } from "axios";
import { readFile } from "fs/promises";
import { resolve } from "path";
import type {
  SpecStore,
  OpenApiSpec,
  OperationObject,
  EndpointSummary,
  SchemaSummary,
  SearchResult,
  SchemaObject,
  PathItem,
  HttpMethod,
} from "../types.js";
import { HTTP_METHODS } from "../constants.js";

const specStore = new Map<string, SpecStore>();

const METHOD_PRIORITY: Record<string, number> = {
  get: 0,
  post: 1,
  put: 2,
  patch: 3,
  delete: 4,
  options: 5,
  head: 6,
};

function generateSpecName(title: string, version: string): string {
  const base = `${title} v${version}`;
  let name = base;
  let counter = 2;
  while (specStore.has(name)) {
    name = `${base} (${counter++})`;
  }
  return name;
}

export function isLoaded(name: string): boolean {
  return specStore.has(name);
}

export function getLoadedUrls(): string[] {
  return Array.from(specStore.keys());
}

export function getSpecKeys(): string[] {
  return Array.from(specStore.keys());
}

export function getSpec(name: string): SpecStore | undefined {
  return specStore.get(name);
}

export function removeSpec(name: string): boolean {
  return specStore.delete(name);
}

export async function loadSpecFromFile(filePath: string): Promise<SpecStore> {
  const resolvedPath = resolve(filePath);
  try {
    const raw = await readFile(resolvedPath, "utf-8");

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new Error(
        `Failed to parse "${resolvedPath}" as JSON. Ensure the file contains a valid JSON-formatted OpenAPI/Swagger spec.`
      );
    }

    if (!data.openapi && !data.swagger) {
      throw new Error(
        `"${resolvedPath}" does not appear to be a valid OpenAPI/Swagger spec. The JSON must contain an 'openapi' or 'swagger' field.`
      );
    }

    const spec = data as unknown as OpenApiSpec;

    if (!spec.info) {
      throw new Error("Invalid OpenAPI spec: missing 'info' field with title and version.");
    }

    spec.info.title = spec.info.title || "Untitled API";
    spec.info.version = spec.info.version || "0.0.0";
    spec.paths = spec.paths || {};

    const name = generateSpecName(spec.info.title, spec.info.version);
    const store: SpecStore = {
      spec,
      name,
      source: resolvedPath,
      loadedAt: new Date().toISOString(),
    };

    specStore.set(name, store);
    return store;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ENOENT")) {
      throw new Error(`File not found: "${resolvedPath}". Check that the path is correct.`);
    }
    throw error;
  }
}

export async function loadSpec(url: string, authHeader?: string): Promise<SpecStore> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/json, application/yaml, text/yaml, text/plain",
    };
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const response = await axios.get(url, {
      headers,
      timeout: 30000,
      responseType: "text",
    });

    let data: Record<string, unknown>;
    const contentType = String(response.headers["content-type"] || "");
    const raw = response.data;

    if (contentType.includes("yaml") || contentType.includes("x-yaml") || typeof raw === "string" && (raw.trim().startsWith("openapi:") || raw.trim().startsWith("swagger:"))) {
      throw new Error("YAML content detected but not supported. Please provide a JSON-formatted OpenAPI spec.");
    }

    if (typeof raw === "string") {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw as unknown as Record<string, unknown>;
      }
    } else {
      data = raw as Record<string, unknown>;
    }

    if (!data.openapi && !data.swagger) {
      throw new Error("The document does not appear to be a valid OpenAPI/Swagger spec. Ensure the URL returns a JSON document with 'openapi' or 'swagger' field.");
    }

    const spec = data as unknown as OpenApiSpec;

    if (!spec.info) {
      throw new Error("Invalid OpenAPI spec: missing 'info' field with title and version.");
    }

    spec.info.title = spec.info.title || "Untitled API";
    spec.info.version = spec.info.version || "0.0.0";
    spec.paths = spec.paths || {};

    const name = generateSpecName(spec.info.title, spec.info.version);
    const store: SpecStore = {
      spec,
      name,
      source: url,
      loadedAt: new Date().toISOString(),
    };

    specStore.set(name, store);
    return store;
  } catch (error) {
    if (error instanceof AxiosError) {
      if (error.code === "ECONNREFUSED") {
        throw new Error(`Failed to connect to ${url}. Ensure the URL is correct and the server is accessible.`);
      }
      if (error.code === "ENOTFOUND") {
        throw new Error(`DNS lookup failed for ${url}. Check the URL is spelled correctly.`);
      }
      if (error.response) {
        const status = error.response.status;
        if (status === 404) {
          throw new Error(`Spec not found at ${url} (404). Verify the URL points to an existing OpenAPI JSON document.`);
        }
        if (status === 403) {
          throw new Error(`Access denied to ${url} (403). You may need to provide an auth header.`);
        }
        throw new Error(`Failed to fetch spec from ${url}: HTTP ${status}`);
      }
      if (error.code === "ECONNABORTED") {
        throw new Error(`Request to ${url} timed out. The server may be slow or unreachable.`);
      }
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Unexpected error loading spec from ${url}`);
  }
}

export function getEndpoints(name: string, tag?: string): EndpointSummary[] {
  const store = specStore.get(name);
  if (!store) return [];

  const endpoints: EndpointSummary[] = [];

  for (const [path, pathItem] of Object.entries(store.spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as OperationObject | undefined;
      if (!operation) continue;

      if (tag && (!operation.tags || !operation.tags.includes(tag))) continue;

      endpoints.push({
        path,
        method: method as HttpMethod,
        summary: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
        operationId: operation.operationId,
        tags: operation.tags || [],
        deprecated: operation.deprecated || false,
      });
    }
  }

  endpoints.sort((a, b) => {
    if (a.path !== b.path) return a.path.localeCompare(b.path);
    return (METHOD_PRIORITY[a.method] ?? 99) - (METHOD_PRIORITY[b.method] ?? 99);
  });

  return endpoints;
}

export function getEndpointDetail(name: string, path: string, method: HttpMethod): OperationObject | null {
  const store = specStore.get(name);
  if (!store) return null;

  const pathItem = store.spec.paths[path];
  if (!pathItem) return null;

  const operation = (pathItem as Record<string, unknown>)[method] as OperationObject | undefined;
  return operation || null;
}

export function getPathParameterNames(path: string): string[] {
  const matches = path.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

export function getSchemas(name: string): SchemaSummary[] {
  const store = specStore.get(name);
  if (!store) return [];

  const schemas = store.spec.components?.schemas || store.spec.definitions || {};
  const result: SchemaSummary[] = [];

  for (const [name, schema] of Object.entries(schemas)) {
    const props = schema.properties ? Object.keys(schema.properties).length : 0;
    result.push({
      name,
      type: schema.type || "object",
      description: schema.description || schema.title,
      properties: props,
    });
  }

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export function getSchemaDetail(name: string, schemaName: string): SchemaObject | null {
  const store = specStore.get(name);
  if (!store) return null;

  const schemas = store.spec.components?.schemas || store.spec.definitions || {};
  return schemas[schemaName] || null;
}

export function getTags(name: string): Array<{ name: string; count: number }> {
  const store = specStore.get(name);
  if (!store) return [];

  const tagCounts = new Map<string, number>();

  for (const pathItem of Object.values(store.spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as OperationObject | undefined;
      if (!operation?.tags) continue;
      for (const tag of operation.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  }

  return Array.from(tagCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function searchSpec(name: string, query: string): SearchResult[] {
  const store = specStore.get(name);
  if (!store) return [];

  const results: SearchResult[] = [];
  const lowerQuery = query.toLowerCase();

  const schemas = store.spec.components?.schemas || store.spec.definitions || {};

  for (const [path, pathItem] of Object.entries(store.spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = (pathItem as Record<string, unknown>)[method] as OperationObject | undefined;
      if (!operation) continue;

      const searchText = [
        path,
        method,
        operation.summary,
        operation.operationId,
        operation.description,
        ...(operation.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchText.includes(lowerQuery)) {
        results.push({
          type: "endpoint",
          path,
          method: method as HttpMethod,
          match: `${method.toUpperCase()} ${path}`,
          summary: operation.summary || operation.operationId,
        });
      }
    }
  }

  for (const [name, schema] of Object.entries(schemas)) {
    const schemaSearchText = [name, schema.description, schema.title].filter(Boolean).join(" ").toLowerCase();

    if (schemaSearchText.includes(lowerQuery)) {
      results.push({
        type: "schema",
        schemaName: name,
        match: `Schema: ${name}`,
        summary: schema.description,
      });
    }

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const propSearchText = [propName, propSchema.description].filter(Boolean).join(" ").toLowerCase();
        if (propSearchText.includes(lowerQuery)) {
          results.push({
            type: "property",
            schemaName: name,
            propertyName: propName,
            match: `Schema ${name} > ${propName}`,
            summary: propSchema.description,
          });
        }
      }
    }
  }

  return results;
}

export function resolveRef(ref: string, name: string): unknown {
  const store = specStore.get(name);
  if (!store) return null;

  const parts = ref.replace(/^#\//, "").split("/");
  let current: unknown = store.spec as unknown as Record<string, unknown>;

  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  return current;
}

export function getServerUrl(name: string): string {
  const store = specStore.get(name);
  if (!store) return "";

  const spec = store.spec;

  if (spec.servers && spec.servers.length > 0) {
    let baseUrl = spec.servers[0].url;
    if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);
    return baseUrl;
  }

  if (spec.host) {
    const scheme = spec.schemes?.[0] || "https";
    const basePath = spec.basePath || "";
    return `${scheme}://${spec.host}${basePath}`;
  }

  return "";
}
