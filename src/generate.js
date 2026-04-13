"use strict";

const { inferSchemaFromSample } = require("./extract-schema");
const { fakePrimitive } = require("./fakers");
const { createSeedTools } = require("./seed");
const { getArrayLength } = require("./scenarios");

const MAX_DEPTH = 8;

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

function normalizeExample(schema, example) {
  if (example !== undefined) {
    return example;
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  if (Array.isArray(schema.examples) && schema.examples.length > 0) {
    const first = schema.examples[0];
    return isObject(first) && Object.prototype.hasOwnProperty.call(first, "value") ? first.value : first;
  }

  if (isObject(schema.examples)) {
    const first = Object.values(schema.examples)[0];

    if (first && isObject(first) && Object.prototype.hasOwnProperty.call(first, "value")) {
      return first.value;
    }

    return first;
  }

  return undefined;
}

function resolveType(schema, example) {
  if (Array.isArray(schema.type)) {
    return schema.type.find((entry) => entry !== "null") || schema.type[0];
  }

  if (schema.type) {
    return schema.type;
  }

  if (Array.isArray(example)) {
    return "array";
  }

  if (example === null) {
    return "null";
  }

  if (isObject(example)) {
    return "object";
  }

  if (typeof example === "number") {
    return Number.isInteger(example) ? "integer" : "number";
  }

  if (typeof example === "boolean") {
    return "boolean";
  }

  if (typeof example === "string") {
    return "string";
  }

  return "string";
}

function mergeAllOf(allOf) {
  return allOf.reduce(
    (merged, entry) => ({
      ...merged,
      ...entry,
      properties: {
        ...(merged.properties || {}),
        ...((entry && entry.properties) || {})
      },
      required: Array.from(new Set([...(merged.required || []), ...((entry && entry.required) || [])]))
    }),
    {}
  );
}

function chooseCompositeSchema(schema, seedTools, key) {
  if (Array.isArray(schema.allOf) && schema.allOf.length > 0) {
    return mergeAllOf(schema.allOf);
  }

  const variants = schema.oneOf || schema.anyOf;

  if (Array.isArray(variants) && variants.length > 0) {
    return variants[seedTools.intFor(`${key}:variant`, 0, variants.length - 1)];
  }

  return schema;
}

function shouldUseLiteralExample({ scenario, forceSynthetic }) {
  return scenario === "happy-path" && !forceSynthetic;
}

function buildSchemaFromExample(example) {
  if (example === undefined) {
    return {};
  }

  return inferSchemaFromSample(example);
}

function generateValue(schema, context) {
  const normalizedSchema = chooseCompositeSchema(schema || {}, context.seedTools, context.key);
  const example = normalizeExample(normalizedSchema, context.example);
  const type = resolveType(normalizedSchema, example);

  if (context.depth > MAX_DEPTH) {
    return type === "array" ? [] : type === "object" ? {} : null;
  }

  if (example === null && shouldUseLiteralExample(context)) {
    return null;
  }

  if (type === "object") {
    if (shouldUseLiteralExample(context) && isObject(example) && Object.keys(normalizedSchema.properties || {}).length === 0) {
      return deepClone(example);
    }

    const inferred = buildSchemaFromExample(example);
    const propertySchemas = normalizedSchema.properties || inferred.properties || {};
    const result = {};

    for (const key of Object.keys(propertySchemas)) {
      const propertySchema = propertySchemas[key] || {};
      const propertyExample = isObject(example) ? example[key] : undefined;

      result[key] = generateValue(propertySchema, {
        ...context,
        depth: context.depth + 1,
        example: propertyExample,
        fieldName: key,
        forceSynthetic: context.forceSynthetic,
        key: `${context.key}.${key}`
      });
    }

    if (Object.keys(result).length === 0 && isObject(example) && shouldUseLiteralExample(context)) {
      return deepClone(example);
    }

    if (Object.keys(result).length === 0 && normalizedSchema.additionalProperties) {
      for (let index = 0; index < 2; index += 1) {
        const dynamicKey = `key${index + 1}`;
        result[dynamicKey] = generateValue(normalizedSchema.additionalProperties, {
          ...context,
          depth: context.depth + 1,
          fieldName: dynamicKey,
          forceSynthetic: false,
          key: `${context.key}.${dynamicKey}`
        });
      }
    }

    return result;
  }

  if (type === "array") {
    if (shouldUseLiteralExample(context) && Array.isArray(example) && !normalizedSchema.items) {
      return deepClone(example);
    }

    const itemSchema =
      normalizedSchema.items ||
      (Array.isArray(example) && example.length > 0
        ? buildSchemaFromExample(example[0])
        : { type: "string" });

    const length = getArrayLength({
      depth: context.depth,
      example,
      scenario: context.scenario,
      schema: normalizedSchema
    });
    const exampleItems = Array.isArray(example) ? example : [];
    const output = [];

    for (let index = 0; index < length; index += 1) {
      const itemExample = exampleItems[index];
      const beyondExamples = index >= exampleItems.length;

      output.push(
        generateValue(itemSchema, {
          ...context,
          depth: context.depth + 1,
          example: itemExample,
          fieldName: context.fieldName,
          forceSynthetic:
            context.forceSynthetic ||
            context.scenario === "large-dataset" ||
            beyondExamples,
          key: `${context.key}[${index}]`
        })
      );
    }

    return output;
  }

  if (shouldUseLiteralExample(context) && example !== undefined) {
    return deepClone(example);
  }

  if (normalizedSchema.nullable && context.scenario === "empty-state") {
    return null;
  }

  return fakePrimitive({
    example,
    fieldName: context.fieldName,
    key: context.key,
    scenario: context.scenario,
    schema: {
      ...normalizedSchema,
      type
    },
    seedTools: context.seedTools
  });
}

function generateTargets(targets, options = {}) {
  const seedTools = createSeedTools(options.seed);
  const scenarios = Array.isArray(options.scenarios) ? options.scenarios : ["happy-path"];
  const outputs = [];

  for (const target of targets) {
    for (const scenario of scenarios) {
      const data = generateValue(target.schema, {
        depth: 0,
        example: target.example,
        fieldName: target.name,
        forceSynthetic: false,
        key: `${target.name}:${scenario}`,
        scenario,
        seedTools
      });

      outputs.push({
        data,
        scenario,
        target
      });
    }
  }

  return outputs;
}

module.exports = {
  generateTargets
};
