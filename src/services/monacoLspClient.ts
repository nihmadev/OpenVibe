import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type * as monaco from "monaco-editor";

type JsonRpcMessage = {
  jsonrpc: "2.0";
  id?: number | string;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
};

const LANGUAGE_SERVER_IDS: Record<string, string> = {
  typescript: "ts",
  javascript: "ts",
  html: "html",
  css: "css",
  scss: "css",
  less: "css",
  json: "json",
  python: "python",
  go: "go",
  rust: "rust",
  lua: "lua",
  ruby: "ruby",
  cpp: "cpp",
  c: "cpp",
  java: "java",
  csharp: "csharp",
  php: "php",
};

const connections = new Map<string, Promise<LspConnection>>();

export interface MonacoLspSession extends monaco.IDisposable {
  didSave(): void;
}

function lspPosition(position: monaco.Position) {
  return { line: position.lineNumber - 1, character: position.column - 1 };
}

function monacoRange(m: typeof monaco, range: any): monaco.Range {
  return new m.Range(range.start.line + 1, range.start.character + 1, range.end.line + 1, range.end.character + 1);
}

function markerSeverity(m: typeof monaco, severity?: number) {
  if (severity === 1) return m.MarkerSeverity.Error;
  if (severity === 2) return m.MarkerSeverity.Warning;
  if (severity === 3) return m.MarkerSeverity.Info;
  return m.MarkerSeverity.Hint;
}

function completionKind(m: typeof monaco, kind?: number) {
  const kinds = [
    m.languages.CompletionItemKind.Text,
    m.languages.CompletionItemKind.Method,
    m.languages.CompletionItemKind.Function,
    m.languages.CompletionItemKind.Constructor,
    m.languages.CompletionItemKind.Field,
    m.languages.CompletionItemKind.Variable,
    m.languages.CompletionItemKind.Class,
    m.languages.CompletionItemKind.Interface,
    m.languages.CompletionItemKind.Module,
    m.languages.CompletionItemKind.Property,
    m.languages.CompletionItemKind.Unit,
    m.languages.CompletionItemKind.Value,
    m.languages.CompletionItemKind.Enum,
    m.languages.CompletionItemKind.Keyword,
    m.languages.CompletionItemKind.Snippet,
    m.languages.CompletionItemKind.Color,
    m.languages.CompletionItemKind.File,
    m.languages.CompletionItemKind.Reference,
    m.languages.CompletionItemKind.Folder,
    m.languages.CompletionItemKind.EnumMember,
    m.languages.CompletionItemKind.Constant,
    m.languages.CompletionItemKind.Struct,
    m.languages.CompletionItemKind.Event,
    m.languages.CompletionItemKind.Operator,
    m.languages.CompletionItemKind.TypeParameter,
  ];
  return kinds[(kind ?? 1) - 1] ?? m.languages.CompletionItemKind.Text;
}

function markdown(value: any): monaco.IMarkdownString {
  if (typeof value === "string") return { value };
  if (value?.language && value?.value) return { value: `\`\`\`${value.language}\n${value.value}\n\`\`\`` };
  if (value?.value) return { value: value.value };
  return { value: "" };
}

class LspConnection {
  private nextId = 1;
  private pending = new Map<number | string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  private unlisten: UnlistenFn | null = null;
  private capabilities: any = {};
  private registeredLanguages = new Set<string>();

  constructor(
    private readonly id: string,
    private readonly m: typeof monaco,
    private readonly rootUri: string,
  ) {}

  async start() {
    this.unlisten = await listen<{ id: string; message: JsonRpcMessage }>("vibe:lsp:message", ({ payload }) => {
      if (payload.id === this.id) this.handleMessage(payload.message);
    });
    try {
      await invoke("lsp_start_server", { id: this.id });
      await invoke("lsp_connect", { id: this.id });
      const result = await this.request("initialize", {
        processId: null,
        clientInfo: { name: "OpenVibe", version: "1.3.5" },
        rootUri: this.rootUri,
        workspaceFolders: [{ uri: this.rootUri, name: this.rootUri.split("/").pop() || "workspace" }],
        capabilities: {
          workspace: { workspaceFolders: true, configuration: true, applyEdit: true },
          textDocument: {
            synchronization: { didSave: true, dynamicRegistration: true },
            completion: { completionItem: { snippetSupport: true, documentationFormat: ["markdown", "plaintext"] } },
            hover: { contentFormat: ["markdown", "plaintext"] },
            signatureHelp: { signatureInformation: { documentationFormat: ["markdown", "plaintext"] } },
            definition: { linkSupport: true },
            rename: { prepareSupport: false },
            publishDiagnostics: { relatedInformation: true, versionSupport: true },
          },
        },
      });
      this.capabilities = result?.capabilities ?? {};
      await this.notify("initialized", {});
    } catch (error) {
      this.unlisten?.();
      this.unlisten = null;
      throw error;
    }
  }

  attach(model: monaco.editor.ITextModel, language: string): MonacoLspSession {
    this.registerProviders(language);
    let version = model.getVersionId();
    void this.notify("textDocument/didOpen", {
      textDocument: { uri: model.uri.toString(), languageId: language, version, text: model.getValue() },
    });
    const change = model.onDidChangeContent(() => {
      version = model.getVersionId();
      void this.notify("textDocument/didChange", {
        textDocument: { uri: model.uri.toString(), version },
        contentChanges: [{ text: model.getValue() }],
      });
    });

    return {
      didSave: () => {
        void this.notify("textDocument/didSave", {
          textDocument: { uri: model.uri.toString() },
          text: model.getValue(),
        });
      },
      dispose: () => {
        change.dispose();
        void this.notify("textDocument/didClose", { textDocument: { uri: model.uri.toString() } });
        this.m.editor.setModelMarkers(model, `lsp:${this.id}`, []);
      },
    };
  }

  private async send(message: JsonRpcMessage) {
    await invoke("lsp_send", { id: this.id, message });
  }

  private async notify(method: string, params: any) {
    await this.send({ jsonrpc: "2.0", method, params });
  }

  private request(method: string, params: any): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      void this.send({ jsonrpc: "2.0", id, method, params }).catch((error) => {
        this.pending.delete(id);
        reject(error);
      });
    });
  }

  private handleMessage(message: JsonRpcMessage) {
    if (message.id !== undefined && !message.method) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? "LSP request failed"));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === "textDocument/publishDiagnostics") {
      const uri = this.m.Uri.parse(message.params.uri);
      const model = this.m.editor.getModel(uri);
      if (!model) return;
      const markers = (message.params.diagnostics ?? []).map((diagnostic: any) => ({
        ...monacoRange(this.m, diagnostic.range),
        severity: markerSeverity(this.m, diagnostic.severity),
        message: diagnostic.message,
        source: diagnostic.source ?? this.id,
        code: diagnostic.code == null ? undefined : String(diagnostic.code),
      }));
      this.m.editor.setModelMarkers(model, `lsp:${this.id}`, markers);
      return;
    }
    if (message.id !== undefined && message.method) {
      let result: any = null;
      if (message.method === "workspace/configuration") result = (message.params?.items ?? []).map(() => null);
      else if (message.method === "workspace/workspaceFolders") {
        result = [{ uri: this.rootUri, name: this.rootUri.split("/").pop() || "workspace" }];
      } else if (
        message.method === "window/workDoneProgress/create" ||
        message.method === "client/registerCapability"
      ) {
        result = null;
      }
      void this.send({ jsonrpc: "2.0", id: message.id, result });
    }
  }

  private registerProviders(language: string) {
    if (this.registeredLanguages.has(language)) return;
    this.registeredLanguages.add(language);
    this.disableBuiltInServices(language);
    const document = (model: monaco.editor.ITextModel) => ({ uri: model.uri.toString() });
    const params = (model: monaco.editor.ITextModel, position: monaco.Position) => ({
      textDocument: document(model),
      position: lspPosition(position),
    });

    if (this.capabilities.completionProvider) {
      this.m.languages.registerCompletionItemProvider(language, {
        triggerCharacters: this.capabilities.completionProvider.triggerCharacters,
        provideCompletionItems: async (model, position) => {
          const result = await this.request("textDocument/completion", params(model, position));
          const items = Array.isArray(result) ? result : (result?.items ?? []);
          return {
            incomplete: Boolean(result?.isIncomplete),
            suggestions: items.map((item: any) => {
              const edit = item.textEdit;
              return {
                label: item.label,
                kind: completionKind(this.m, item.kind),
                detail: item.detail,
                documentation: item.documentation ? markdown(item.documentation) : undefined,
                insertText: edit?.newText ?? item.insertText ?? item.label,
                insertTextRules:
                  item.insertTextFormat === 2
                    ? this.m.languages.CompletionItemInsertTextRule.InsertAsSnippet
                    : undefined,
                range: edit?.range ? monacoRange(this.m, edit.range) : undefined,
                sortText: item.sortText,
                filterText: item.filterText,
              };
            }),
          };
        },
      });
    }
    if (this.capabilities.hoverProvider) {
      this.m.languages.registerHoverProvider(language, {
        provideHover: async (model, position) => {
          const result = await this.request("textDocument/hover", params(model, position));
          if (!result) return null;
          const contents = Array.isArray(result.contents) ? result.contents : [result.contents];
          return {
            contents: contents.map(markdown),
            range: result.range ? monacoRange(this.m, result.range) : undefined,
          };
        },
      });
    }
    if (this.capabilities.definitionProvider) {
      this.m.languages.registerDefinitionProvider(language, {
        provideDefinition: async (model, position) =>
          this.locations(await this.request("textDocument/definition", params(model, position))),
      });
    }
    if (this.capabilities.referencesProvider) {
      this.m.languages.registerReferenceProvider(language, {
        provideReferences: async (model, position) =>
          this.locations(
            await this.request("textDocument/references", {
              ...params(model, position),
              context: { includeDeclaration: true },
            }),
          ),
      });
    }
    if (this.capabilities.renameProvider) {
      this.m.languages.registerRenameProvider(language, {
        provideRenameEdits: async (model, position, newName) =>
          this.workspaceEdit(await this.request("textDocument/rename", { ...params(model, position), newName })),
        resolveRenameLocation: async (model, position) => ({
          range: model.getWordAtPosition(position)
            ? new this.m.Range(
                position.lineNumber,
                model.getWordAtPosition(position)!.startColumn,
                position.lineNumber,
                model.getWordAtPosition(position)!.endColumn,
              )
            : new this.m.Range(position.lineNumber, position.column, position.lineNumber, position.column),
          text: model.getWordAtPosition(position)?.word ?? "",
        }),
      });
    }
    if (this.capabilities.documentFormattingProvider) {
      this.m.languages.registerDocumentFormattingEditProvider(language, {
        provideDocumentFormattingEdits: async (model, options) =>
          this.textEdits(await this.request("textDocument/formatting", { textDocument: document(model), options })),
      });
    }
    if (this.capabilities.signatureHelpProvider) {
      this.m.languages.registerSignatureHelpProvider(language, {
        signatureHelpTriggerCharacters: this.capabilities.signatureHelpProvider.triggerCharacters ?? [],
        signatureHelpRetriggerCharacters: this.capabilities.signatureHelpProvider.retriggerCharacters ?? [],
        provideSignatureHelp: async (model, position) => {
          const value = await this.request("textDocument/signatureHelp", params(model, position));
          return value ? { value, dispose() {} } : null;
        },
      });
    }
  }

  private locations(value: any): monaco.languages.Location[] {
    const locations = value == null ? [] : Array.isArray(value) ? value : [value];
    return locations.map((location: any) => ({
      uri: this.m.Uri.parse(location.uri ?? location.targetUri),
      range: monacoRange(this.m, location.range ?? location.targetSelectionRange ?? location.targetRange),
    }));
  }

  private textEdits(edits: any[] | null): monaco.languages.TextEdit[] {
    return (edits ?? []).map((edit) => ({ range: monacoRange(this.m, edit.range), text: edit.newText }));
  }

  private workspaceEdit(edit: any): monaco.languages.WorkspaceEdit {
    const edits: monaco.languages.IWorkspaceTextEdit[] = [];
    for (const [uri, changes] of Object.entries<any[]>(edit?.changes ?? {})) {
      for (const change of changes)
        edits.push({
          resource: this.m.Uri.parse(uri),
          textEdit: { range: monacoRange(this.m, change.range), text: change.newText },
          versionId: undefined,
        });
    }
    for (const change of edit?.documentChanges ?? []) {
      if (!change.textDocument || !change.edits) continue;
      for (const textEdit of change.edits)
        edits.push({
          resource: this.m.Uri.parse(change.textDocument.uri),
          textEdit: { range: monacoRange(this.m, textEdit.range), text: textEdit.newText },
          versionId: change.textDocument.version ?? undefined,
        });
    }
    return { edits };
  }

  private disableBuiltInServices(language: string) {
    const languages: any = this.m.languages;
    const mode = {
      completionItems: false,
      hovers: false,
      documentSymbols: false,
      definitions: false,
      references: false,
      documentHighlights: false,
      rename: false,
      diagnostics: false,
      signatureHelp: false,
      documentFormattingEdits: false,
      documentRangeFormattingEdits: false,
    };
    if (language === "typescript" || language === "javascript") {
      const defaults =
        language === "typescript" ? languages.typescript?.typescriptDefaults : languages.typescript?.javascriptDefaults;
      defaults?.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: true });
      defaults?.setModeConfiguration?.(mode);
    } else {
      const defaults =
        language === "json"
          ? languages.json?.jsonDefaults
          : language === "html"
            ? languages.html?.htmlDefaults
            : language === "css" || language === "scss" || language === "less"
              ? languages.css?.[`${language}Defaults`]
              : null;
      defaults?.setDiagnosticsOptions?.({ validate: false });
      defaults?.setModeConfiguration?.(mode);
    }
  }
}

export async function connectMonacoLsp(
  m: typeof monaco,
  model: monaco.editor.ITextModel,
  cwd: string,
): Promise<MonacoLspSession | null> {
  const language = model.getLanguageId();
  const id = LANGUAGE_SERVER_IDS[language];
  if (!id) return null;
  const rootUri = m.Uri.file(cwd).toString();
  const key = id;
  let connection = connections.get(key);
  if (!connection) {
    connection = (async () => {
      const client = new LspConnection(id, m, rootUri);
      await client.start();
      return client;
    })();
    connections.set(key, connection);
    connection.catch(() => connections.delete(key));
  }
  return (await connection).attach(model, language);
}
