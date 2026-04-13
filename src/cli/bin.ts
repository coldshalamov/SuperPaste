#!/usr/bin/env node

import { runSuperPasteCli } from "./commands.js";

const exitCode = await runSuperPasteCli(process.argv.slice(2), {
  stdout: (line) => console.log(line),
  stderr: (line) => console.error(line),
});

process.exit(exitCode);
