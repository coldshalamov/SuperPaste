import {
  ActiveWindowSnapshot,
  AppSettings,
  AssemblyConfig,
  Profile,
  SlotBank,
  SuperRecipe,
  mergeBanks,
} from "./models";

const RULE_BASE_SCORES: Record<Profile["matchRules"][number]["kind"], number> = {
  workspacePathEquals: 100,
  workspacePathContains: 80,
  processPathContains: 60,
  processName: 50,
  windowTitleContains: 30,
};

export type ResolvedProfile = {
  profile: Profile;
  effectiveBankA: SlotBank;
  effectiveBankB: SlotBank;
  effectiveSupers: SuperRecipe[];
  effectiveAssembly: AssemblyConfig | null;
  reason: string;
  score: number;
};

function normalize(value: string, caseSensitive: boolean) {
  return caseSensitive ? value : value.toLowerCase();
}

function mergeSupersWithChildPriority(parentSupers: SuperRecipe[], childSupers: SuperRecipe[]) {
  const byId = new Map<string, SuperRecipe>();

  parentSupers.forEach((recipe) => byId.set(recipe.id, recipe));
  childSupers.forEach((recipe) => byId.set(recipe.id, recipe));

  return Array.from(byId.values());
}

function materializeProfile(
  profile: Profile,
  profileMap: Map<string, Profile>,
  visiting = new Set<string>(),
  cache = new Map<string, Profile>(),
): Profile {
  const cached = cache.get(profile.id);
  if (cached) {
    return cached;
  }

  if (visiting.has(profile.id)) {
    return {
      ...profile,
      extendsProfileId: null,
    };
  }

  if (!profile.extendsProfileId) {
    cache.set(profile.id, profile);
    return profile;
  }

  visiting.add(profile.id);
  const parent = profileMap.get(profile.extendsProfileId);
  let materialized: Profile;

  if (!parent) {
    materialized = profile;
  } else {
    const effectiveParent = materializeProfile(parent, profileMap, visiting, cache);
    materialized = {
      ...profile,
      assembly: profile.assembly ?? effectiveParent.assembly ?? null,
      bankA: mergeBanks(effectiveParent.bankA, profile.bankA),
      bankB: mergeBanks(effectiveParent.bankB, profile.bankB),
      supers: mergeSupersWithChildPriority(effectiveParent.supers, profile.supers),
    };
  }

  visiting.delete(profile.id);
  cache.set(profile.id, materialized);
  return materialized;
}

function scoreProfile(profile: Profile, activeWindow: ActiveWindowSnapshot) {
  let bestScore = 0;
  let bestReason = "Fallback to global profile";

  profile.matchRules.forEach((rule) => {
    const ruleValue = normalize(rule.value, rule.caseSensitive);
    const title = normalize(activeWindow.title, rule.caseSensitive);
    const processName = normalize(activeWindow.processName, rule.caseSensitive);
    const processPath = normalize(activeWindow.processPath, rule.caseSensitive);
    const workspacePath = normalize(activeWindow.workspacePath, rule.caseSensitive);

    let matched = false;

    switch (rule.kind) {
      case "workspacePathEquals":
        matched = workspacePath === ruleValue;
        break;
      case "workspacePathContains":
        matched = workspacePath.includes(ruleValue);
        break;
      case "processName":
        matched = processName === ruleValue;
        break;
      case "processPathContains":
        matched = processPath.includes(ruleValue);
        break;
      case "windowTitleContains":
        matched = title.includes(ruleValue);
        break;
      default:
        matched = false;
    }

    if (!matched) {
      return;
    }

    const score = RULE_BASE_SCORES[rule.kind] + rule.weightBoost + profile.priority;

    if (score > bestScore) {
      bestScore = score;
      bestReason = `${profile.name} matched ${rule.kind} (${rule.value})`;
    }
  });

  return { bestScore, bestReason };
}

export function resolveProfile(
  profiles: Profile[],
  settings: AppSettings,
  activeWindow: ActiveWindowSnapshot,
): ResolvedProfile {
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const globalProfile = profiles.find((profile) => profile.kind === "global") ?? profiles[0];

  if (settings.activeProfileIdOverride) {
    const override = profileMap.get(settings.activeProfileIdOverride);

    if (override) {
      const materialized = materializeProfile(override, profileMap);
      return {
        profile: materialized,
        effectiveBankA: materialized.bankA,
        effectiveBankB: materialized.bankB,
        effectiveSupers: materialized.supers,
        effectiveAssembly: materialized.assembly ?? null,
        reason: `Manual override to ${materialized.name}`,
        score: 999,
      };
    }
  }

  let winner: ResolvedProfile | null = null;

  profiles
    .filter((profile) => profile.kind === "workspace")
    .forEach((profile) => {
      const { bestScore, bestReason } = scoreProfile(profile, activeWindow);

      if (!bestScore) {
        return;
      }

      const materialized = materializeProfile(profile, profileMap);

      if (!winner || bestScore > winner.score || (bestScore === winner.score && materialized.name < winner.profile.name)) {
        winner = {
          profile: materialized,
          effectiveBankA: materialized.bankA,
          effectiveBankB: materialized.bankB,
          effectiveSupers: materialized.supers,
          effectiveAssembly: materialized.assembly ?? null,
          reason: bestReason,
          score: bestScore,
        };
      }
    });

  if (winner) {
    return winner;
  }

  const materializedGlobal = materializeProfile(globalProfile, profileMap);
  return {
    profile: materializedGlobal,
    effectiveBankA: materializedGlobal.bankA,
    effectiveBankB: materializedGlobal.bankB,
    effectiveSupers: materializedGlobal.supers,
    effectiveAssembly: materializedGlobal.assembly ?? null,
    reason: "Global profile fallback",
    score: 0,
  };
}
