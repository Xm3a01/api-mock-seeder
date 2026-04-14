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

function looksLikeJson(value) {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  return (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  );
}

function getHeaderValue(headers, headerName) {
  if (!Array.isArray(headers)) {
    return undefined;
  }

  const lowerHeaderName = headerName.toLowerCase();

  for (const header of headers) {
    if (!isObject(header) || typeof header.key !== "string") {
      continue;
    }

    if (header.key.toLowerCase() === lowerHeaderName && typeof header.value === "string") {
      return header.value;
    }
  }

  return undefined;
}

function normalizePostmanUrl(url) {
  if (typeof url === "string") {
    return url;
  }

  if (!isObject(url)) {
    return undefined;
  }

  if (typeof url.raw === "string" && url.raw.trim()) {
    return url.raw;
  }

  const host = Array.isArray(url.host) ? url.host.join(".") : typeof url.host === "string" ? url.host : "";
  const routePath = Array.isArray(url.path) && url.path.length ? `/${url.path.join("/")}` : "";

  if (!host && routePath) {
    return routePath;
  }

  if (host || routePath) {
    return `${host}${routePath}`;
  }

  return undefined;
}

function getPostmanRequestMethod(item, response) {
  const method =
    (response &&
      response.originalRequest &&
      typeof response.originalRequest.method === "string" &&
      response.originalRequest.method) ||
    (item && item.request && typeof item.request.method === "string" && item.request.method);

  return method ? method.toUpperCase() : undefined;
}

function getPostmanRequestPath(item, response) {
  const requestUrl =
    (response && response.originalRequest && response.originalRequest.url) ||
    (item && item.request && item.request.url);

  return normalizePostmanUrl(requestUrl);
}

function parsePostmanResponseExample(response) {
  if (!isObject(response)) {
    return undefined;
  }

  if (
    response.body !== undefined &&
    response.body !== null &&
    typeof response.body !== "string"
  ) {
    return response.body;
  }

  if (typeof response.body !== "string") {
    return undefined;
  }

  const contentType = getHeaderValue(response.header, "content-type");
  const previewLanguage =
    typeof response._postman_previewlanguage === "string" ? response._postman_previewlanguage : "";
  const shouldParseJson =
    /json/i.test(contentType || "") ||
    /json/i.test(previewLanguage) ||
    looksLikeJson(response.body);

  if (!shouldParseJson) {
    return undefined;
  }

  try {
    return JSON.parse(response.body);
  } catch {
    return undefined;
  }
}

function buildPostmanTargetName(nameParts, method, routePath, status) {
  const namedOperation = slugify(`${nameParts.filter(Boolean).join("-")}-${status}`);
  const requestFallback = method && routePath ? slugify(`${method}-${routePath}-${status}`) : "";
  return namedOperation || requestFallback || `postman-response-${status}`;
}

function walkPostmanItems(items, ancestors, visit) {
  if (!Array.isArray(items)) {
    return;
  }

  for (const item of items) {
    if (!isObject(item)) {
      continue;
    }

    const nextAncestors = item.name ? [...ancestors, item.name] : ancestors;

    if (Array.isArray(item.item)) {
      walkPostmanItems(item.item, nextAncestors, visit);
    }

    visit(item, nextAncestors);
  }
}

function extractPostmanTargets(document) {
  const targets = [];
  const usedNames = new Map();

  walkPostmanItems(document.item, [], (item, ancestors) => {
    const responses = Array.isArray(item.response) ? item.response : [];

    for (const response of responses) {
      const example = parsePostmanResponseExample(response);

      if (example === undefined) {
        continue;
      }

      const status =
        response && response.code !== undefined
          ? String(response.code)
          : slugify(response && (response.status || response.name || "response"));
      const baseName = buildPostmanTargetName(
        ancestors,
        getPostmanRequestMethod(item, response),
        getPostmanRequestPath(item, response),
        status
      );
      const count = (usedNames.get(baseName) || 0) + 1;
      usedNames.set(baseName, count);

      targets.push({
        example,
        name: count === 1 ? baseName : `${baseName}-${count}`,
        schema: inferSchemaFromSample(example),
        source: {
          kind: "postman-collection",
          method: getPostmanRequestMethod(item, response),
          path: getPostmanRequestPath(item, response),
          status
        }
      });
    }
  });

  if (!targets.length) {
    throw new Error(
      "No JSON example responses were found in the Postman collection. Save at least one JSON response example and export the collection again."
    );
  }

  return targets;
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

  if (inputType === "postman-collection") {
    return extractPostmanTargets(document);
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
