import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import {
  chooseLaunchPlan,
  createLaunchSnapshot,
  prependPathEntry,
} from "../../../scripts/launch-superpaste.js";

describe("launch-superpaste launcher planning", () => {
  const repoRoot = "C:\\repo\\SuperPaste";

  it("prefers an existing release build unless forced into dev mode", () => {
    const snapshot = createLaunchSnapshot({
      repoRoot,
      forceDev: false,
      env: { ...process.env, PATH: "C:\\Windows\\System32" },
      exists: (filePath) =>
        filePath === path.join(repoRoot, "src-tauri", "target", "release", "superpaste.exe"),
      commandExistsImpl: () => false,
      homeDir: "C:\\Users\\tester",
    });

    const plan = chooseLaunchPlan(snapshot);

    expect(plan.action).toBe("launch-release");
    expect(plan.releaseExe).toContain("src-tauri");
  });

  it("repairs PATH from the default cargo install before building a release launch", () => {
    const snapshot = createLaunchSnapshot({
      repoRoot,
      forceDev: false,
      env: { ...process.env, USERPROFILE: "C:\\Users\\tester", PATH: "C:\\Program Files\\nodejs;C:\\Windows\\System32" },
      exists: (filePath) =>
        filePath === "C:\\Users\\tester\\.cargo\\bin\\cargo.exe",
      commandExistsImpl: (command, env) => {
        if (command === "npm.cmd" || command === "npm") {
          return true;
        }
        if (command === "cargo.exe" || command === "cargo") {
          return (env.PATH ?? "").toLowerCase().includes("\\.cargo\\bin");
        }
        return false;
      },
      homeDir: "C:\\Users\\tester",
    });

    const plan = chooseLaunchPlan(snapshot);

    expect(plan.action).toBe("build-release");
    expect(plan.repairedCargoPath).toBe(true);
    expect(plan.envPath.toLowerCase()).toContain("c:\\users\\tester\\.cargo\\bin");
  });

  it("fails with a clear error when cargo cannot be found anywhere", () => {
    const snapshot = createLaunchSnapshot({
      repoRoot,
      forceDev: false,
      env: { ...process.env, USERPROFILE: "C:\\Users\\tester", PATH: "C:\\Program Files\\nodejs;C:\\Windows\\System32" },
      exists: () => false,
      commandExistsImpl: (command) => command === "npm.cmd" || command === "npm",
      homeDir: "C:\\Users\\tester",
    });

    const plan = chooseLaunchPlan(snapshot);

    expect(plan.action).toBe("error");
    expect(plan.messageLines.join("\n")).toContain("Rust/Cargo was not found");
  });

  it("installs dependencies before release build when node_modules is absent", () => {
    const snapshot = createLaunchSnapshot({
      repoRoot,
      forceDev: false,
      env: { ...process.env, USERPROFILE: "C:\\Users\\tester", PATH: "C:\\Users\\tester\\.cargo\\bin;C:\\Program Files\\nodejs" },
      exists: (filePath) => filePath === "C:\\Users\\tester\\.cargo\\bin\\cargo.exe",
      commandExistsImpl: () => true,
      homeDir: "C:\\Users\\tester",
    });

    const plan = chooseLaunchPlan(snapshot);

    expect(plan.action).toBe("build-release");
    expect(plan.installDependencies).toBe(true);
  });

  it("uses dev mode only when explicitly forced", () => {
    const snapshot = createLaunchSnapshot({
      repoRoot,
      forceDev: true,
      env: { ...process.env, USERPROFILE: "C:\\Users\\tester", PATH: "C:\\Users\\tester\\.cargo\\bin;C:\\Program Files\\nodejs" },
      exists: (filePath) => filePath === "C:\\Users\\tester\\.cargo\\bin\\cargo.exe",
      commandExistsImpl: () => true,
      homeDir: "C:\\Users\\tester",
    });

    const plan = chooseLaunchPlan(snapshot);

    expect(plan.action).toBe("run-dev");
  });
});

describe("prependPathEntry", () => {
  it("does not duplicate an existing PATH segment", () => {
    const current = "C:\\Users\\tester\\.cargo\\bin;C:\\Windows\\System32";

    expect(prependPathEntry(current, "C:\\Users\\tester\\.cargo\\bin")).toBe(current);
  });
});

describe("launch-superpaste.cmd", () => {
  it.runIf(process.platform === "win32")("prefers the existing release build in default dry-run mode", () => {
    const repoRoot = path.resolve(process.cwd());
    const output = execFileSync("cmd.exe", ["/c", "launch-superpaste.cmd"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: "C:\\Program Files\\nodejs;C:\\Windows\\System32;C:\\Windows",
        SUPERPASTE_LAUNCHER_DRY_RUN: "1",
        SUPERPASTE_LAUNCHER_NO_PAUSE: "1",
      },
    });

    const plan = JSON.parse(output);

    expect(plan.action).toBe("launch-release");
  });

  it.runIf(process.platform === "win32")("honors --dev instead of short-circuiting to an existing release exe", () => {
    const repoRoot = path.resolve(process.cwd());
    const output = execFileSync("cmd.exe", ["/c", "launch-superpaste.cmd --dev"], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: "C:\\Program Files\\nodejs;C:\\Windows\\System32;C:\\Windows",
        SUPERPASTE_LAUNCHER_DRY_RUN: "1",
        SUPERPASTE_LAUNCHER_NO_PAUSE: "1",
      },
    });

    const plan = JSON.parse(output);

    expect(plan.action).toBe("run-dev");
    expect(plan.repairedCargoPath).toBe(true);
  });
});
