import type { App } from "obsidian";
import type VaultAgentsPlugin from "../main";
import type { AgentProvider } from "../core/provider";
import { substitute } from "../i18n";
import { ModelSuggestModal, type ModelItem } from "./suggestModals";

export function buildModelItems(
  plugin: VaultAgentsPlugin,
  provider: AgentProvider,
  models: string[]
): ModelItem[] {
  const t = (s: string) => plugin.t(s);
  const desc = provider.descriptor;
  const cfg = plugin.getEngineConfig(desc.id);
  const cur = cfg.model || desc.defaultModel;
  const providerLabel = provider.costNote || t(desc.shortName);
  const items: ModelItem[] = [];
  const seen = new Set<string>();

  if (!desc.defaultModel) {
    items.push({
      id: "",
      label: substitute(t("(default from $1)"), desc.shortName),
      engine: desc.id,
      provider: providerLabel,
      isActive: cur === "",
      isDefault: true,
    });
    seen.add("");
  }

  if (cur && !seen.has(cur)) {
    items.push({
      id: cur,
      engine: desc.id,
      provider: providerLabel,
      isActive: true,
    });
    seen.add(cur);
  }

  for (const m of models) {
    if (seen.has(m)) continue;
    seen.add(m);
    items.push({
      id: m,
      engine: desc.id,
      provider: providerLabel,
      isActive: m === cur,
    });
  }

  return items;
}

export async function openProviderModelPicker(
  app: App,
  plugin: VaultAgentsPlugin,
  provider: AgentProvider,
  onPick: (item: ModelItem) => void | Promise<void>
): Promise<void> {
  let models: string[] = [];
  try {
    models = await provider.listModels();
  } catch {
    // Allow custom ID input even if listing fails
  }
  const initialItems = buildModelItems(plugin, provider, models);

  new ModelSuggestModal(
    app,
    plugin,
    initialItems,
    provider.id,
    (item) => {
      void onPick(item);
    },
    async () => {
      const refreshed = await provider.listModels(true);
      return buildModelItems(plugin, provider, refreshed);
    }
  ).open();
}
