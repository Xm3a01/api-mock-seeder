#!/usr/bin/env node

const { run } = require("../src/cli");

run(process.argv.slice(2)).catch((error) => {
  console.error(`api-mock-seeder: ${error.message}`);

  if (process.env.DEBUG && error.stack) {
    console.error(error.stack);
  }

  process.exit(1);
});
