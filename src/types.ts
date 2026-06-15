export interface SpecStore {
  spec: OpenApiSpec;
  name: string;
  source: string;
  loadedAt: string;
}

export interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
  };
  definitions?: Record<string, SchemaObject>;
  tags?: Array<{ name: string; description?: string }>;
  servers?: Array<{ url: string; description?: string }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
}

export interface PathItem {
  summary?: string;
  description?: string;
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  options?: OperationObject;
  head?: OperationObject;
  parameters?: ParameterObject[];
}

export interface OperationObject {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
}

export interface ParameterObject {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  schema?: SchemaObject;
  type?: string;
  items?: SchemaObject;
  enum?: string[];
  example?: unknown;
}

export interface RequestBodyObject {
  description?: string;
  required?: boolean;
  content: Record<string, MediaTypeObject>;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, unknown>;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
  headers?: Record<string, ParameterObject>;
}

export interface SchemaObject {
  [key: string]: unknown;
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  enum?: string[];
  description?: string;
  example?: unknown;
  default?: unknown;
  nullable?: boolean;
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  allOf?: SchemaObject[];
  $ref?: string;
  additionalProperties?: boolean | SchemaObject;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: Record<string, unknown>;
  externalDocs?: { url: string; description?: string };
  title?: string;
  deprecated?: boolean;
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "options" | "head";

export interface EndpointSummary {
  path: string;
  method: HttpMethod;
  summary: string;
  operationId?: string;
  tags: string[];
  deprecated: boolean;
}

export interface SchemaSummary {
  name: string;
  type?: string;
  description?: string;
  properties: number;
}

export interface SearchResult {
  type: "endpoint" | "schema" | "property";
  path?: string;
  method?: HttpMethod;
  schemaName?: string;
  propertyName?: string;
  match: string;
  summary?: string;
}
