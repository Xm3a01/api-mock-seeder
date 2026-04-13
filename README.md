# api-mock-seeder

`api-mock-seeder` is a small Node.js CLI for generating deterministic mock API data from:

- OpenAPI documents
- JSON Schema files
- sample JSON files

It is built for stable fixture generation, not for serving mock endpoints. The same input plus the same seed produces the same output.

## Install

### npm

```bash
npm install
npm link
```

### pnpm

```bash
pnpm install
pnpm link --global
```

## Usage

```bash
api-mock-seeder generate openapi.yaml --seed 42 --out ./mocks
```

## Test With Docker

Build the image:

```bash
docker build -t api-mock-seeder .
```

Run the CLI against files in your current folder by mounting the project into the container:

```bash
docker run --rm -v "$PWD:/work" -w /work api-mock-seeder generate openapi.yaml --seed 42 --out ./mocks
```

That writes generated fixtures back to your local `./mocks` folder.

To test a sample JSON file instead:

```bash
docker run --rm -v "$PWD:/work" -w /work api-mock-seeder generate ./examples/user.json --seed demo --out ./mocks
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

## What It Generates

For each target, the CLI writes pretty JSON files such as:

```text
./mocks/list-users-200.happy-path.json
./mocks/list-users-200.empty-state.json
./mocks/list-users-200.large-dataset.json
```

OpenAPI inputs generate one file per detected JSON response schema. JSON Schema and sample JSON inputs generate one target based on the input file name.

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

### Sample JSON

- infers a schema from the sample structure
- treats sample values as examples

## Example

Given:

```json
{
  "users": [
    {
      "id": 1,
      "email": "alex@example.com",
      "name": "Alex Reed"
    }
  ],
  "total": 1
}
```

`api-mock-seeder generate users.json --seed 42 --out ./mocks` produces stable fixtures with scenario variations under `./mocks`.

## Notes

- Node.js 18+ recommended
- YAML and OpenAPI parsing depends on the bundled `yaml` package, so install dependencies first
- `npm` is the default workflow, but `pnpm` works too
- Docker testing uses the included `Dockerfile` and does not require `npm link`
- this package is intentionally small and optimized for practical fixture generation
