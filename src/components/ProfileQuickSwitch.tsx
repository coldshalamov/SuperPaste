import { Profile } from "../domain/models";
import { ChevronDown } from "lucide-react";

type ProfileQuickSwitchProps = {
  profiles: Profile[];
  resolvedProfileId: string;
  activeOverrideId: string | null;
  onSelectProfile: (profileId: string | null) => void;
};

export function ProfileQuickSwitch({
  profiles,
  resolvedProfileId,
  activeOverrideId,
  onSelectProfile,
}: ProfileQuickSwitchProps) {
  const resolvedName = profiles.find((p) => p.id === resolvedProfileId)?.name ?? "Unknown";

  return (
    <div className="relative min-w-[140px]">
      <select
        aria-label="Profile selection"
        className="appearance-none pr-7 text-xs"
        onChange={(event) =>
          onSelectProfile(event.target.value === "__auto__" ? null : event.target.value)
        }
        value={activeOverrideId ?? "__auto__"}
      >
        <option value="__auto__">Auto: {resolvedName}</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]"
      />
    </div>
  );
}
