# Xquik OpenAPI Example

Use this example to inspect Xquik's hosted OpenAPI document without storing
credentials in the repository.

1. Start `swagger-doc-explorer-mcp`.
2. Call `swagger_load_spec` with:

```json
{
  "url": "https://xquik.com/openapi.json"
}
```

3. Use the returned `spec_name` with:

```json
{
  "spec_name": "Xquik API v1.0"
}
```

Useful follow-up tools:

- `swagger_get_info`
- `swagger_list_tags`
- `swagger_list_paths` with the `Tweets` tag
- `swagger_search` with the `tweet` query

The OpenAPI document is public. Protected REST requests documented by the spec
use the `x-api-key` header.
