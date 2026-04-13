"use strict";

function normalizeSeed(seed) {
  if (seed === undefined || seed === null || seed === "") {
    return "1";
  }

  return String(seed);
}

function hashString(value) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed) {
  let state = seed >>> 0;

  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function createSeedTools(seed) {
  const normalizedSeed = normalizeSeed(seed);

  function numberFor(key) {
    return mulberry32(hashString(`${normalizedSeed}:${key}`))();
  }

  function intFor(key, min, max) {
    const safeMin = Number.isFinite(min) ? Math.floor(min) : 0;
    const safeMax = Number.isFinite(max) ? Math.floor(max) : safeMin;
    const lower = Math.min(safeMin, safeMax);
    const upper = Math.max(safeMin, safeMax);
    return lower + Math.floor(numberFor(key) * (upper - lower + 1));
  }

  function floatFor(key, min, max, precision = 2) {
    const lower = Number.isFinite(min) ? min : 0;
    const upper = Number.isFinite(max) ? max : 1;
    const value = lower + numberFor(key) * (upper - lower);
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  function booleanFor(key, probability = 0.5) {
    return numberFor(key) < probability;
  }

  function pick(key, values) {
    if (!Array.isArray(values) || values.length === 0) {
      return undefined;
    }

    return values[intFor(key, 0, values.length - 1)];
  }

  function hexFor(key, length = 8) {
    const alphabet = "0123456789abcdef";
    let output = "";

    for (let index = 0; index < length; index += 1) {
      output += alphabet[intFor(`${key}:hex:${index}`, 0, alphabet.length - 1)];
    }

    return output;
  }

  function uuidFor(key) {
    const hex = hexFor(`${key}:uuid`, 32).split("");
    hex[12] = "4";
    hex[16] = ["8", "9", "a", "b"][intFor(`${key}:uuid:variant`, 0, 3)];
    return [
      hex.slice(0, 8).join(""),
      hex.slice(8, 12).join(""),
      hex.slice(12, 16).join(""),
      hex.slice(16, 20).join(""),
      hex.slice(20, 32).join("")
    ].join("-");
  }

  return {
    seed: normalizedSeed,
    booleanFor,
    floatFor,
    hashString,
    hexFor,
    intFor,
    numberFor,
    pick,
    uuidFor
  };
}

module.exports = {
  createSeedTools,
  hashString,
  normalizeSeed
};
