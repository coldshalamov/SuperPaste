import { z } from "zod";
import {
  APP_SCHEMA_VERSION,
  ImportExportPack,
  ProfilesDocument,
  SettingsDocument,
  importExportPackSchema,
  profileSchema,
  profilesDocumentSchema,
  settingsDocumentSchema,
} from "./models";

function parseJsonIfNeeded<T>(input: string | T) {
  if (typeof input === "string") {
    return JSON.parse(input) as T;
  }

  return input;
}

function normalizeLegacyEnvelope(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return raw;
  }

  const candidate = raw as Record<string, unknown>;

  if (!("version" in candidate) && "settings" in candidate) {
    return {
      version: APP_SCHEMA_VERSION,
      savedAtIso: new Date().toISOString(),
      ...candidate,
    };
  }

  if (!("version" in candidate) && "profiles" in candidate) {
    return {
      version: APP_SCHEMA_VERSION,
      savedAtIso: new Date().toISOString(),
      ...candidate,
    };
  }

  return candidate;
}

function validateProfileGraph(profilesDocument: ProfilesDocument) {
  const seenProfileIds = new Set<string>();
  const seenRuleIds = new Set<string>();
  const seenSuperIds = new Set<string>();

  profilesDocument.profiles.forEach((profile, profileIndex) => {
    if (seenProfileIds.has(profile.id)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: `Duplicate profile id ${profile.id}.`,
          path: ["profiles", profileIndex, "id"],
        },
      ]);
    }

    seenProfileIds.add(profile.id);

    profile.matchRules.forEach((rule, ruleIndex) => {
      if (seenRuleIds.has(rule.id)) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: `Duplicate rule id ${rule.id}.`,
            path: ["profiles", profileIndex, "matchRules", ruleIndex, "id"],
          },
        ]);
      }

      seenRuleIds.add(rule.id);
    });

    profile.supers.forEach((superRecipe, superIndex) => {
      if (seenSuperIds.has(superRecipe.id)) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: `Duplicate super id ${superRecipe.id}.`,
            path: ["profiles", profileIndex, "supers", superIndex, "id"],
          },
        ]);
      }

      seenSuperIds.add(superRecipe.id);
    });
  });

  const profilesById = new Map(profilesDocument.profiles.map((profile) => [profile.id, profile]));
  const globalProfiles = profilesDocument.profiles.filter((profile) => profile.kind === "global");

  if (globalProfiles.length !== 1) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        message: "Exactly one global profile is required.",
        path: ["profiles"],
      },
    ]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (profileId: string) => {
    if (visited.has(profileId)) {
      return;
    }

    if (visiting.has(profileId)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: `Circular profile inheritance detected at ${profileId}.`,
          path: ["profiles"],
        },
      ]);
    }

    visiting.add(profileId);
    const profile = profilesById.get(profileId);

    if (!profile) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: `Unknown profile ${profileId}.`,
          path: ["profiles"],
        },
      ]);
    }

    if (profile.extendsProfileId) {
      if (!profilesById.has(profile.extendsProfileId)) {
        throw new z.ZodError([
          {
            code: z.ZodIssueCode.custom,
            message: `Profile ${profile.id} extends missing profile ${profile.extendsProfileId}.`,
            path: ["profiles"],
          },
        ]);
      }

      visit(profile.extendsProfileId);
    }

    visiting.delete(profileId);
    visited.add(profileId);
  };

  profilesDocument.profiles.forEach((profile) => visit(profile.id));

  return profilesDocument;
}

export function parseSettingsDocument(input: string | unknown): SettingsDocument {
  const raw = normalizeLegacyEnvelope(parseJsonIfNeeded(input));
  return settingsDocumentSchema.parse(raw);
}

export function parseProfilesDocument(input: string | unknown): ProfilesDocument {
  const raw = normalizeLegacyEnvelope(parseJsonIfNeeded(input));
  const parsed = profilesDocumentSchema.parse(raw);
  parsed.profiles.forEach((profile) => profileSchema.parse(profile));
  return validateProfileGraph(parsed);
}

export function parseImportExportPack(input: string | unknown): ImportExportPack {
  return importExportPackSchema.parse(parseJsonIfNeeded(input));
}
