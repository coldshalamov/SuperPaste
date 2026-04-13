import {
  AppSettings,
  AssemblyConfig,
  ComboBufferState,
  RecipeEntry,
  SlotDefinition,
  SlotReference,
  SuperRecipe,
  getSlotKey,
} from "./models";

export type TemplateContext = {
  clipboard: string;
  profile: string;
  active_app: string;
  date: string;
};

export type FinalizedCombo = NonNullable<ComboBufferState["lastFinalized"]>;

export type EffectiveLoadout = {
  bankA: SlotDefinition[];
  bankB: SlotDefinition[];
  supers: SuperRecipe[];
  assembly?: AssemblyConfig | null;
};

type AssembleRuntime = {
  text: string;
  sequence: SlotReference[];
};

export function queueSlot(state: ComboBufferState, slotRef: SlotReference): ComboBufferState {
  return {
    ...state,
    queuedEntries: [...state.queuedEntries, { type: "slot", slotRef }],
  };
}

export function queueSuper(state: ComboBufferState, superId: string): ComboBufferState {
  return {
    ...state,
    queuedEntries: [...state.queuedEntries, { type: "super", superId }],
  };
}

export function toggleStance(state: ComboBufferState, slotRef: SlotReference): ComboBufferState {
  if (slotRef.bankId !== "B") {
    return state;
  }

  const key = getSlotKey(slotRef);
  const exists = state.activeStances.some((stance) => getSlotKey(stance) === key);

  return {
    ...state,
    activeStances: exists
      ? state.activeStances.filter((stance) => getSlotKey(stance) !== key)
      : [...state.activeStances, slotRef],
  };
}

export function removeLastQueuedEntry(state: ComboBufferState): ComboBufferState {
  if (!state.queuedEntries.length) {
    return state;
  }

  return {
    ...state,
    queuedEntries: state.queuedEntries.slice(0, -1),
  };
}

export function cancelCombo(state: ComboBufferState) {
  return {
    queuedEntries: [],
    activeStances: state.activeStances,
    lastFinalized: state.lastFinalized,
  };
}

function lookupSlot(loadout: EffectiveLoadout, slotRef: SlotReference) {
  const source = slotRef.bankId === "A" ? loadout.bankA : loadout.bankB;
  return source.find((slot) => slot.slotIndex === slotRef.slotIndex);
}

function lookupSuper(loadout: EffectiveLoadout, superId: string) {
  return loadout.supers.find((recipe) => recipe.id === superId);
}

function renderTemplate(content: string, context: TemplateContext, enabled: boolean) {
  if (!enabled) {
    return content;
  }

  return content.replace(/{{\s*(clipboard|profile|active_app|date)\s*}}/g, (_, token: keyof TemplateContext) => {
    return context[token] ?? "";
  });
}

function combineText(currentText: string, nextText: string, mode: SlotDefinition["assemblyMode"], joiner: string) {
  if (!currentText) {
    return nextText;
  }

  if (!nextText) {
    return currentText;
  }

  if (mode === "prepend") {
    return `${nextText}${joiner}${currentText}`;
  }

  return `${currentText}${joiner}${nextText}`;
}

function applySlot(
  runtime: AssembleRuntime,
  slot: SlotDefinition,
  joiner: string,
  templateContext: TemplateContext,
): AssembleRuntime {
  const usesCurrentText = slot.assemblyMode === "wrap";
  const rendered = renderTemplate(
    slot.content,
    {
      ...templateContext,
      clipboard: usesCurrentText ? runtime.text || templateContext.clipboard : templateContext.clipboard,
    },
    slot.templateMode === "template",
  ).trim();

  if (!rendered) {
    return runtime;
  }

  if (slot.assemblyMode === "wrap") {
    return {
      text: rendered,
      sequence: [...runtime.sequence, { bankId: slot.bankId, slotIndex: slot.slotIndex }],
    };
  }

  return {
    text: combineText(runtime.text, rendered, slot.assemblyMode, joiner),
    sequence: [...runtime.sequence, { bankId: slot.bankId, slotIndex: slot.slotIndex }],
  };
}

function appendStandaloneBlock(runtime: AssembleRuntime, text: string, joiner: string, sequence: SlotReference[]) {
  const trimmed = text.trim();
  if (!trimmed) {
    return runtime;
  }

  return {
    text: combineText(runtime.text, trimmed, "append", joiner),
    sequence: [...runtime.sequence, ...sequence],
  };
}

function resolveJoiner(settings: AppSettings, assembly?: AssemblyConfig | null) {
  return assembly?.joiner?.length ? assembly.joiner : settings.comboJoiner;
}

function assembleEntries(
  entries: RecipeEntry[],
  loadout: EffectiveLoadout,
  settings: AppSettings,
  templateContext: TemplateContext,
  assembly: AssemblyConfig | null | undefined,
  visitedSupers: Set<string>,
  initialRuntime: AssembleRuntime = {
    text: "",
    sequence: [],
  },
): AssembleRuntime {
  const joiner = resolveJoiner(settings, assembly ?? loadout.assembly ?? null);
  let runtime: AssembleRuntime = initialRuntime;

  for (const entry of entries) {
    if (entry.type === "slot") {
      const slot = lookupSlot(loadout, entry.slotRef);
      if (!slot?.enabled || !slot.content.trim()) {
        continue;
      }

      runtime = applySlot(runtime, slot, joiner, templateContext);
      continue;
    }

    const recipe = lookupSuper(loadout, entry.superId);
    if (!recipe || visitedSupers.has(recipe.id)) {
      continue;
    }

    visitedSupers.add(recipe.id);
    const assembledRecipe = assembleEntries(
      recipe.steps,
      loadout,
      settings,
      templateContext,
      recipe.assembly ?? loadout.assembly ?? null,
      visitedSupers,
    );
    visitedSupers.delete(recipe.id);

    runtime = appendStandaloneBlock(runtime, assembledRecipe.text, joiner, assembledRecipe.sequence);
  }

  return runtime;
}

function dedupeActiveStances(state: ComboBufferState, sequence: SlotReference[]) {
  const explicitKeys = new Set(sequence.map((slot) => getSlotKey(slot)));
  return state.activeStances.filter((stance) => !explicitKeys.has(getSlotKey(stance)));
}

export function finalizeCombo(
  state: ComboBufferState,
  loadout: EffectiveLoadout,
  settings: AppSettings,
  templateContext: TemplateContext,
): { nextState: ComboBufferState; finalized: FinalizedCombo | null } {
  const explicitEntries = state.queuedEntries.flatMap<RecipeEntry>((entry) => {
    if (entry.type === "slot" && entry.slotRef) {
      return [{ type: "slot", slotRef: entry.slotRef }];
    }

    if (entry.type === "super" && entry.superId) {
      return [{ type: "super", superId: entry.superId }];
    }

    return [];
  });

  const explicitRuntime = assembleEntries(
    explicitEntries,
    loadout,
    settings,
    templateContext,
    loadout.assembly ?? null,
    new Set<string>(),
  );

  const stanceEntries = dedupeActiveStances(state, explicitRuntime.sequence).map<RecipeEntry>((slotRef) => ({
    type: "slot",
    slotRef,
  }));

  const completeRuntime = assembleEntries(
    stanceEntries,
    loadout,
    settings,
    {
      ...templateContext,
      clipboard: explicitRuntime.text || templateContext.clipboard,
    },
    loadout.assembly ?? null,
    new Set<string>(),
    explicitRuntime,
  );
  const finalizedText = completeRuntime.text.trim();
  const finalizedSequence = completeRuntime.sequence;

  if (!finalizedText || !finalizedSequence.length) {
    return {
      nextState: state,
      finalized: null,
    };
  }

  const finalized: FinalizedCombo = {
    text: finalizedText,
    charCount: finalizedText.length,
    roughTokenCount: Math.ceil(finalizedText.length / 4),
    sequence: finalizedSequence,
    createdAtIso: new Date().toISOString(),
  };

  return {
    nextState: {
      queuedEntries: [],
      activeStances: state.activeStances,
      lastFinalized: finalized,
    },
    finalized,
  };
}

export function replayLast(state: ComboBufferState) {
  return state.lastFinalized;
}
