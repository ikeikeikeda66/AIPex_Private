/**
 * BrowserContextLoader
 * Rendered inside PromptInput (via the promptExtras slot) to populate
 * available contexts (tabs, bookmarks, current page).
 *
 * This component renders nothing visible; it only syncs data from
 * browser-runtime providers into the PromptInput context hooks.
 */

import { usePromptInputContexts } from "@aipexstudio/aipex-react/components/ai-elements/prompt-input";
import { useTabsSync } from "../hooks/use-tabs-sync";

export function BrowserContextLoader() {
  const contexts = usePromptInputContexts();

  useTabsSync({
    onContextsUpdate: (availableContexts) => {
      contexts.setAvailableContexts(availableContexts);
    },
    onContextRemove: (contextId) => {
      contexts.remove(contextId);
    },
    getSelectedContexts: () => {
      return contexts.items;
    },
    debounceDelay: 300,
  });

  return null;
}
