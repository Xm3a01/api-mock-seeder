"use strict";

const {
  isCountLikeField,
  isHasMoreField,
  isPageField,
  isPageSizeField,
  pickEmptyEnumValue
} = require("./scenarios");

const FIRST_NAMES = ["Olivia", "Liam", "Maya", "Noah", "Ava", "Ethan", "Zoe", "Mason"];
const LAST_NAMES = ["Carter", "Nguyen", "Patel", "Reed", "Bennett", "Sato", "Lopez", "Kim"];
const CITIES = ["Austin", "Seattle", "Chicago", "Denver", "Boston", "Atlanta"];
const COUNTRIES = ["United States", "Canada", "Germany", "Japan", "United Kingdom"];
const STATES = ["California", "Texas", "New York", "Washington", "Colorado", "Illinois"];
const COMPANIES = ["Northwind", "Brightside Labs", "MapleWorks", "Blue Harbor", "Summit Cloud"];
const ADJECTIVES = ["amber", "quiet", "rapid", "silver", "bold", "crisp", "steady", "sunny"];
const NOUNS = ["falcon", "river", "forest", "signal", "meadow", "harbor", "pixel", "atlas"];
const STATUS_VALUES = ["active", "pending", "draft", "processing", "complete"];

function cleanFieldName(name) {
  return String(name || "")
    .replace(/\[\d+\]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
}

function splitWords(name) {
  return cleanFieldName(name).split(/\s+/).filter(Boolean);
}

function includesWord(name, candidates) {
  const words = splitWords(name);
  return candidates.some((candidate) => words.includes(candidate));
}

function toTitleCase(input) {
  return String(input)
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function slugify(parts) {
  return parts
    .filter(Boolean)
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function buildSentence(seedTools, key) {
  const subject = seedTools.pick(`${key}:subject`, ADJECTIVES);
  const noun = seedTools.pick(`${key}:noun`, NOUNS);
  const tail = seedTools.pick(`${key}:tail`, [
    "for internal testing.",
    "with deterministic fixture values.",
    "for repeatable mock responses.",
    "that stays stable across runs."
  ]);

  return `${toTitleCase(subject)} ${noun} dataset ${tail}`;
}

function buildTimestamp(seedTools, key) {
  const year = 2024 + seedTools.intFor(`${key}:year`, 0, 2);
  const month = seedTools.intFor(`${key}:month`, 1, 12);
  const day = seedTools.intFor(`${key}:day`, 1, 28);
  const hour = seedTools.intFor(`${key}:hour`, 0, 23);
  const minute = seedTools.intFor(`${key}:minute`, 0, 59);
  const second = seedTools.intFor(`${key}:second`, 0, 59);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
}

function buildDate(seedTools, key) {
  return buildTimestamp(seedTools, key).slice(0, 10);
}

function buildName(seedTools, key) {
  const first = seedTools.pick(`${key}:first`, FIRST_NAMES);
  const last = seedTools.pick(`${key}:last`, LAST_NAMES);
  return `${first} ${last}`;
}

function buildUsername(seedTools, key) {
  return slugify([
    seedTools.pick(`${key}:adjective`, ADJECTIVES),
    seedTools.pick(`${key}:noun`, NOUNS),
    seedTools.intFor(`${key}:number`, 10, 999)
  ]);
}

function buildEmail(seedTools, key) {
  const first = seedTools.pick(`${key}:first`, FIRST_NAMES).toLowerCase();
  const last = seedTools.pick(`${key}:last`, LAST_NAMES).toLowerCase();
  return `${first}.${last}${seedTools.intFor(`${key}:number`, 1, 99)}@example.com`;
}

function buildPhone(seedTools, key) {
  return `+1-202-555-${String(seedTools.intFor(`${key}:suffix`, 1000, 9999)).padStart(4, "0")}`;
}

function buildStreet(seedTools, key) {
  const number = seedTools.intFor(`${key}:number`, 100, 9999);
  const name = toTitleCase(seedTools.pick(`${key}:name`, NOUNS));
  const suffix = seedTools.pick(`${key}:suffix`, ["St", "Ave", "Blvd", "Rd", "Ln"]);
  return `${number} ${name} ${suffix}`;
}

function buildCompany(seedTools, key) {
  return seedTools.pick(`${key}:company`, COMPANIES);
}

function buildUrl(seedTools, key, segment = "resource") {
  return `https://example.com/${segment}/${buildUsername(seedTools, key)}`;
}

function buildImageUrl(seedTools, key) {
  return `https://example.com/images/${buildUsername(seedTools, key)}.jpg`;
}

function buildCurrency(seedTools, key) {
  return seedTools.pick(`${key}:currency`, ["USD", "EUR", "GBP", "AED", "JPY"]);
}

function pickEnumValue(seedTools, key, values, scenario) {
  if (!Array.isArray(values) || values.length === 0) {
    return undefined;
  }

  if (scenario === "empty-state") {
    return pickEmptyEnumValue(values);
  }

  return seedTools.pick(`${key}:enum`, values);
}

function fakeString({ fieldName, schema, scenario, key, seedTools }) {
  const normalized = cleanFieldName(fieldName);
  const format = String(schema.format || "").toLowerCase();

  if (format === "uuid" || includesWord(fieldName, ["uuid"])) {
    return seedTools.uuidFor(key);
  }

  if (format === "email" || includesWord(fieldName, ["email"])) {
    return buildEmail(seedTools, key);
  }

  if (format === "uri" || format === "url" || includesWord(fieldName, ["url", "link", "website"])) {
    return buildUrl(seedTools, key, "links");
  }

  if (includesWord(fieldName, ["avatar", "image", "photo", "thumbnail"])) {
    return buildImageUrl(seedTools, key);
  }

  if (format === "date-time" || includesWord(fieldName, ["created", "updated", "timestamp", "datetime"])) {
    return buildTimestamp(seedTools, key);
  }

  if (format === "date" || includesWord(fieldName, ["date", "birthday", "dob"])) {
    return buildDate(seedTools, key);
  }

  if (includesWord(fieldName, ["phone", "mobile", "tel"])) {
    return buildPhone(seedTools, key);
  }

  if (includesWord(fieldName, ["first", "firstname", "given"])) {
    return seedTools.pick(`${key}:first-name`, FIRST_NAMES);
  }

  if (includesWord(fieldName, ["last", "lastname", "family", "surname"])) {
    return seedTools.pick(`${key}:last-name`, LAST_NAMES);
  }

  if (normalized === "name" || includesWord(fieldName, ["fullname", "full", "display"])) {
    return buildName(seedTools, key);
  }

  if (includesWord(fieldName, ["username", "handle", "slug"])) {
    return buildUsername(seedTools, key);
  }

  if (includesWord(fieldName, ["street", "address"])) {
    return buildStreet(seedTools, key);
  }

  if (includesWord(fieldName, ["city"])) {
    return seedTools.pick(`${key}:city`, CITIES);
  }

  if (includesWord(fieldName, ["country"])) {
    return seedTools.pick(`${key}:country`, COUNTRIES);
  }

  if (includesWord(fieldName, ["state", "province", "region"])) {
    return seedTools.pick(`${key}:state`, STATES);
  }

  if (includesWord(fieldName, ["postal", "zip"])) {
    return String(seedTools.intFor(`${key}:postal`, 10000, 99999));
  }

  if (includesWord(fieldName, ["company", "organization", "org"])) {
    return buildCompany(seedTools, key);
  }

  if (includesWord(fieldName, ["status", "state"])) {
    if (scenario === "empty-state") {
      return "empty";
    }

    return seedTools.pick(`${key}:status`, STATUS_VALUES);
  }

  if (includesWord(fieldName, ["description", "summary", "bio", "message", "notes"])) {
    return buildSentence(seedTools, key);
  }

  if (includesWord(fieldName, ["title", "label"])) {
    return toTitleCase(
      `${seedTools.pick(`${key}:adjective`, ADJECTIVES)} ${seedTools.pick(`${key}:noun`, NOUNS)}`
    );
  }

  if (includesWord(fieldName, ["token", "secret", "apikey", "api", "key"])) {
    return seedTools.hexFor(`${key}:token`, 24);
  }

  if (includesWord(fieldName, ["currency"])) {
    return buildCurrency(seedTools, key);
  }

  if (includesWord(fieldName, ["locale", "language"])) {
    return seedTools.pick(`${key}:locale`, ["en-US", "en-GB", "de-DE", "ja-JP"]);
  }

  return `${slugify([
    fieldName || "value",
    seedTools.pick(`${key}:suffix-word`, ADJECTIVES),
    seedTools.intFor(`${key}:suffix-number`, 10, 999)
  ])}`;
}

function fakeNumber({ fieldName, schema, scenario, key, seedTools, integer }) {
  if (isPageField(fieldName)) {
    return 1;
  }

  if (isPageSizeField(fieldName)) {
    return scenario === "large-dataset" ? 50 : 10;
  }

  if (isCountLikeField(fieldName)) {
    if (scenario === "empty-state") {
      return 0;
    }

    return scenario === "large-dataset" ? 250 : 3;
  }

  if (includesWord(fieldName, ["age"])) {
    return seedTools.intFor(`${key}:age`, 18, 75);
  }

  if (includesWord(fieldName, ["price", "amount", "cost", "subtotal", "total"])) {
    const value = seedTools.floatFor(`${key}:money`, 9, 999, 2);
    return integer ? Math.round(value) : value;
  }

  if (includesWord(fieldName, ["rating", "score"])) {
    const value = seedTools.floatFor(`${key}:rating`, 1, 5, 1);
    return integer ? Math.round(value) : value;
  }

  if (includesWord(fieldName, ["latitude"])) {
    return seedTools.floatFor(`${key}:lat`, -90, 90, 6);
  }

  if (includesWord(fieldName, ["longitude", "lng"])) {
    return seedTools.floatFor(`${key}:lng`, -180, 180, 6);
  }

  if (includesWord(fieldName, ["percent", "percentage", "progress"])) {
    const value = seedTools.floatFor(`${key}:percent`, 0, 100, 1);
    return integer ? Math.round(value) : value;
  }

  if (includesWord(fieldName, ["id"])) {
    return seedTools.intFor(`${key}:id`, 1, 100000);
  }

  if (integer) {
    return seedTools.intFor(`${key}:int`, 1, 1000);
  }

  return seedTools.floatFor(`${key}:float`, 1, 1000, 2);
}

function fakeBoolean({ fieldName, scenario, key, seedTools }) {
  if (isHasMoreField(fieldName)) {
    return scenario === "large-dataset";
  }

  if (includesWord(fieldName, ["active", "enabled", "verified", "available", "success"])) {
    return scenario !== "empty-state";
  }

  if (includesWord(fieldName, ["deleted", "archived", "disabled"])) {
    return scenario === "empty-state";
  }

  return seedTools.booleanFor(`${key}:bool`, 0.6);
}

function fakePrimitive(options) {
  const { schema = {}, fieldName = "value", scenario, seedTools } = options;
  const key = options.key || fieldName;

  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return pickEnumValue(seedTools, key, schema.enum, scenario);
  }

  if (schema.const !== undefined) {
    return schema.const;
  }

  if (schema.default !== undefined && scenario === "happy-path") {
    return schema.default;
  }

  const type = schema.type;

  if (type === "boolean") {
    return fakeBoolean({ fieldName, scenario, key, seedTools });
  }

  if (type === "integer") {
    return fakeNumber({ fieldName, schema, scenario, key, seedTools, integer: true });
  }

  if (type === "number") {
    return fakeNumber({ fieldName, schema, scenario, key, seedTools, integer: false });
  }

  if (type === "null") {
    return null;
  }

  return fakeString({ fieldName, schema, scenario, key, seedTools });
}

module.exports = {
  fakePrimitive
};
