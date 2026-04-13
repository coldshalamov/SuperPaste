export type LaunchPlanAction = "launch-release" | "build-release" | "run-dev" | "error";

export interface LaunchSnapshot {
  repoRoot: string;
  releaseExe: string;
  nodeModulesDir: string;
  cargoBinDir: string;
  cargoExePath: string;
  npmAvailable: boolean;
  cargoAvailable: boolean;
  defaultCargoExists: boolean;
  releaseExists: boolean;
  nodeModulesExists: boolean;
  forceDev: boolean;
  normalizedPath: string;
}

export interface LaunchPlan {
  action: LaunchPlanAction;
  repoRoot: string;
  releaseExe: string;
  installDependencies: boolean;
  repairedCargoPath: boolean;
  envPath: string;
  messageLines: string[];
}

export function normalizeBooleanFlag(value: string | undefined): boolean;
export function prependPathEntry(pathValue: string | undefined, entry: string): string;
export function findCargoHome(
  env?: NodeJS.ProcessEnv,
  homeDir?: string,
): { cargoBinDir: string; cargoExePath: string };
export function commandExists(command: string, env: NodeJS.ProcessEnv): boolean;
export function createLaunchSnapshot(options: {
  repoRoot: string;
  env?: NodeJS.ProcessEnv;
  exists?: (filePath: string) => boolean;
  forceDev?: boolean;
  homeDir?: string;
  commandExistsImpl?: (command: string, env: NodeJS.ProcessEnv) => boolean;
}): LaunchSnapshot;
export function chooseLaunchPlan(snapshot: LaunchSnapshot): LaunchPlan;
export function main(rawArgs?: string[]): Promise<number>;
