# api-mock-seeder

[GitHub Repository](https://github.com/Xm3a01/api-mock-seeder)

`api-mock-seeder` is a small Node.js CLI for generating deterministic mock API data from:

- OpenAPI documents
- Postman collection exports with saved JSON responses
- JSON Schema files
- sample JSON files

It is built for stable fixture generation, not for serving mock endpoints. The same input plus the same seed produces the same output.

## Install

Requires Node.js 18+.

### Without installation on your local machine

```bash
npx api-mock-seeder generate openapi.yaml --seed 42 --out ./mocks
```

### With installation on your local machine

```bash
npm install -g api-mock-seeder
api-mock-seeder generate openapi.yaml --seed 42 --out ./mocks
```

## Usage

Use `api-mock-seeder` if the package is installed on your machine. If you do not want to install it, use `npx api-mock-seeder` instead.

```bash
api-mock-seeder generate openapi.yaml --seed 42 --out ./mocks
```

By default, the CLI writes all three built-in scenarios:

- `happy-path`
- `empty-state`
- `large-dataset`

You can limit generation to one scenario:

```bash
api-mock-seeder generate schema.json --seed 42 --scenario happy-path --out ./fixtures
```

You can also pass a sample JSON file:

```bash
api-mock-seeder generate examples/user.json --seed demo --out ./mocks
```

You can also pass a JSON Schema file:

```bash
api-mock-seeder generate examples/user.schema.json --seed 42 --out ./mocks
```

You can also pass a Postman collection export:

```bash
api-mock-seeder generate collection.json --seed 42 --out ./mocks
```

## What It Generates

For each target, the CLI writes pretty JSON files such as:

```text
./mocks/list-users-200.happy-path.json
./mocks/list-users-200.empty-state.json
./mocks/list-users-200.large-dataset.json
```

OpenAPI inputs generate one file per detected JSON response schema. Postman collections generate one file per saved JSON response example. JSON Schema and sample JSON inputs generate one target based on the input file name.

## Behavior

- deterministic output based on `--seed`
- examples-first generation when examples are present
- realistic fake values based on field names and types
- local `$ref` support for OpenAPI and JSON Schema
- readable, pretty-printed JSON output

## Scenario Notes

- `happy-path`: uses examples when available and generates normal-looking data
- `empty-state`: empties arrays and zeroes count-like fields
- `large-dataset`: expands arrays for pagination and bulk fixture cases

## Supported Inputs

### OpenAPI

- detects JSON responses from `paths`
- prefers `2xx` and `default` responses
- reads `example` and `examples` when present
- supports local component `$ref` pointers

### JSON Schema

- supports object, array, scalar, `enum`, `const`, `default`
- supports `allOf`, `oneOf`, and `anyOf` in a simple MVP form
- example file: `examples/user.schema.json`

### Postman Collection

- supports exported Postman collection JSON files
- reads saved JSON response examples from collection items
- generates one target per saved JSON response example
- does not use the file name to detect the format, so a Postman collection can still be named `schema.json`
- example file: `examples/resources.collection.json`

### Sample JSON

- infers a schema from the sample structure
- treats sample values as examples
- example file: `examples/user.json`

## JSON Schema Example

Example `examples/user.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "users": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "example": 1
          },
          "email": {
            "type": "string",
            "format": "email",
            "example": "alex@example.com"
          },
          "name": {
            "type": "string",
            "example": "Alex Reed"
          },
          "active": {
            "type": "boolean",
            "default": true
          }
        },
        "required": ["id", "email", "name", "active"]
      }
    },
    "total": {
      "type": "integer",
      "example": 1
    }
  },
  "required": ["users", "total"]
}
```

Run it with:

```bash
api-mock-seeder generate examples/user.schema.json --seed 42 --out ./mocks
```

## Postman Collection Example

If a Postman collection contains folders or requests for `users`, `products`, `categories`, and `yards`, the CLI generates one fixture set for each saved JSON response example.

Example file: `examples/resources.collection.json`

Run it with:

```bash
api-mock-seeder generate examples/resources.collection.json --seed 42 --out ./mocks
```

Example output files:

```text
./mocks/users-list-users-200.happy-path.json
./mocks/products-list-products-200.happy-path.json
./mocks/categories-list-categories-200.happy-path.json
./mocks/yards-list-yards-200.happy-path.json
```

## Sample JSON Example

Example `examples/user.json`:

```json
{
  "users": [
    {
      "id": 1,
      "email": "alex@example.com",
      "name": "Alex Reed",
      "active": true
    }
  ],
  "total": 1
}
```

Run it with:

```bash
api-mock-seeder generate examples/user.json --seed 42 --out ./mocks
```

This produces stable fixtures with scenario variations under `./mocks`.

## Notes

- Node.js 18+ required
- use `npx api-mock-seeder` for a no-install workflow
- use `api-mock-seeder` after installing the package on your machine with `npm install -g api-mock-seeder`
- this package is intentionally small and optimized for practical fixture generation
