"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

function buildOutputPath(outDir, targetName, scenario) {
  return path.join(outDir, `${targetName}.${scenario}.json`);
}

async function writeOutput(outputs, outDir) {
  const absoluteOutDir = path.resolve(process.cwd(), outDir);
  await fs.mkdir(absoluteOutDir, { recursive: true });
  const writtenFiles = [];

  for (const output of outputs) {
    const filePath = buildOutputPath(absoluteOutDir, output.target.name, output.scenario);
    const serialized = JSON.stringify(output.data, null, 2);
    await fs.writeFile(filePath, `${serialized}\n`, "utf8");
    writtenFiles.push(filePath);
  }

  return writtenFiles;
}

module.exports = {
  writeOutput
};
