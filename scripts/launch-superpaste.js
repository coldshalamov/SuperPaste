import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const WINDOWS_PATH_DELIMITER = ";";

export function normalizeBooleanFlag(value) {
  return value === "1" || value === "true";
}

export function prependPathEntry(pathValue, entry) {
  if (!entry) {
    return pathValue ?? "";
  }

  const current = pathValue ?? "";
  const pieces = current
    .split(WINDOWS_PATH_DELIMITER)
    .map((piece) => piece.trim())
    .filter(Boolean);

  if (pieces.some((piece) => piece.toLowerCase() === entry.toLowerCase())) {
    return current;
  }

  return pieces.length > 0
    ? `${entry}${WINDOWS_PATH_DELIMITER}${pieces.join(WINDOWS_PATH_DELIMITER)}`
    : entry;
}

export function findCargoHome(env = process.env, homeDir = os.homedir()) {
  const userProfile = env.USERPROFILE || homeDir;
  return {
    cargoBinDir: path.join(userProfile, ".cargo", "bin"),
    cargoExePath: path.join(userProfile, ".cargo", "bin", "cargo.exe"),
  };
}

export function commandExists(command, env) {
  const result = spawnSync("where.exe", [command], {
    env,
    shell: false,
    stdio: "pipe",
    windowsHide: true,
    encoding: "utf8",
  });

  return result.status === 0;
}

export function createLaunchSnapshot({
  repoRoot,
  env = process.env,
  exists = fs.existsSync,
  forceDev = false,
  homeDir = os.homedir(),
  commandExistsImpl = commandExists,
}) {
  const releaseExe = path.join(
    repoRoot,
    "src-tauri",
    "target",
    "release",
    "superpaste.exe",
  );
  const nodeModulesDir = path.join(repoRoot, "node_modules");
  const { cargoBinDir, cargoExePath } = findCargoHome(env, homeDir);
  const normalizedPath = env.PATH ?? "";
  const npmAvailable = commandExistsImpl("npm.cmd", env) || commandExistsImpl("npm", env);
  const cargoAvailable = commandExistsImpl("cargo.exe", env) || commandExistsImpl("cargo", env);
  const defaultCargoExists = exists(cargoExePath);
  const releaseExists = exists(releaseExe);
  const nodeModulesExists = exists(nodeModulesDir);

  return {
    repoRoot,
    releaseExe,
    nodeModulesDir,
    cargoBinDir,
    cargoExePath,
    npmAvailable,
    cargoAvailable,
    defaultCargoExists,
    releaseExists,
    nodeModulesExists,
    forceDev,
    normalizedPath,
  };
}

export function chooseLaunchPlan(snapshot) {
  const plan = {
    action: "error",
    repoRoot: snapshot.repoRoot,
    releaseExe: snapshot.releaseExe,
    installDependencies: false,
    repairedCargoPath: false,
    envPath: snapshot.normalizedPath,
    messageLines: [],
  };

  if (snapshot.releaseExists && !snapshot.forceDev) {
    return {
      ...plan,
      action: "launch-release",
      messageLines: ["Launching existing release build."],
    };
  }

  if (!snapshot.npmAvailable) {
    return {
      ...plan,
      action: "error",
      messageLines: [
        "Node.js/npm was not found on PATH.",
        "Install Node.js, then run:",
        "  npm install",
        "  launch-superpaste.cmd",
      ],
    };
  }

  let envPath = snapshot.normalizedPath;
  let cargoReady = snapshot.cargoAvailable;
  let repairedCargoPath = false;

  if (!cargoReady && snapshot.defaultCargoExists) {
    envPath = prependPathEntry(snapshot.normalizedPath, snapshot.cargoBinDir);
    cargoReady = true;
    repairedCargoPath = true;
  }

  if (!cargoReady) {
    return {
      ...plan,
      action: "error",
      envPath,
      messageLines: [
        "Rust/Cargo was not found, so Tauri dev mode cannot start.",
        "Install Rust with rustup, or add Cargo to PATH:",
        `  ${snapshot.cargoBinDir}`,
        "Then re-run launch-superpaste.cmd.",
      ],
    };
  }

  return {
    ...plan,
    action: snapshot.forceDev ? "run-dev" : "build-release",
    envPath,
    repairedCargoPath,
    installDependencies: !snapshot.nodeModulesExists,
    messageLines: [
      repairedCargoPath
        ? "Added Cargo to PATH from the default rustup install."
        : "Cargo was already available on PATH.",
      !snapshot.nodeModulesExists
        ? "Dependencies are missing and will be installed first."
        : "Dependencies are already installed.",
      snapshot.forceDev
        ? "Starting SuperPaste in Tauri dev mode."
        : "Building a local release app, then launching it.",
    ],
  };
}

function runCommand(command, args, cwd, env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: "inherit",
    shell: false,
    windowsHide: false,
  });

  return result.status ?? 1;
}

function launchRelease(releaseExe, cwd) {
  const child = spawn(releaseExe, [], {
    cwd,
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });

  child.unref();
  return 0;
}

export async function main(rawArgs = process.argv.slice(2)) {
  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptDir, "..");
  const forceDev = rawArgs.includes("--dev") || normalizeBooleanFlag(process.env.SUPERPASTE_FORCE_DEV);
  const dryRun = rawArgs.includes("--dry-run") || normalizeBooleanFlag(process.env.SUPERPASTE_LAUNCHER_DRY_RUN);

  const snapshot = createLaunchSnapshot({ repoRoot, forceDev });
  const plan = chooseLaunchPlan(snapshot);

  if (dryRun) {
    process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
    return plan.action === "error" ? 1 : 0;
  }

  for (const line of plan.messageLines) {
    if (line) {
      console.log(line);
    }
  }

  if (plan.action === "launch-release") {
    return launchRelease(plan.releaseExe, repoRoot);
  }

  if (plan.action === "error") {
    return 1;
  }

  const env = { ...process.env, PATH: plan.envPath };

  if (plan.installDependencies) {
    const installStatus = runCommand("npm.cmd", ["install"], repoRoot, env);
    if (installStatus !== 0) {
      console.error("npm install failed.");
      return installStatus;
    }
  }

  if (plan.action === "run-dev") {
    return runCommand("npm.cmd", ["run", "tauri", "dev"], repoRoot, env);
  }

  const buildStatus = runCommand("npm.cmd", ["run", "tauri", "build", "--", "--no-bundle"], repoRoot, env);
  if (buildStatus !== 0) {
    console.error("Release build failed.");
    return buildStatus;
  }

  if (!fs.existsSync(plan.releaseExe)) {
    console.error(`Expected release executable was not created: ${plan.releaseExe}`);
    return 1;
  }

  return launchRelease(plan.releaseExe, repoRoot);
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
const isEntrypoint = entryPath === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  const code = await main();
  process.exit(code);
}
