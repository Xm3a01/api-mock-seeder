"use strict";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOpenApiDocument(document) {
  return isObject(document) && (typeof document.openapi === "string" || typeof document.swagger === "string");
}

function isJsonSchemaDocument(document) {
  if (!isObject(document)) {
    return false;
  }

  const schemaKeys = [
    "$schema",
    "$id",
    "$defs",
    "definitions",
    "properties",
    "required",
    "items",
    "allOf",
    "anyOf",
    "oneOf",
    "additionalProperties",
    "patternProperties",
    "enum"
  ];

  return schemaKeys.some((key) => Object.prototype.hasOwnProperty.call(document, key));
}

function detectInputType(document) {
  if (isOpenApiDocument(document)) {
    return "openapi";
  }

  if (isJsonSchemaDocument(document)) {
    return "json-schema";
  }

  return "sample-json";
}

module.exports = {
  detectInputType
};
