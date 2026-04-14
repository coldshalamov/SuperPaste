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
import {
  Zap,
  Pause,
  Play,
  MoreHorizontal,
  HelpCircle,
  FlaskConical,
  Keyboard,
} from "lucide-react";
import { useEffect, useState, useRef } from "react";

function ActionMenu({
  onShowTour,
  onShowHelp,
  onOpenTestHarness,
}: {
  onShowTour: () => void;
  onShowHelp: () => void;
  onOpenTestHarness: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  return (
    <div className="action-menu" ref={menuRef}>
      <button
        className="btn btn-sm btn-ghost btn-icon"
        onClick={() => setOpen(!open)}
        type="button"
        aria-label="More actions"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="action-menu-dropdown">
          <button
            className="action-menu-item"
            onClick={() => {
              setOpen(false);
              onShowTour();
            }}
            type="button"
          >
            <Keyboard size={14} />
            Onboarding tour
          </button>
          <button
            className="action-menu-item"
            onClick={() => {
              setOpen(false);
              onShowHelp();
            }}
            type="button"
          >
            <HelpCircle size={14} />
            Keyboard shortcuts
          </button>
          <div className="action-menu-divider" />
          <button
            className="action-menu-item"
            onClick={() => {
              setOpen(false);
              onOpenTestHarness();
            }}
            type="button"
          >
            <FlaskConical size={14} />
            Test harness
          </button>
        </div>
      )}
    </div>
  );
}

function MainShell() {
  const app = useSuperPasteApp();
  const [showHelp, setShowHelp] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

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

  const isPaused = app.settings.panicModeEnabled;
  const hasWarnings = app.hotkeyConflicts.length > 0;

  return (
    <main className="app-shell">
      {/* ============================================
          HEADER
          ============================================ */}
      <header className="app-header">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-accent-a-dim)] border border-[var(--color-accent-a-border)]">
            <Zap size={16} className="text-[var(--color-accent-a)]" />
          </div>
          <div>
            <h1 className="text-base font-semibold m-0 leading-tight">SuperPaste</h1>
            <p className="text-xs text-[var(--color-text-muted)] m-0">
              {app.resolvedProfile.profile.name}
              <span className="mx-1.5 opacity-40">|</span>
              <span className={isPaused ? "text-[var(--color-warning)]" : hasWarnings ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}>
                {isPaused ? "Paused" : hasWarnings ? "Degraded" : "Active"}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ProfileQuickSwitch
            activeOverrideId={app.settings.activeProfileIdOverride}
            onSelectProfile={(profileId) => void app.setManualProfileOverride(profileId)}
            profiles={app.profiles}
            resolvedProfileId={app.resolvedProfile.profile.id}
          />

          <div className="mode-toggle">
            <button
              aria-label="Dock mode"
              aria-pressed={app.shellMode === "dock"}
              className={app.shellMode === "dock" ? "is-active" : ""}
              onClick={() => app.setShellMode("dock")}
              type="button"
            >
              Dock
            </button>
            <button
              aria-label="Editor mode"
              aria-pressed={app.shellMode === "editor"}
              className={app.shellMode === "editor" ? "is-active" : ""}
              onClick={() => app.setShellMode("editor")}
              type="button"
            >
              Editor
            </button>
          </div>

          <button
            className={`btn btn-sm ${isPaused ? "btn-warning" : "btn-ghost"}`}
            onClick={() =>
              void app.saveSettings({ ...app.settings, panicModeEnabled: !isPaused })
            }
            type="button"
            title={isPaused ? "Resume hotkeys" : "Pause hotkeys"}
          >
            {isPaused ? <Play size={14} /> : <Pause size={14} />}
          </button>

          <ActionMenu
            onShowTour={() => setShowOnboarding(true)}
            onShowHelp={() => setShowHelp(true)}
            onOpenTestHarness={() => void app.openTestHarness()}
          />
        </div>
      </header>

      {/* ============================================
          MAIN CONTENT
          ============================================ */}
      <section className={`app-body ${app.shellMode === "editor" ? "is-editor" : ""}`}>
        <CompactDock
          activeBuffer={app.comboState}
          activeProfileName={app.resolvedProfile.profile.name}
          bankA={app.resolvedProfile.effectiveBankA}
          bankB={app.resolvedProfile.effectiveBankB}
          finalizedPreview={app.finalizedPreview}
          isPasteReady={app.runtime.nativePasteReady}
          isHotkeysPaused={isPaused}
          hasHotkeyWarnings={hasWarnings}
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

        {app.shellMode === "editor" && (
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
        )}
      </section>

      {/* ============================================
          STATUS BAR
          ============================================ */}
      <StatusBar
        activeApp={app.activeWindow.processName || app.activeWindow.title}
        comboCount={app.comboState.queuedEntries.length}
        hotkeyStatus={app.hotkeySummary}
        hotkeyWarnings={app.hotkeyConflicts.map(
          (conflict) => `${conflict.binding} (${conflict.reasons.join(", ")})`,
        )}
        isManualOverride={!!app.settings.activeProfileIdOverride}
      />

      {/* ============================================
          OVERLAYS
          ============================================ */}
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
  const view =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("view")
      : null;
  return view === "harness" ? <TestHarnessWindow /> : <MainShell />;
}

export default App;
