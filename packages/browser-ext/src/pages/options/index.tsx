import type { AppSettings } from "@aipexstudio/aipex-core";
import { SettingsPage } from "@aipexstudio/aipex-react";
import { I18nProvider } from "@aipexstudio/aipex-react/i18n/context";
import type { Language } from "@aipexstudio/aipex-react/i18n/types";
import { ThemeProvider } from "@aipexstudio/aipex-react/theme/context";
import type { Theme } from "@aipexstudio/aipex-react/theme/types";
import { ChromeStorageAdapter } from "@aipexstudio/browser-runtime";
import type { LanguageModel } from "ai";
import { generateText } from "ai";
import React, { useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { chromeStorageAdapter } from "../../hooks";
import { createAIProvider } from "../../lib/ai-provider";

/** Parse and validate URL params for deep-linking. */
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const tabAllowlist = new Set(["general", "ai"]);
  const rawTab = params.get("tab");
  const tab =
    rawTab && tabAllowlist.has(rawTab)
      ? (rawTab as "general" | "ai")
      : undefined;
  return { tab };
}

import "../tailwind.css";

const i18nStorageAdapter = new ChromeStorageAdapter<Language>();
const themeStorageAdapter = new ChromeStorageAdapter<Theme>();

function OptionsPageContent() {
  const { tab: initialTab } = useMemo(parseUrlParams, []);

  const handleTestConnection = useCallback(async (settings: AppSettings) => {
    try {
      const provider = createAIProvider(settings);
      const modelId = settings.aiModel;
      if (!modelId) {
        return false;
      }

      await generateText({
        model: provider(modelId) as LanguageModel,
        prompt: "Hi",
      });

      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }, []);

  return (
    <SettingsPage
      storageAdapter={chromeStorageAdapter}
      onTestConnection={handleTestConnection}
      initialTab={initialTab}
    />
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <I18nProvider storageAdapter={i18nStorageAdapter}>
        <ThemeProvider storageAdapter={themeStorageAdapter}>
          <OptionsPageContent />
        </ThemeProvider>
      </I18nProvider>
    </React.StrictMode>,
  );
}
