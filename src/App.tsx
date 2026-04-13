import "./App.css";
import { CompactDock } from "./components/CompactDock";
import { EditorShell } from "./components/EditorShell";
import { ProfileQuickSwitch } from "./components/ProfileQuickSwitch";
import { StatusBar } from "./components/StatusBar";
import { TestHarnessWindow } from "./components/TestHarnessWindow";
import { ToastRail } from "./components/ToastRail";
import { HelpOverlay } from "./components/HelpOverlay";
import { OnboardingOverlay } from "./components/OnboardingOverlay";
import { useSuperPasteApp } from "./hooks/useSuperPasteApp";
import { Monitor, Pause, Play, FlaskConical, HelpCircle, Keyboard } from "lucide-react";
import { useEffect, useState } from "react";

function MainShell() {
  const app = useSuperPasteApp();
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const profileModeLabel = app.settings.activeProfileIdOverride
    ? `Manual: ${app.resolvedProfile.profile.name}`
    : "Auto";

  useEffect(() => {
    if (!app.settings.ui.helpDismissed) {
      setShowOnboarding(true);
    }
  }, [app.settings.ui.helpDismissed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "F1") {
        event.preventDefault();
        setShowHelp(true);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function dismissOnboarding() {
    setShowOnboarding(false);
    void app.saveSettings({
      ...app.settings,
      ui: { ...app.settings.ui, helpDismissed: true },
    });
  }

  return (
    <main className="app-shell">
      <header className="grid grid-cols-[1fr_auto] gap-3 items-start">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-accent-a-dim)] border border-[var(--color-accent-a-border)]">
              <Monitor size={18} className="text-[var(--color-accent-a)]" />
            </div>
            <div>
              <p className="section-label !text-[var(--color-accent-a)] mb-0.5">Two-bank combo engine</p>
              <h1 className="text-xl font-bold tracking-tight m-0" style={{ fontSize: "clamp(1.3rem, 2vw, 1.75rem)" }}>
                SuperPaste
              </h1>
            </div>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] ml-12">
            Ctrl+1..0 fires context. Ctrl+Alt+1..0 fires workflow. Numpad mirrors the same slots.
          </p>
        </div>

        <div className="flex flex-wrap items-start justify-end gap-2">
          <ProfileQuickSwitch
            activeOverrideId={app.settings.activeProfileIdOverride}
            onSelectProfile={(profileId) => void app.setManualProfileOverride(profileId)}
            profiles={app.profiles}
            resolvedProfileId={app.resolvedProfile.profile.id}
          />

          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setShowOnboarding(true)}
            type="button"
            title="Onboarding walkthrough"
          >
            <Keyboard size={13} />
            Tour
          </button>

          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setShowHelp(true)}
            type="button"
            title="Keyboard shortcuts and help (F1)"
          >
            <HelpCircle size={13} />
            Help
          </button>

          <div className="mode-toggle" aria-label="Shell mode">
            <button
              aria-label="Switch to dock mode"
              aria-pressed={app.shellMode === "dock"}
              className={app.shellMode === "dock" ? "is-active" : ""}
              onClick={() => app.setShellMode("dock")}
              type="button"
            >
              Dock
            </button>
            <button
              aria-label="Switch to editor mode"
              aria-pressed={app.shellMode === "editor"}
              className={app.shellMode === "editor" ? "is-active" : ""}
              onClick={() => app.setShellMode("editor")}
              type="button"
            >
              Editor
            </button>
          </div>

          <button
            className={`btn btn-sm ${app.settings.panicModeEnabled ? "btn-warning" : "btn-ghost"}`}
            onClick={() => void app.saveSettings({ ...app.settings, panicModeEnabled: !app.settings.panicModeEnabled })}
            type="button"
          >
            {app.settings.panicModeEnabled ? <Play size={13} /> : <Pause size={13} />}
            {app.settings.panicModeEnabled ? "Resume" : "Pause"}
          </button>

          <button className="btn btn-sm btn-ghost" onClick={() => void app.openTestHarness()} type="button">
            <FlaskConical size={13} />
            Smoke
          </button>
        </div>

        <div className="grid col-span-2 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2 mt-1">
          <div className="card flex flex-col justify-center gap-0.5 py-3">
            <span className="section-label">Active profile</span>
            <strong className="text-sm">{app.resolvedProfile.profile.name}</strong>
            <span className="text-xs text-[var(--color-text-muted)]">{profileModeLabel}</span>
          </div>

          <div className="card flex flex-col justify-center gap-0.5 py-3">
            <span className="section-label">Native shell</span>
            <strong className="text-sm">{app.runtime.nativeShellMode}</strong>
            <span className="text-xs text-[var(--color-text-muted)]">{app.resolvedProfile.reason || "Waiting for match"}</span>
          </div>
        </div>
      </header>

      <section className={`app-body ${app.shellMode === "editor" ? "is-editor" : ""}`}>
        <CompactDock
          activeBuffer={app.comboState}
          activeProfileName={app.resolvedProfile.profile.name}
          bankA={app.resolvedProfile.effectiveBankA}
          bankB={app.resolvedProfile.effectiveBankB}
          finalizedPreview={app.finalizedPreview}
          isPasteReady={app.runtime.nativePasteReady}
          isHotkeysPaused={app.settings.panicModeEnabled}
          hasHotkeyWarnings={app.hotkeyConflicts.length > 0}
          onEditSlot={(slotRef) =>
            app.editSlot(
              { bankId: slotRef.bankId, slotIndex: slotRef.slotIndex },
              slotRef.bankId === "B" ? "global-workflow" : app.resolvedProfile.profile.id,
            )
          }
          onPasteSlot={app.pasteSlot}
          onCancelCombo={app.cancelCombo}
          onCopyCombo={app.copyCombo}
          onPasteCombo={app.pasteCombo}
          onQueueSlot={app.queueSlot}
          onRemoveLast={app.removeLast}
          onReplayLast={app.replayLast}
          onToggleStance={app.toggleStance}
          profileReason={app.resolvedProfile.reason}
          supers={app.resolvedProfile.effectiveSupers}
          onQueueSuper={app.queueSuper}
        />

        {app.shellMode === "editor" ? (
          <EditorShell
            comboState={app.comboState}
            editorProfileId={app.editorProfileId}
            importExportText={app.importExportText}
            onApplyImportText={app.applyImportText}
            onDeleteRecipe={app.deleteRecipe}
            onEditorProfileChange={app.setEditorProfileId}
            onExportPack={app.exportPack}
            onImportFile={app.importPackFromFile}
            onImportTextChange={app.setImportExportText}
            onSaveProfile={app.saveProfile}
            onSaveRecipe={app.saveRecipe}
            onSaveSettings={app.saveSettings}
            onSelectSlot={app.setSlotSelection}
            profiles={app.profiles}
            resolvedProfileId={app.resolvedProfile.profile.id}
            settings={app.settings}
            slotSelection={app.slotSelection}
          />
        ) : null}
      </section>

      <StatusBar
        activeApp={app.activeWindow.processName || app.activeWindow.title}
        comboCount={app.comboState.queuedEntries.length}
        hotkeyStatus={app.hotkeySummary}
        hotkeyWarnings={app.hotkeyConflicts.map((conflict) => `${conflict.binding} (${conflict.reasons.join(", ")})`)}
        profileModeLabel={profileModeLabel}
      />

      <ToastRail message={app.lastActionMessage} />

      <HelpOverlay
        open={showHelp}
        onClose={() => setShowHelp(false)}
        settings={app.settings}
      />

      <OnboardingOverlay
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onDismiss={dismissOnboarding}
        settings={app.settings}
      />
    </main>
  );
}

function App() {
  const view = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("view") : null;
  return view === "harness" ? <TestHarnessWindow /> : <MainShell />;
}

export default App;
