"use strict";

const { detectInputType } = require("./detect-input-type");
const { extractSchema } = require("./extract-schema");
const { generateTargets } = require("./generate");
const { loadInput } = require("./load-input");
const { normalizeSeed } = require("./seed");
const { normalizeScenarios, SCENARIOS } = require("./scenarios");
const { writeOutput } = require("./write-output");

function usage() {
  return [
    "api-mock-seeder",
    "",
    "Generate deterministic mock API response files from OpenAPI, Postman collections, JSON Schema, or sample JSON.",
    "",
    "Usage:",
    "  api-mock-seeder generate <input-file> [--seed 42] [--out ./mocks] [--scenario happy-path]",
    "",
    "Options:",
    "  --seed <value>       Seed for deterministic output. Defaults to 1.",
    "  --out <dir>          Output directory. Defaults to ./mocks.",
    `  --scenario <name>    One of: ${SCENARIOS.join(", ")}, or a comma-separated list.`,
    "  --help               Show this help message."
  ].join("\n");
}

function readOptionValue(args, index, flag) {
  const inlinePrefix = `${flag}=`;
  const current = args[index];

  if (current.startsWith(inlinePrefix)) {
    return {
      nextIndex: index,
      value: current.slice(inlinePrefix.length)
    };
  }

  const next = args[index + 1];

  if (!next || next.startsWith("-")) {
    throw new Error(`Missing value for ${flag}.`);
  }

  return {
    nextIndex: index + 1,
    value: next
  };
}

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv : [];
  const command = args[0];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    return { help: true };
  }

  if (command !== "generate") {
    throw new Error(`Unknown command "${command}".\n\n${usage()}`);
  }

  const inputPath = args[1];

  if (inputPath === "--help" || inputPath === "-h") {
    return { help: true };
  }

  if (!inputPath || inputPath.startsWith("-")) {
    throw new Error(`Missing input file.\n\n${usage()}`);
  }

  const parsed = {
    command,
    inputPath,
    outDir: "./mocks",
    scenarios: [...SCENARIOS],
    seed: "1"
  };

  for (let index = 2; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }

    if (arg === "--seed" || arg.startsWith("--seed=")) {
      const result = readOptionValue(args, index, "--seed");
      parsed.seed = normalizeSeed(result.value);
      index = result.nextIndex;
      continue;
    }

    if (arg === "--out" || arg.startsWith("--out=")) {
      const result = readOptionValue(args, index, "--out");
      parsed.outDir = result.value;
      index = result.nextIndex;
      continue;
    }

    if (arg === "--scenario" || arg.startsWith("--scenario=")) {
      const result = readOptionValue(args, index, "--scenario");
      parsed.scenarios = normalizeScenarios(result.value);
      index = result.nextIndex;
      continue;
    }

    throw new Error(`Unknown option "${arg}".\n\n${usage()}`);
  }

  return parsed;
}

async function generateCommand(options) {
  const loaded = await loadInput(options.inputPath);
  const inputType = detectInputType(loaded.document);
  const targets = extractSchema({
    document: loaded.document,
    inputPath: loaded.path,
    inputType
  });
  const outputs = generateTargets(targets, {
    scenarios: options.scenarios,
    seed: options.seed
  });
  const writtenFiles = await writeOutput(outputs, options.outDir);

  console.log(`Generated ${writtenFiles.length} fixture file(s) from ${inputType} input.`);

  for (const filePath of writtenFiles) {
    console.log(`- ${filePath}`);
  }
}

async function run(argv) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    console.log(usage());
    return;
  }

  if (parsed.command === "generate") {
    await generateCommand(parsed);
  }
}

module.exports = {
  run
};
