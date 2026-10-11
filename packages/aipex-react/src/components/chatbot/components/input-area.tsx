import type { ChatStatus } from "ai";
import { ClockIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "../../../i18n/context";
import { cn } from "../../../lib/utils";
import type { ContextItem, InputAreaProps } from "../../../types";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputContextTag,
  PromptInputContextTags,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectGroup,
  PromptInputModelSelectItem,
  PromptInputModelSelectLabel,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSkillTag,
  PromptInputSkillTags,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "../../ai-elements/prompt-input";
import { DEFAULT_MODELS } from "../constants";
import { useComponentsContext, useConfigContext } from "../context";

export interface ExtendedInputAreaProps extends InputAreaProps {
  /** Available models for selection (used as fallback if API fetch fails) */
  models?: Array<{ name: string; value: string }>;
  /** Placeholder texts for typing animation */
  placeholderTexts?: string[];
  /** Message queue count */
  queueCount?: number;
}

/**
 * Default InputArea component
 */
export function DefaultInputArea({
  value,
  onChange,
  onSubmit,
  onStop,
  status,
  placeholder,
  disabled = false,
  models = DEFAULT_MODELS,
  placeholderTexts,
  queueCount = 0,
  className,
  ...props
}: ExtendedInputAreaProps) {
  const { t } = useTranslation();
  const { slots } = useComponentsContext();
  const { settings, updateSettings } = useConfigContext();

  const effectivePlaceholder = placeholder ?? t("input.placeholder1");

  const enabledCustomModels = useMemo(() => {
    return (settings.customModels ?? []).filter((model) => model.enabled);
  }, [settings.customModels]);

  // BYOK model entries formatted for the selector
  const byokModelEntries = useMemo(
    () =>
      enabledCustomModels.map((model) => ({
        name:
          model.name?.trim() ||
          `${model.aiModel} (custom-${model.providerType})`,
        value: model.aiModel,
      })),
    [enabledCustomModels],
  );

  // Flat list of all models for resolvedDefaultModel and the slot API.
  // BYOK models first so the current BYOK selection resolves correctly.
  const effectiveModels = useMemo(() => {
    const combined = byokModelEntries;

    // If the user's current model is not in any group, prepend it as a custom entry
    const currentModel = settings.aiModel?.trim();
    if (currentModel && !combined.some((m) => m.value === currentModel)) {
      return [
        { name: `${currentModel} (Custom)`, value: currentModel },
        ...combined,
      ];
    }

    return combined;
  }, [byokModelEntries, settings.aiModel]);

  const resolvedDefaultModel = useMemo(() => {
    const candidates = [
      settings.defaultModel?.trim(),
      settings.aiModel?.trim(),
      effectiveModels[0]?.value,
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (effectiveModels.some((model) => model.value === candidate)) {
        return candidate;
      }
    }

    return "";
  }, [effectiveModels, settings.aiModel, settings.defaultModel]);

  const [selectedModel, setSelectedModel] =
    useState<string>(resolvedDefaultModel);

  useEffect(() => {
    setSelectedModel(resolvedDefaultModel);
  }, [resolvedDefaultModel]);

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text);
      const hasAttachments = Boolean(message.files?.length);
      const hasContexts = Boolean(message.contexts?.length);

      if (!(hasText || hasAttachments || hasContexts)) {
        return;
      }

      // Convert files to File objects if needed
      const files = message.files?.map((f) => {
        // Files from PromptInput are already processed
        return f as unknown as File;
      });

      onSubmit(
        message.text || "",
        files,
        message.contexts as ContextItem[] | undefined,
      );
    },
    [onSubmit],
  );

  const handleModelChange = useCallback(
    (newModel: string) => {
      const trimmed = newModel?.trim();
      if (!trimmed) return;

      // Skip if unchanged
      if (trimmed === selectedModel) return;

      setSelectedModel(trimmed);

      // Check if the selected model belongs to the BYOK group
      const customConfig = enabledCustomModels.find(
        (m) => m.aiModel === trimmed,
      );

      if (customConfig) {
        // BYOK model selected → switch to BYOK mode with this config
        void updateSettings({
          aiModel: trimmed,
          aiToken: customConfig.aiToken,
          aiHost: customConfig.aiHost ?? "",
          providerType: customConfig.providerType,
          byokEnabled: true,
        });
        return;
      }

      void updateSettings({ aiModel: trimmed });
    },
    [selectedModel, enabledCustomModels, updateSettings],
  );

  // Map status to ChatStatus type
  const submitStatus: ChatStatus | undefined =
    status === "idle" ? undefined : (status as ChatStatus);

  return (
    <div className={cn("border-t p-4", className)} {...props}>
      <PromptInput onSubmit={handleSubmit} className="mt-4" globalDrop multiple>
        <PromptInputBody>
          {/* Context Tags */}
          <PromptInputContextTags>
            {(context) => <PromptInputContextTag data={context} />}
          </PromptInputContextTags>

          {/* Skill Tags */}
          <PromptInputSkillTags>
            {(skill) => <PromptInputSkillTag data={skill} />}
          </PromptInputSkillTags>

          {/* Platform-specific extras (e.g., context/skill data loaders) */}
          {slots.promptExtras?.()}

          {/* Attachments */}
          <PromptInputAttachments>
            {(attachment) => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>

          {/* Textarea */}
          <PromptInputTextarea
            placeholder={effectivePlaceholder}
            enableTypingAnimation={Boolean(placeholderTexts?.length)}
            placeholderTexts={placeholderTexts}
            onChange={(e) => onChange(e.target.value)}
            value={value}
            disabled={disabled}
          />

          {/* Queue indicator */}
          {queueCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground bg-muted/50 rounded-md mt-2">
              <ClockIcon className="size-4" />
              <span>
                {queueCount} message{queueCount > 1 ? "s" : ""} queued
              </span>
            </div>
          )}
        </PromptInputBody>

        <PromptInputToolbar>
          <PromptInputTools>
            {/* Action Menu */}
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>

            {/* Model Selector */}
            {slots.modelSelector ? (
              slots.modelSelector({
                value: selectedModel,
                onChange: handleModelChange,
                models: effectiveModels,
              })
            ) : (
              <PromptInputModelSelect
                onValueChange={handleModelChange}
                value={selectedModel}
              >
                <PromptInputModelSelectTrigger>
                  <PromptInputModelSelectValue />
                </PromptInputModelSelectTrigger>
                <PromptInputModelSelectContent>
                  {byokModelEntries.length > 0 ? (
                    <PromptInputModelSelectGroup>
                      <PromptInputModelSelectLabel>
                        Your models
                      </PromptInputModelSelectLabel>
                      {byokModelEntries.map((model) => (
                        <PromptInputModelSelectItem
                          key={model.value}
                          value={model.value}
                        >
                          {model.name}
                        </PromptInputModelSelectItem>
                      ))}
                    </PromptInputModelSelectGroup>
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      No models available
                    </div>
                  )}
                </PromptInputModelSelectContent>
              </PromptInputModelSelect>
            )}
          </PromptInputTools>

          {/* Submit/Stop Button */}
          {slots.inputToolbar ? (
            slots.inputToolbar({
              status,
              onStop,
              onSubmit: () => {
                /* handled by form */
              },
            })
          ) : (
            <PromptInputSubmit
              disabled={!value && !submitStatus}
              status={submitStatus}
              onClick={status === "streaming" ? onStop : undefined}
            />
          )}
        </PromptInputToolbar>
      </PromptInput>
    </div>
  );
}

/**
 * InputArea - Renders either custom or default input area
 */
export function InputArea(props: ExtendedInputAreaProps) {
  const { components } = useComponentsContext();

  const CustomComponent = components.InputArea;
  if (CustomComponent) {
    return <CustomComponent {...props} />;
  }

  return <DefaultInputArea {...props} />;
}
