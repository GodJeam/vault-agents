import type { AgentProvider, ProviderDescriptor } from "./provider";
import type { EngineType } from "./types";

export class ProviderRegistry {
  private providers = new Map<EngineType, AgentProvider>();

  register(provider: AgentProvider): void {
    this.providers.set(provider.id, provider);
  }

  unregister(id: EngineType): boolean {
    return this.providers.delete(id);
  }

  get(id: EngineType): AgentProvider | undefined {
    return this.providers.get(id);
  }

  has(id: EngineType): boolean {
    return this.providers.has(id);
  }

  getAll(): AgentProvider[] {
    return Array.from(this.providers.values());
  }

  getDescriptors(): ProviderDescriptor[] {
    return Array.from(this.providers.values()).map((p) => p.descriptor);
  }

  getAvailableIds(): EngineType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Resolve provider for a specific session or fall back to default
   */
  resolveProvider(
    activeEngine: EngineType,
    sessionId?: string,
    sessionEngines?: Record<string, EngineType>
  ): AgentProvider {
    const targetEngine = (sessionId && sessionEngines?.[sessionId]) || activeEngine;
    const provider = this.get(targetEngine);
    if (provider) return provider;

    // Fallback to first available provider
    const first = this.getAll()[0];
    if (!first) {
      throw new Error(`No AI agent provider registered in ProviderRegistry.`);
    }
    return first;
  }
}
