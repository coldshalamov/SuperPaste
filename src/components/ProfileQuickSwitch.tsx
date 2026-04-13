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
  return (
    <label className="flex flex-col gap-1 min-w-[220px]" aria-label="Manual profile switcher">
      <span className="section-label">Profile</span>
      <div className="relative">
        <select
          aria-label="Profile override"
          className="appearance-none pr-7"
          onChange={(event) => onSelectProfile(event.target.value === "__auto__" ? null : event.target.value)}
          value={activeOverrideId ?? "__auto__"}
        >
          <option value="__auto__">Auto ({profiles.find((p) => p.id === resolvedProfileId)?.name ?? "Resolved"})</option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--color-text-muted)]" />
      </div>
    </label>
  );
}
