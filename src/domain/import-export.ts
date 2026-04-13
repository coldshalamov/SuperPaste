import { APP_SCHEMA_VERSION, AppSettings, ImportExportPack, Profile } from "./models";
import { parseImportExportPack } from "./validation";

export type PortableProfilePack = Extract<ImportExportPack, { format: "superpaste-content-pack" }>;
export type MachineSnapshotPack = Extract<ImportExportPack, { format: "superpaste-machine-snapshot" }>;
export type LegacySnapshotPack = Extract<ImportExportPack, { format: "superpaste-pack" }>;

export function createPortableProfilePack(
  profiles: Profile[],
  packName = "SuperPaste profile pack",
): PortableProfilePack {
  return {
    format: "superpaste-content-pack",
    version: APP_SCHEMA_VERSION,
    exportedAtIso: new Date().toISOString(),
    packName,
    profiles,
  };
}

export function createMachineSnapshotPack(
  settings: AppSettings,
  profiles: Profile[],
): MachineSnapshotPack {
  return {
    format: "superpaste-machine-snapshot",
    version: settings.schemaVersion,
    exportedAtIso: new Date().toISOString(),
    settings,
    profiles,
  };
}

export function serializePortableProfilePack(profiles: Profile[], packName?: string) {
  return JSON.stringify(createPortableProfilePack(profiles, packName), null, 2);
}

export function serializeMachineSnapshotPack(settings: AppSettings, profiles: Profile[]) {
  return JSON.stringify(createMachineSnapshotPack(settings, profiles), null, 2);
}

export function parseImportExportPackText(json: string) {
  return parseImportExportPack(json);
}

export function materializeImportedDocuments(
  pack: ImportExportPack,
  currentSettings: AppSettings,
): { settings: AppSettings; profiles: Profile[] } {
  if (pack.format === "superpaste-content-pack") {
    return {
      settings: currentSettings,
      profiles: pack.profiles,
    };
  }

  return {
    settings: pack.settings,
    profiles: pack.profiles,
  };
}
