import { useCallback } from "react";
import type { SendPayload, Attachment } from "../components/prompt-input/PromptInput.js";
import type { ContentPart, VibeConfig } from "../types.js";
import { localId } from "../utils.js";

interface UseAppHandlersProps {
  setItems: React.Dispatch<React.SetStateAction<any[]>>;
  folder: string | null;
  config: VibeConfig | null;
  connectedModels: any[];
  handlePickModel: (model: string) => void;
  pendingAttachments: React.MutableRefObject<any[] | undefined>;
  busy: boolean;
}

export function useAppHandlers({
  setItems,
  folder,
  config,
  connectedModels,
  handlePickModel,
  pendingAttachments,
  busy,
}: UseAppHandlersProps) {
  const handleSlash = useCallback(
    (text: string): boolean => {
      const cmd = text.split(/\s+/)[0]!;
      switch (cmd) {
        case "/exit":
        case "/quit":
          window.vibe.window.close();
          return true;
        case "/help":
          setItems((p) => [
            ...p,
            { id: localId(), kind: "user", text },
            {
              id: localId(),
              kind: "info",
              text:
                "/help    show this list\n" +
                "/clear   clear conversation history\n" +
                "/cwd     print current working directory\n" +
                "/model   show active model and endpoint\n" +
                "/test    test tools & thinking UI\n" +
                "/exit    quit",
            },
          ]);
          return true;
        case "/clear":
        case "/reset":
          window.vibe.reset();
          setItems([{ id: localId(), kind: "info", text: "conversation cleared" }]);
          return true;
        case "/cwd":
          setItems((p) => [
            ...p,
            { id: localId(), kind: "user", text },
            { id: localId(), kind: "info", text: folder ?? config?.cwd ?? "" },
          ]);
          return true;
        case "/test":
          setItems((p) => [
            ...p,
            { id: localId(), kind: "user", text },
            // --- Thinking demos ---
            {
              id: localId(),
              kind: "assistant",
              text: "Here is my answer after thinking through the problem.",
              reasoning:
                "Let me **think** about this step by step.\n\n" +
                "1. First, I need to understand what the user is asking.\n" +
                "2. They want to implement a feature that shows **thinking** state.\n" +
                "3. The best approach is to use the `reasoning_content` field from streaming APIs.\n" +
                "4. I'll add a backend event for `reasoning-chunk` and a frontend component to display them.\n\n" +
                "> **Note:** markdown support now works in thinking blocks!",
              reasoningDone: false,
            },
            {
              id: localId(),
              kind: "assistant",
              text: "The implementation is complete. You can test it by running the app.",
              reasoning:
                "After implementing the thinking/reasoning feature, I should verify:\n\n" +
                "- Backend emits `reasoning-chunk` events properly\n" +
                "- Frontend renders the **ThinkingBlock** with correct shimmer animation\n" +
                "- Ghost chevron appears when `reasoningDone` is true\n" +
                "- Collapse/expand works correctly\n\n" +
                "Inline code: `const x = 42`, some *italic* and **bold** text.",
              reasoningDone: true,
            },
            // --- Tool UI demos ---
            {
              id: localId(),
              kind: "tool",
              toolName: "list_dir",
              toolArgs: { path: "src" },
              ok: undefined,
              text: "",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "list_dir",
              toolArgs: { path: "." },
              ok: true,
              text: "package.json\nsrc/\nnode_modules/\nREADME.md\n.gitignore\ntsconfig.json",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "list_dir",
              toolArgs: { path: "non-existent" },
              ok: false,
              text: "Error: ENOENT: no such file or directory",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "write_file",
              toolArgs: { path: "test.txt" },
              ok: true,
              text: "File written successfully",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "read_file",
              toolArgs: { path: "src/main.ts" },
              ok: undefined,
              text: "",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "read_file",
              toolArgs: { path: "src/main.ts" },
              ok: true,
              text: "import { app } from 'electron';",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "edit_file",
              toolArgs: { path: "src/App.tsx" },
              ok: true,
              text: "File edited",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "search_codebase",
              toolArgs: { path: "src", query: "todo" },
              ok: true,
              text: "src/main.ts:10: // TODO: fix this",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "search_codebase",
              toolArgs: { query: "Where is the main entry point?" },
              ok: undefined,
              text: "",
            },
            // --- Agent tool demos ---
            {
              id: localId(),
              kind: "tool",
              toolName: "agent",
              toolArgs: { task: "Find the authentication logic and identify potential bugs" },
              ok: undefined,
              text: "",
            },
            {
              id: localId(),
              kind: "tool",
              toolName: "agent",
              toolArgs: { task: "Analyze how API requests are made and where errors are handled" },
              ok: true,
              text: "Found error handling in src/services/api.ts: requests are wrapped in try/catch, but network timeouts are not handled. There's also a missing error handler for 401 responses.",
              subItems: [
                {
                  id: localId(),
                  kind: "assistant",
                  text: "I'll search the codebase for API request patterns and error handling.",
                },
                {
                  id: localId(),
                  kind: "tool",
                  toolName: "search_codebase",
                  toolArgs: { query: "fetch|axios|api.*request" },
                  ok: true,
                  text: "src/services/api.ts:15: async function apiRequest()\nsrc/services/api.ts:45: fetch(url, options)\nsrc/hooks/useApi.ts:8: const response = await apiRequest()",
                },
                {
                  id: localId(),
                  kind: "tool",
                  toolName: "read_file",
                  toolArgs: { path: "src/services/api.ts" },
                  ok: true,
                  text: "export async function apiRequest(url, options) {\n  try {\n    const res = await fetch(url, options);\n    if (!res.ok) throw new ApiError(res.status, res.statusText);\n    return res.json();\n  } catch (err) {\n    if (err instanceof ApiError) throw err;\n    throw new NetworkError('Request failed');\n  }\n}",
                },
                {
                  id: localId(),
                  kind: "assistant",
                  text: "Found the API layer. The error handling wraps requests in try/catch, but network timeouts are not explicitly handled. 401 responses are thrown as ApiError without specific handling. Let me check how errors are handled in the UI layer.",
                },
                {
                  id: localId(),
                  kind: "tool",
                  toolName: "search_codebase",
                  toolArgs: { query: "ApiError|NetworkError|error.*handler" },
                  ok: true,
                  text: "src/services/api.ts:12: class ApiError extends Error\nsrc/services/api.ts:18: class NetworkError extends Error\nsrc/hooks/useApi.ts:22: catch (err) { setError(err.message) }",
                },
                {
                  id: localId(),
                  kind: "assistant",
                  text: "The errors are caught but only the message is surfaced — users see raw error messages without any retry logic or graceful degradation. Missing: timeout handling in fetch(), 401 redirect to login, and retry logic for transient failures.",
                },
              ],
            },
          ]);
          return true;
        case "/model": {
          const arg = text.slice(6).trim();
          if (connectedModels.length === 0 && !arg) {
            setItems((p) => [
              ...p,
              { id: localId(), kind: "user", text },
              {
                id: localId(),
                kind: "info",
                text: 'No models connected yet. Open Settings "⚙" to add a provider.',
              },
            ]);
            return true;
          }

          if (!arg) {
            setItems((p) => [
              ...p,
              { id: localId(), kind: "user", text },
              {
                id: localId(),
                kind: "model-picker",
                text: "",
                models: connectedModels,
                currentModel: config?.model ?? "",
              },
            ]);
            return true;
          }
          const q = arg.toLowerCase();
          const match = connectedModels.find(
            (m) => m.id === arg || m.id.includes(q) || m.name.toLowerCase().includes(q),
          );
          const newModel = match?.id ?? arg;
          handlePickModel(newModel);
          setItems((p) => [
            ...p,
            { id: localId(), kind: "user", text },
            { id: localId(), kind: "info", text: `Switched to: ${newModel}` },
          ]);
          return true;
        }
        default:
          setItems((p) => [
            ...p,
            { id: localId(), kind: "user", text },
            {
              id: localId(),
              kind: "error",
              text: `unknown command: ${cmd}`,
            },
          ]);
          return true;
      }
    },
    [config, folder, connectedModels, handlePickModel, setItems],
  );

  const handleSubmit = useCallback(
    (payload: SendPayload | { slash: string }) => {
      if ("slash" in payload) {
        handleSlash(payload.slash);
        return;
      }
      const { parts, display, attachments } = payload;
      if (attachments.length > 0) {
        pendingAttachments.current = attachments.map((a: Attachment) => ({
          id: a.id,
          kind: a.kind,
          name: a.name,
          path: a.path,
          dataUrl: a.dataUrl,
        }));
      }
      if (parts.length === 1 && parts[0]!.type === "text") {
        window.vibe.send(parts[0]!.text).then((res) => {
          if (!res.ok && res.error) {
            setItems((p) => [...p, { id: localId(), kind: "error", text: res.error! }]);
          }
        });
        return;
      }
      window.vibe.sendParts(parts as ContentPart[], display).then((res) => {
        if (!res.ok && res.error) {
          setItems((p) => [...p, { id: localId(), kind: "error", text: res.error! }]);
        }
      });
    },
    [handleSlash, setItems, pendingAttachments],
  );

  return { handleSlash, handleSubmit };
}
