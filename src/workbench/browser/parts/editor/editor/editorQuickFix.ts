import type * as monaco from "monaco-editor";
import { agentService } from "@/workbench/services/agent/tauri/agentService";

let providerRegistered = false;

export function registerAgentQuickFix(m: typeof monaco): void {
  if (providerRegistered) return;
  providerRegistered = true;
  m.languages.registerHoverProvider("*", {
    provideHover: (model, position) => {
      const marker = m.editor
        .getModelMarkers({ resource: model.uri })
        .find(
          (candidate) =>
            candidate.severity === m.MarkerSeverity.Error &&
            position.lineNumber >= candidate.startLineNumber &&
            position.lineNumber <= candidate.endLineNumber &&
            position.column >= candidate.startColumn &&
            position.column <= candidate.endColumn,
        );
      if (!marker) return null;
      const args = encodeURIComponent(
        JSON.stringify([
          model.uri.path,
          marker.message,
          model.getValueInRange(marker),
          marker.startLineNumber,
          marker.endLineNumber,
        ]),
      );
      return {
        range: marker,
        contents: [
          {
            value: `[$(sparkle) Fix it (Agent)](command:agent.fixError?${args})`,
            isTrusted: true,
            supportThemeIcons: true,
          },
        ],
      };
    },
  });
}

export function attachAgentQuickFixClick(editor: monaco.editor.IStandaloneCodeEditor): void {
  const domNode = editor.getDomNode();
  if (!domNode) return;
  domNode.addEventListener(
    "click",
    (event) => {
      let target = event.target as HTMLElement;
      while (target && target !== domNode) {
        const href = target.getAttribute("data-href") || target.getAttribute("href");
        if (href?.startsWith("command:agent.fixError?")) {
          event.preventDefault();
          event.stopPropagation();
          try {
            const parsed = JSON.parse(decodeURIComponent(href.substring("command:agent.fixError?".length)));
            if (parsed.length === 5) {
              const [filePath, message, text, startLine, endLine] = parsed;
              agentService.send(
                `Please fix the following error in \`${filePath}\` (lines ${startLine}-${endLine}):\n\n**Error:**\n${message}\n\n**Code:**\n\`\`\`typescript\n${text}\n\`\`\`\n`,
              );
            }
          } catch (error) {
            console.error("Agent quick fix parse error", error);
          }
          return;
        }
        target = target.parentElement as HTMLElement;
      }
    },
    true,
  );
}
