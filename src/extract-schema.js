"use strict";

const path = require("node:path");

const HTTP_METHODS = ["get", "post", "put", "patch", "delete", "options", "head"];

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepClone(value) {
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item));
  }

  if (isObject(value)) {
    const clone = {};

    for (const [key, entry] of Object.entries(value)) {
      clone[key] = deepClone(entry);
    }

    return clone;
  }

  return value;
}

function slugify(value) {
  return String(value)
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1-$2")
    .replace(/[{}]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .toLowerCase();
}

function fileBaseName(inputPath) {
  return slugify(path.basename(inputPath, path.extname(inputPath)));
}

function resolvePointer(root, pointer) {
  if (!pointer.startsWith("#/")) {
    throw new Error(`Only local $ref pointers are supported in this MVP. Received: ${pointer}`);
  }

  const parts = pointer.slice(2).split("/").map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"));
  let current = root;

  for (const part of parts) {
    if (!isObject(current) && !Array.isArray(current)) {
      throw new Error(`Could not resolve $ref pointer "${pointer}".`);
    }

    current = current[part];

    if (current === undefined) {
      throw new Error(`Could not resolve $ref pointer "${pointer}".`);
    }
  }

  return current;
}

function mergeSchemas(base, extension) {
  if (!isObject(base) || !isObject(extension)) {
    return extension === undefined ? base : extension;
  }

  const merged = deepClone(base);

  for (const [key, value] of Object.entries(extension)) {
    if (key === "required" && Array.isArray(merged.required) && Array.isArray(value)) {
      merged.required = Array.from(new Set([...merged.required, ...value]));
      continue;
    }

    if (key === "properties" && isObject(merged.properties) && isObject(value)) {
      merged.properties = {
        ...merged.properties,
        ...value
      };
      continue;
    }

    merged[key] = deepClone(value);
  }

  return merged;
}

function resolveRefs(value, root, seen = new Set()) {
  if (Array.isArray(value)) {
    return value.map((item) => resolveRefs(item, root, seen));
  }

  if (!isObject(value)) {
    return value;
  }

  if (value.$ref) {
    if (seen.has(value.$ref)) {
      return { type: "object" };
    }

    const nextSeen = new Set(seen);
    nextSeen.add(value.$ref);
    const resolved = resolveRefs(resolvePointer(root, value.$ref), root, nextSeen);
    const siblings = { ...value };
    delete siblings.$ref;
    return resolveRefs(mergeSchemas(resolved, siblings), root, nextSeen);
  }

  const resolvedObject = {};

  for (const [key, entry] of Object.entries(value)) {
    resolvedObject[key] = resolveRefs(entry, root, seen);
  }

  return resolvedObject;
}

function firstExampleValue(value) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.length ? value[0] : undefined;
  }

  if (isObject(value)) {
    if (Object.prototype.hasOwnProperty.call(value, "value")) {
      return value.value;
    }

    const firstEntry = Object.values(value)[0];

    if (firstEntry && isObject(firstEntry) && Object.prototype.hasOwnProperty.call(firstEntry, "value")) {
      return firstEntry.value;
    }
  }

  return value;
}

function firstNamedExample(value) {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value.length ? firstExampleValue(value[0]) : undefined;
  }

  if (isObject(value)) {
    const firstEntry = Object.values(value)[0];
    return firstExampleValue(firstEntry);
  }

  return firstExampleValue(value);
}

function detectStringFormat(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    return "uuid";
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "email";
  }

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return "date-time";
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "date";
  }

  if (/^https?:\/\//.test(value)) {
    return "uri";
  }

  return undefined;
}

function inferSchemaFromSample(sample) {
  if (sample === null) {
    return {
      type: "null",
      example: null
    };
  }

  if (Array.isArray(sample)) {
    const firstDefined = sample.find((item) => item !== undefined);

    return {
      type: "array",
      items: inferSchemaFromSample(firstDefined === undefined ? "" : firstDefined),
      example: sample
    };
  }

  if (isObject(sample)) {
    const properties = {};

    for (const [key, value] of Object.entries(sample)) {
      properties[key] = inferSchemaFromSample(value);
    }

    return {
      type: "object",
      properties,
      required: Object.keys(properties),
      example: sample
    };
  }

  if (typeof sample === "number") {
    return {
      type: Number.isInteger(sample) ? "integer" : "number",
      example: sample
    };
  }

  if (typeof sample === "boolean") {
    return {
      type: "boolean",
      example: sample
    };
  }

  const schema = {
    type: "string",
    example: sample
  };
  const format = detectStringFormat(sample);

  if (format) {
    schema.format = format;
  }

  return schema;
}

function pickJsonMediaType(content = {}) {
  const entries = Object.entries(content);
  const direct = entries.find(([mediaType]) => /(^application\/json$|\+json$|\/json$)/i.test(mediaType));

  if (direct) {
    return direct[1];
  }

  const wildcard = entries.find(([mediaType]) => /json/i.test(mediaType));
  return wildcard ? wildcard[1] : undefined;
}

function pickResponseEntries(responses = {}) {
  const entries = Object.entries(responses);
  const successEntries = entries.filter(([status]) => /^2\d\d$/.test(String(status)) || status === "default");
  return successEntries.length ? successEntries : entries;
}

function pickExampleFromResponse(mediaType, schema, response) {
  return (
    firstExampleValue(mediaType && mediaType.example) ??
    firstNamedExample(mediaType && mediaType.examples) ??
    firstExampleValue(schema && schema.example) ??
    firstNamedExample(schema && schema.examples) ??
    firstExampleValue(response && response.example) ??
    firstNamedExample(response && response.examples)
  );
}

function buildOperationName(method, routePath, status, operation) {
  const operationId = operation && operation.operationId ? slugify(operation.operationId) : "";
  const fallback = slugify(`${method}-${routePath}-${status}`);
  const namedOperation = operationId ? slugify(`${operationId}-${status}`) : "";
  return namedOperation || fallback || `response-${status}`;
}

function extractOpenApiTargets(document, inputPath) {
  const targets = [];

  for (const [routePath, pathItem] of Object.entries(document.paths || {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem && pathItem[method];

      if (!operation) {
        continue;
      }

      for (const [status, response] of pickResponseEntries(operation.responses || {})) {
        const mediaType = pickJsonMediaType(response && response.content);

        if (!mediaType) {
          continue;
        }

        const rawSchema = mediaType.schema ? resolveRefs(mediaType.schema, document) : undefined;
        const example = pickExampleFromResponse(mediaType, rawSchema, response);
        const schema = rawSchema || (example !== undefined ? inferSchemaFromSample(example) : undefined);

        if (!schema) {
          continue;
        }

        targets.push({
          example,
          name: buildOperationName(method, routePath, status, operation),
          schema,
          source: {
            method: method.toUpperCase(),
            path: routePath,
            status
          }
        });
      }
    }
  }

  if (!targets.length) {
    throw new Error("No JSON response schemas were found in the OpenAPI document.");
  }

  return targets;
}

function extractSchema({ document, inputType, inputPath }) {
  if (inputType === "openapi") {
    return extractOpenApiTargets(document, inputPath);
  }

  if (inputType === "json-schema") {
    return [
      {
        example: firstExampleValue(document.example) ?? firstNamedExample(document.examples),
        name: fileBaseName(inputPath),
        schema: resolveRefs(document, document),
        source: {
          kind: "json-schema"
        }
      }
    ];
  }

  return [
    {
      example: document,
      name: fileBaseName(inputPath),
      schema: inferSchemaFromSample(document),
      source: {
        kind: "sample-json"
      }
    }
  ];
}

module.exports = {
  extractSchema,
  inferSchemaFromSample,
  resolveRefs
};
