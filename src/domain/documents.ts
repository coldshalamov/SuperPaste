import { APP_SCHEMA_VERSION, AppSettings, Profile, ProfilesDocument, SettingsDocument } from "./models";

export function createSettingsDocument(settings: AppSettings): SettingsDocument {
  return {
    version: APP_SCHEMA_VERSION,
    savedAtIso: new Date().toISOString(),
    settings,
  };
}

export function createProfilesDocument(profiles: Profile[]): ProfilesDocument {
  return {
    version: APP_SCHEMA_VERSION,
    savedAtIso: new Date().toISOString(),
    profiles,
  };
}
