// Main component

export { Chatbot, type ChatbotProps, ChatbotProvider } from "./chatbot";
// Individual components
export {
  ConfigurationGuide,
  type ConfigurationGuideProps,
} from "./configuration-guide";
export { DefaultHeader, Header } from "./header";
export {
  DefaultInputArea,
  type ExtendedInputAreaProps,
  InputArea,
} from "./input-area";
export { DefaultMessageItem, MessageItem } from "./message-item";
export { DefaultMessageList, MessageList } from "./message-list";
// Mode and state components
export {
  type AutomationModeValue,
  ModeIndicator,
} from "./mode-indicator";
export {
  default as StreamingStateManager,
  type StreamChunk,
  type StreamingState,
  type StreamingStateManagerProps,
  useStreamingState,
} from "./streaming-state-manager";
export {
  TokenUsageIndicator,
  type TokenUsageIndicatorProps,
} from "./token-usage-indicator";
// Prompt components
export { DefaultWelcomeScreen, WelcomeScreen } from "./welcome-screen";
