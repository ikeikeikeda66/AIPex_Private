/**
 * Browser Extension App Root
 * Simple wrapper using browser-specific hooks
 */

import { useAgent, useChatConfig } from "@aipexstudio/aipex-react";
import ChatBot from "@aipexstudio/aipex-react/components/chatbot";
import { ErrorBoundary } from "@aipexstudio/aipex-react/components/error/ErrorBoundary";
import type { InterventionMode } from "@aipexstudio/aipex-react/components/intervention";
import { I18nProvider } from "@aipexstudio/aipex-react/i18n/context";
import type { Language } from "@aipexstudio/aipex-react/i18n/types";
import { ThemeProvider } from "@aipexstudio/aipex-react/theme/context";
import type { Theme } from "@aipexstudio/aipex-react/theme/types";
import { ChromeStorageAdapter } from "@aipexstudio/browser-runtime";
import React, { useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import { chromeStorageAdapter } from "../../hooks";
import { AutomationModeInputToolbar } from "../../lib/automation-mode-toolbar";
import {
  BROWSER_AGENT_CONFIG,
  useBrowserContextProviders,
  useBrowserModelFactory,
  useBrowserStorage,
  useBrowserTools,
} from "../../lib/browser-agent-config";
import { BrowserChatHeader } from "../../lib/browser-chat-header";
import { BrowserContextLoader } from "../../lib/browser-context-loader";
import { BrowserMessageActions } from "../../lib/browser-message-actions";
import { ChatImagesListener } from "../../lib/chat-images-listener";
import { InterventionModeProvider } from "../../lib/intervention-mode-context";
import { InterventionUI } from "../../lib/intervention-ui";

const i18nStorageAdapter = new ChromeStorageAdapter<Language>();
const themeStorageAdapter = new ChromeStorageAdapter<Theme>();

/**
 * Manages the "aipex-conversation-active" heartbeat in chrome.storage.local
 * so content scripts can show the breathing border overlay while the AI is
 * actively generating a response.
 */
function useConversationHeartbeat() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    // Avoid duplicate intervals
    if (intervalRef.current) return;

    const tick = () => {
      chrome.storage.local
        .set({ "aipex-conversation-active": Date.now() })
        .catch(() => {});
    };
    tick(); // Immediate first tick
    intervalRef.current = setInterval(tick, 2000);
  }, []);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    chrome.storage.local.remove("aipex-conversation-active").catch(() => {});
  }, []);

  // Cleanup on unmount
  useEffect(() => stop, [stop]);

  return { start, stop };
}

function ChatApp() {
  const { settings, isLoading } = useChatConfig({
    storageAdapter: chromeStorageAdapter,
    autoLoad: true,
  });

  const storage = useBrowserStorage();
  const modelFactory = useBrowserModelFactory();
  const contextProviders = useBrowserContextProviders();
  const tools = useBrowserTools();

  const { agent, error } = useAgent({
    settings,
    isLoading,
    modelFactory,
    storage,
    contextProviders,
    tools,
    ...BROWSER_AGENT_CONFIG,
  });

  const heartbeat = useConversationHeartbeat();

  const handleStatusChange = useCallback(
    (status: string) => {
      if (status === "streaming" || status === "submitted") {
        heartbeat.start();
      } else {
        heartbeat.stop();
      }
    },
    [heartbeat],
  );

  const [interventionMode, setInterventionMode] =
    useState<InterventionMode>("passive");

  // Sidepanel lifecycle: port connection + cleanup on hide/close
  useEffect(() => {
    // Long-lived port so the background can detect sidepanel disconnect
    const port = chrome.runtime.connect({ name: "sidepanel" });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Stop any active recording
        chrome.runtime.sendMessage({ request: "stop-recording" }).catch(() => {
          /* background may be busy */
        });
        // Stop element capture on the active tab
        chrome.runtime
          .sendMessage({
            request: "relay-to-active-tab",
            message: { request: "stop-capture" },
          })
          .catch(() => {
            /* tab may be closed */
          });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      port.disconnect();
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <InterventionModeProvider
      mode={interventionMode}
      setMode={setInterventionMode}
    >
      <ChatBot
        agent={agent}
        configError={error}
        initialSettings={settings}
        storageAdapter={chromeStorageAdapter}
        handlers={{
          onStatusChange: handleStatusChange,
        }}
        components={{
          Header: BrowserChatHeader,
        }}
        slots={{
          afterMessages: () => (
            <>
              <InterventionUI
                mode={interventionMode}
                onModeChange={setInterventionMode}
              />
              <ChatImagesListener />
            </>
          ),
          messageActions: (props) => <BrowserMessageActions {...props} />,
          inputToolbar: (props) => <AutomationModeInputToolbar {...props} />,
          promptExtras: () => <BrowserContextLoader />,
        }}
      />
    </InterventionModeProvider>
  );
}

export function renderChatApp() {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    return;
  }

  const App = () => (
    <ErrorBoundary>
      <I18nProvider storageAdapter={i18nStorageAdapter}>
        <ThemeProvider storageAdapter={themeStorageAdapter}>
          <ChatApp />
        </ThemeProvider>
      </I18nProvider>
    </ErrorBoundary>
  );

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}
