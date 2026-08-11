import type { Tool } from '@modelcontextprotocol/server';
import type { Store } from '../storage/store.js';

/**
 * Effective visibility = server default (fallback 'visible'), overridden by a
 * per-tool entry when present. `inherit` tool entries are never stored, so a
 * missing row means "follow the default".
 *
 * Read path uses `getProjectionIndex()` — a single pass over two small tables.
 * For a self-hosted instance the data is tiny; no caching layer is needed yet.
 */
export class ToolProjectionService {
  readonly #store: Store;

  constructor(store: Store) {
    this.#store = store;
  }

  isVisible(serverId: string, toolName: string): boolean {
    const projection = this.#store.getProjectionIndex().get(serverId);
    if (!projection) return true;
    const override = projection.overrides.get(toolName);
    return override !== undefined ? override === 'visible' : projection.defaultVisibility === 'visible';
  }

  apply(serverId: string, tools: Tool[]): Tool[] {
    const projection = this.#store.getProjectionIndex().get(serverId);
    if (!projection) return tools;
    return tools.filter((tool) => {
      const override = projection.overrides.get(tool.name);
      return override !== undefined
        ? override === 'visible'
        : projection.defaultVisibility === 'visible';
    });
  }

  applyByName(serverId: string, names: string[]): string[] {
    const projection = this.#store.getProjectionIndex().get(serverId);
    if (!projection) return names;
    return names.filter((name) => {
      const override = projection.overrides.get(name);
      return override !== undefined
        ? override === 'visible'
        : projection.defaultVisibility === 'visible';
    });
  }
}
