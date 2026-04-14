"use strict";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isOpenApiDocument(document) {
  return isObject(document) && (typeof document.openapi === "string" || typeof document.swagger === "string");
}

function hasPostmanCollectionItems(items) {
  if (!Array.isArray(items)) {
    return false;
  }

  return items.some((item) => {
    if (!isObject(item)) {
      return false;
    }

    if (isObject(item.request) || Array.isArray(item.response)) {
      return true;
    }

    return hasPostmanCollectionItems(item.item);
  });
}

function isPostmanCollectionDocument(document) {
  if (!isObject(document) || !isObject(document.info) || !Array.isArray(document.item)) {
    return false;
  }

  if (
    typeof document.info.schema === "string" &&
    /schema\.getpostman\.com\/json\/collection/i.test(document.info.schema)
  ) {
    return true;
  }

  return hasPostmanCollectionItems(document.item);
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

  if (isPostmanCollectionDocument(document)) {
    return "postman-collection";
  }

  if (isJsonSchemaDocument(document)) {
    return "json-schema";
  }

  return "sample-json";
}

module.exports = {
  detectInputType
};
