"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

async function loadInput(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const extension = path.extname(absolutePath).toLowerCase();
  let document;

  if (extension === ".json") {
    try {
      document = JSON.parse(raw);
    } catch (error) {
      throw new Error(`Failed to parse JSON from ${absolutePath}: ${error.message}`);
    }
  } else {
    try {
      const yaml = require("yaml");
      document = yaml.parse(raw);
    } catch (error) {
      try {
        document = JSON.parse(raw);
      } catch {
        if (error.code === "MODULE_NOT_FOUND") {
          throw new Error('Missing dependency "yaml". Run "npm install" before using YAML or OpenAPI inputs.');
        }

        throw new Error(`Failed to parse input file ${absolutePath}: ${error.message}`);
      }
    }
  }

  if (document === undefined) {
    throw new Error(`Input file ${absolutePath} did not contain any data.`);
  }

  return {
    document,
    extension,
    path: absolutePath,
    raw
  };
}

module.exports = {
  loadInput
};
