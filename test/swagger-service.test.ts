import { describe, it, before } from "node:test";
import assert from "node:assert";
import { resolve } from "path";
import { writeFile, unlink } from "fs/promises";
import {
  loadSpecFromFile,
  getSpec,
  isLoaded,
  getLoadedUrls,
  getEndpoints,
  getEndpointDetail,
  getSchemas,
  getSchemaDetail,
  getTags,
  getServerUrl,
  searchSpec,
  resolveRef,
  getPathParameterNames,
  removeSpec,
} from "../src/services/swagger-service.js";

const REL_PATH = "test/opencode-swaggerdoc.json";
const SPEC_PATH = resolve(REL_PATH);
const SPEC_NAME = "opencode v1.0.0";

describe("swagger-service", () => {
  before(async () => {
    await loadSpecFromFile(SPEC_PATH);
  });

  describe("loadSpecFromFile", () => {
    it("should load a valid OpenAPI spec from file", async () => {
      const store = await loadSpecFromFile(SPEC_PATH);
      assert.equal(store.spec.info.title, "opencode");
      assert.equal(store.spec.info.version, "1.0.0");
      assert.ok(store.loadedAt);
      assert.ok(store.name);
      assert.equal(store.source, SPEC_PATH);
      removeSpec(store.name);
    });

    it("should throw for non-existent file", async () => {
      await assert.rejects(
        () => loadSpecFromFile("/nonexistent/path.json"),
        /not found/i
      );
    });
  });

  describe("getSpec / isLoaded / getLoadedUrls", () => {
    it("should return spec for loaded name", () => {
      const store = getSpec(SPEC_NAME);
      assert.equal(store?.spec.info.title, "opencode");
    });

    it("should return undefined for unloaded spec", () => {
      assert.equal(getSpec("nonexistent"), undefined);
    });

    it("isLoaded should return true for loaded spec", () => {
      assert.ok(isLoaded(SPEC_NAME));
    });

    it("isLoaded should return false for unloaded spec", () => {
      assert.equal(isLoaded("nonexistent"), false);
    });

    it("getLoadedUrls should include the loaded spec name", () => {
      const names = getLoadedUrls();
      assert.ok(names.some((n) => n === SPEC_NAME));
    });
  });

  describe("getEndpoints", () => {
    it("should return all 165 endpoints", () => {
      const endpoints = getEndpoints(SPEC_NAME);
      assert.equal(endpoints.length, 165);
    });

    it("should filter endpoints by tag", () => {
      const endpoints = getEndpoints(SPEC_NAME, "global");
      assert.ok(endpoints.length > 0);
      for (const ep of endpoints) {
        assert.ok(ep.tags.includes("global"));
      }
      assert.equal(endpoints.length, 6);
    });

    it("should return empty array for unknown tag", () => {
      assert.deepEqual(getEndpoints(SPEC_NAME, "nonexistent-tag"), []);
    });

    it("should return empty array for unloaded spec", () => {
      assert.deepEqual(getEndpoints("nonexistent"), []);
    });

    it("should sort by path then method priority", () => {
      const endpoints = getEndpoints(SPEC_NAME);
      for (let i = 1; i < endpoints.length; i++) {
        const prev = endpoints[i - 1];
        const curr = endpoints[i];
        if (prev.path === curr.path) {
          const order = ["get", "post", "put", "patch", "delete", "options", "head"];
          assert.ok(order.indexOf(prev.method) <= order.indexOf(curr.method));
        } else {
          assert.ok(prev.path.localeCompare(curr.path) <= 0);
        }
      }
    });

    it("should include global.health endpoint", () => {
      const eps = getEndpoints(SPEC_NAME, "global");
      assert.ok(eps.find((e) => e.operationId === "global.health"));
    });

    it("should include auth.set endpoint", () => {
      const eps = getEndpoints(SPEC_NAME, "control");
      const ep = eps.find((e) => e.operationId === "auth.set");
      assert.ok(ep);
      assert.equal(ep?.method, "put");
      assert.equal(ep?.path, "/auth/{providerID}");
    });
  });

  describe("getEndpointDetail", () => {
    it("should return operation for known endpoint", () => {
      const detail = getEndpointDetail(SPEC_NAME, "/global/health", "get");
      assert.equal(detail?.operationId, "global.health");
      assert.equal(detail?.summary, "Get health");
      assert.ok(detail?.tags?.includes("global"));
    });

    it("should return null for non-existent method on known path", () => {
      assert.equal(getEndpointDetail(SPEC_NAME, "/global/health", "post"), null);
    });

    it("should return null for non-existent path", () => {
      assert.equal(getEndpointDetail(SPEC_NAME, "/nonexistent", "get"), null);
    });

    it("should return null for unloaded spec", () => {
      assert.equal(getEndpointDetail("nonexistent", "/test", "get"), null);
    });
  });

  describe("getPathParameterNames", () => {
    it("should extract path params", () => {
      assert.deepEqual(getPathParameterNames("/auth/{providerID}"), ["providerID"]);
    });

    it("should return empty for path without params", () => {
      assert.deepEqual(getPathParameterNames("/global/health"), []);
    });

    it("should extract multiple params", () => {
      assert.deepEqual(getPathParameterNames("/users/{uid}/posts/{pid}"), ["uid", "pid"]);
    });
  });

  describe("getSchemas", () => {
    it("should return all 342 schemas", () => {
      const schemas = getSchemas(SPEC_NAME);
      assert.equal(schemas.length, 342);
    });

    it("should include known schemas", () => {
      const schemas = getSchemas(SPEC_NAME);
      const config = schemas.find((s) => s.name === "Config");
      assert.ok(config);
      assert.equal(config?.type, "object");
      assert.equal(config?.properties, 35);
    });

    it("should include string-type schemas", () => {
      const s = getSchemas(SPEC_NAME).find((s) => s.name === "LayoutConfig");
      assert.ok(s);
      assert.equal(s?.type, "string");
    });

    it("should include array-type schemas", () => {
      const s = getSchemas(SPEC_NAME).find((s) => s.name === "ToolList");
      assert.ok(s);
      assert.equal(s?.type, "array");
    });

    it("should return empty for unloaded spec", () => {
      assert.deepEqual(getSchemas("nonexistent"), []);
    });

    it("should be sorted alphabetically", () => {
      const schemas = getSchemas(SPEC_NAME);
      for (let i = 1; i < schemas.length; i++) {
        assert.ok(schemas[i - 1].name.localeCompare(schemas[i].name) <= 0);
      }
    });
  });

  describe("getSchemaDetail", () => {
    it("should return details for known schema", () => {
      const schema = getSchemaDetail(SPEC_NAME, "Config");
      assert.equal(schema?.type, "object");
      assert.ok(schema?.properties?.$schema);
    });

    it("should return null for unknown schema", () => {
      assert.equal(getSchemaDetail(SPEC_NAME, "NonExistentSchema"), null);
    });

    it("should return null for unloaded spec", () => {
      assert.equal(getSchemaDetail("nonexistent", "Config"), null);
    });
  });

  describe("getTags", () => {
    it("should return tags with counts", () => {
      const tags = getTags(SPEC_NAME);
      const g = tags.find((t) => t.name === "global");
      assert.ok(g);
      assert.equal(g?.count, 6);
    });

    it("should include experimental with >= 10 endpoints", () => {
      const tags = getTags(SPEC_NAME);
      const exp = tags.find((t) => t.name === "experimental");
      assert.ok(exp);
      assert.ok(exp.count >= 10);
    });

    it("should be sorted alphabetically", () => {
      const tags = getTags(SPEC_NAME);
      for (let i = 1; i < tags.length; i++) {
        assert.ok(tags[i - 1].name.localeCompare(tags[i].name) <= 0);
      }
    });

    it("should return empty array for unloaded spec", () => {
      assert.deepEqual(getTags("nonexistent"), []);
    });
  });

  describe("getServerUrl", () => {
    it("should return empty string for spec without servers", () => {
      assert.equal(getServerUrl(SPEC_NAME), "");
    });
  });

  describe("searchSpec", () => {
    it("should find endpoints by operationId", () => {
      const r = searchSpec(SPEC_NAME, "global.health");
      assert.ok(r.some((x) => x.type === "endpoint" && x.path === "/global/health" && x.method === "get"));
    });

    it("should find endpoints by summary", () => {
      const r = searchSpec(SPEC_NAME, "Get health");
      assert.ok(r.some((x) => x.type === "endpoint" && x.path === "/global/health"));
    });

    it("should find endpoints by path", () => {
      const r = searchSpec(SPEC_NAME, "/global/health");
      assert.ok(r.some((x) => x.type === "endpoint" && x.path === "/global/health"));
    });

    it("should find schemas by name", () => {
      const r = searchSpec(SPEC_NAME, "Config");
      assert.ok(r.some((x) => x.type === "schema" && x.schemaName === "Config"));
    });

    it("should find properties by name", () => {
      const r = searchSpec(SPEC_NAME, "sessionID");
      assert.ok(r.some((x) => x.type === "property" && x.propertyName === "sessionID"));
    });

    it("should be case-insensitive", () => {
      assert.equal(searchSpec(SPEC_NAME, "health").length, searchSpec(SPEC_NAME, "HEALTH").length);
    });

    it("should return empty for no match", () => {
      assert.deepEqual(searchSpec(SPEC_NAME, "xyznonexistent12345"), []);
    });

    it("should return empty for unloaded spec", () => {
      assert.deepEqual(searchSpec("nonexistent", "health"), []);
    });
  });

  describe("resolveRef", () => {
    it("should resolve valid $ref", () => {
      const resolved = resolveRef("#/components/schemas/Config", SPEC_NAME);
      assert.ok(resolved);
      assert.ok((resolved as Record<string, unknown>)?.properties);
    });

    it("should return null for invalid $ref", () => {
      assert.equal(resolveRef("#/components/schemas/NonExistent", SPEC_NAME), null);
    });

    it("should return null for malformed $ref", () => {
      assert.equal(resolveRef("invalid-ref", SPEC_NAME), null);
    });

    it("should return null for unloaded spec", () => {
      assert.equal(resolveRef("#/components/schemas/Config", "nonexistent"), null);
    });
  });

  describe("cross-field consistency", () => {
    it("tag endpoint sum >= total endpoints (due to multi-tag)", () => {
      const total = getEndpoints(SPEC_NAME).length;
      const tagSum = getTags(SPEC_NAME).reduce((s, t) => s + t.count, 0);
      assert.ok(tagSum >= total);
    });

    it("every schema listed has a detail", () => {
      for (const s of getSchemas(SPEC_NAME)) {
        assert.ok(getSchemaDetail(SPEC_NAME, s.name), `Missing detail for "${s.name}"`);
      }
    });

    it("endpoints found via tag are also searchable", () => {
      for (const ep of getEndpoints(SPEC_NAME, "experimental")) {
        const r = searchSpec(SPEC_NAME, ep.operationId || ep.summary);
        assert.ok(r.length > 0);
      }
    });
  });

  describe("removeSpec", () => {
    it("should remove a loaded spec", async () => {
      const store = await loadSpecFromFile(SPEC_PATH);
      assert.ok(isLoaded(store.name));
      removeSpec(store.name);
      assert.equal(isLoaded(store.name), false);
    });
  });
});

describe("spec name deduplication", () => {
  it("should generate deduplicated name on repeated load", async () => {
    const first = await loadSpecFromFile(SPEC_PATH);
    const second = await loadSpecFromFile(SPEC_PATH);
    assert.match(second.name, /^opencode v1\.0\.0 \(\d+\)$/);
    assert.notEqual(first.name, second.name);
    removeSpec(first.name);
    removeSpec(second.name);
  });
});

describe("error-handling", () => {
  it("should throw for invalid JSON file", async () => {
    await writeFile("/tmp/invalid-spec.json", "not json");
    await assert.rejects(() => loadSpecFromFile("/tmp/invalid-spec.json"), /Failed to parse/i);
    await unlink("/tmp/invalid-spec.json");
  });

  it("should throw for non-OpenAPI JSON", async () => {
    await writeFile("/tmp/not-openapi.json", JSON.stringify({ name: "foo" }));
    await assert.rejects(() => loadSpecFromFile("/tmp/not-openapi.json"), /does not appear to be a valid/i);
    await unlink("/tmp/not-openapi.json");
  });

  it("should throw for spec missing info", async () => {
    await writeFile("/tmp/no-info.json", JSON.stringify({ openapi: "3.1.0", paths: {} }));
    await assert.rejects(() => loadSpecFromFile("/tmp/no-info.json"), /missing 'info'/i);
    await unlink("/tmp/no-info.json");
  });
});