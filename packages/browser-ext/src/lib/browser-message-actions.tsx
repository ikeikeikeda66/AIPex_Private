/**
 * BrowserMessageActions
 * Custom message actions for the browser extension.
 * Renders Copy and Retry inline with each last assistant message.
 */

import {
  Action,
  Actions,
} from "@aipexstudio/aipex-react/components/ai-elements/actions";
import type { MessageActionsSlotProps } from "@aipexstudio/aipex-react/types";
import { CopyIcon, RefreshCcwIcon } from "lucide-react";

export function BrowserMessageActions({
  message,
  onRegenerate,
  onCopy,
}: MessageActionsSlotProps) {
  const textContent = message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("\n");

  return (
    <Actions className="mt-2">
      {onCopy && textContent && (
        <Action onClick={() => onCopy(textContent)} label="Copy">
          <CopyIcon className="size-3" />
        </Action>
      )}
      {onRegenerate && (
        <Action onClick={onRegenerate} label="Retry">
          <RefreshCcwIcon className="size-3" />
        </Action>
      )}
    </Actions>
  );
}
