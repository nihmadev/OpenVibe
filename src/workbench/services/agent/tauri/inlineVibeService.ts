import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getLanguage } from "@/base/browser/ui/icons/iconResolver";

interface StreamOptions {
  path: string;
  promptText: string;
  originalText: string;
  onUpdate: (text: string) => void;
  onLoadingChange: (loading: boolean) => void;
  onComplete: () => void;
  onError: (message: string) => void;
}

export async function streamInlineEdit(options: StreamOptions): Promise<void> {
  const sessionId = `inline-vibe-${Date.now()}`;
  let accumulatedText = "";
  let animationFrame: number | null = null;
  let unlistenDelta: UnlistenFn = () => {};
  let unlistenDone: UnlistenFn = () => {};
  let unlistenError: UnlistenFn = () => {};

  const cleanup = () => {
    if (animationFrame !== null) cancelAnimationFrame(animationFrame);
    unlistenDelta();
    unlistenDone();
    unlistenError();
  };

  try {
    unlistenDelta = await listen<{ sessionId: string; content: string }>("vibe:llm:delta", (event) => {
      if (event.payload.sessionId !== sessionId) return;
      accumulatedText += event.payload.content;
      if (animationFrame === null) {
        animationFrame = requestAnimationFrame(() => {
          options.onUpdate(accumulatedText);
          animationFrame = null;
        });
      }
    });
    unlistenDone = await listen<{ sessionId: string }>("vibe:llm:done", (event) => {
      if (event.payload.sessionId !== sessionId) return;
      cleanup();
      options.onLoadingChange(false);
      options.onUpdate(accumulatedText);
      options.onComplete();
    });
    unlistenError = await listen<{ sessionId: string; error: string }>("vibe:llm:error", (event) => {
      if (event.payload.sessionId !== sessionId) return;
      cleanup();
      options.onLoadingChange(false);
      options.onError(`Error generating inline edits: ${event.payload.error}`);
    });

    const rawConfig = await invoke<Record<string, string | undefined> | null>("read_config");
    if (!rawConfig) throw new Error("No configuration found. Please set up your API key and model.");

    const systemPrompt = `You are an expert programmer. The user has selected a block of code in a file and requested an inline modification.
Your task is to rewrite/modify the selected code block according to the user's instructions.
Return ONLY the modified code that should replace the selected code.
Do NOT wrap the code in markdown formatting (like \`\`\`typescript ... \`\`\`), and do NOT add any conversational explanation.
Only output the raw code replacements. Ensure the indentation is correct for the selected block context.`;
    const userPrompt = `File Path: ${options.path}
File Language: ${getLanguage(options.path)}

--- SELECT CONTEXT ---
${options.originalText}
----------------------

User Instruction: ${options.promptText}`;

    await invoke("llm_stream", {
      sessionId,
      config: {
        apiKey: rawConfig.apiKey,
        baseUrl: rawConfig.baseUrl,
        model: rawConfig.model,
        apiUrl: rawConfig.apiUrl || null,
        providerId: rawConfig.providerId || null,
      },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [],
    });
  } catch (error) {
    cleanup();
    options.onLoadingChange(false);
    const message = error instanceof Error ? error.message : String(error);
    options.onError(`Failed to start stream: ${message}`);
  }
}
