"use strict";

const SCENARIOS = ["happy-path", "empty-state", "large-dataset"];

function normalizeScenarios(value) {
  if (!value || value === "all") {
    return [...SCENARIOS];
  }

  const input = Array.isArray(value) ? value : String(value).split(",");
  const normalized = [];

  for (const entry of input) {
    const scenario = String(entry).trim();

    if (!scenario) {
      continue;
    }

    if (!SCENARIOS.includes(scenario)) {
      throw new Error(
        `Unsupported scenario "${scenario}". Use one of: ${SCENARIOS.join(", ")}.`
      );
    }

    if (!normalized.includes(scenario)) {
      normalized.push(scenario);
    }
  }

  return normalized.length ? normalized : [...SCENARIOS];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getArrayLength({ schema = {}, scenario, depth = 0, example }) {
  if (scenario === "empty-state") {
    return 0;
  }

  const exampleLength = Array.isArray(example) ? example.length : undefined;
  const minItems = Number.isInteger(schema.minItems) ? schema.minItems : 0;
  const maxItems = Number.isInteger(schema.maxItems) ? schema.maxItems : undefined;
  let targetLength;

  if (scenario === "large-dataset") {
    const baseline = depth === 0 ? 25 : 6;
    targetLength = Math.max(exampleLength || 0, baseline);
  } else if (typeof exampleLength === "number") {
    targetLength = exampleLength;
  } else {
    targetLength = depth === 0 ? 2 : 1;
  }

  const withMin = Math.max(minItems, targetLength);

  if (typeof maxItems === "number") {
    return clamp(withMin, minItems, maxItems);
  }

  return withMin;
}

function isCountLikeField(name) {
  return /(count|total|size|length|pages|results|records|items)$/i.test(String(name));
}

function isPageField(name) {
  return /^(page|pageNumber|currentPage)$/i.test(String(name));
}

function isPageSizeField(name) {
  return /^(pageSize|perPage|limit)$/i.test(String(name));
}

function isHasMoreField(name) {
  return /^(hasMore|hasNext|hasNextPage)$/i.test(String(name));
}

function pickEmptyEnumValue(values) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const preferred = ["empty", "none", "inactive", "disabled", "draft"];

  for (const choice of preferred) {
    const match = values.find((value) => String(value).toLowerCase() === choice);

    if (match !== undefined) {
      return match;
    }
  }

  return values[0];
}

module.exports = {
  SCENARIOS,
  getArrayLength,
  isCountLikeField,
  isHasMoreField,
  isPageField,
  isPageSizeField,
  normalizeScenarios,
  pickEmptyEnumValue
};
