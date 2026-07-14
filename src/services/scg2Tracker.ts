import type * as monaco from "monaco-editor";
import { pushScg2Events, SCG2EventBatch } from "../tauri-bridge.js";

class SCG2TrackerService {
  private activePath: string | null = null;
  private editor: monaco.editor.IStandaloneCodeEditor | null = null;
  private monacoInstance: typeof monaco | null = null;
  private cursorTimer: ReturnType<typeof setTimeout> | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | null = null;
  private editTimer: ReturnType<typeof setTimeout> | null = null;
  private selectionTimer: ReturnType<typeof setTimeout> | null = null;

  public attach(editor: monaco.editor.IStandaloneCodeEditor, path: string, m?: typeof monaco) {
    this.editor = editor;
    this.activePath = path;
    if (m) this.monacoInstance = m;

    // Immediately emit active file switch
    this.emitBatch(false);

    // 1. Throttled Cursor Position Listener (150ms)
    editor.onDidChangeCursorPosition(() => {
      if (this.cursorTimer) return;
      this.cursorTimer = setTimeout(() => {
        this.cursorTimer = null;
        this.emitBatch(false);
      }, 150);
    });

    // 2. Selection Change Listener (200ms)
    editor.onDidChangeCursorSelection(() => {
      if (this.selectionTimer) clearTimeout(this.selectionTimer);
      this.selectionTimer = setTimeout(() => {
        this.emitBatch(false);
      }, 200);
    });

    // 3. Debounced Scroll/Visible Range Listener (300ms)
    editor.onDidScrollChange(() => {
      if (this.scrollTimer) clearTimeout(this.scrollTimer);
      this.scrollTimer = setTimeout(() => {
        this.emitBatch(false);
      }, 300);
    });

    // 4. Debounced Content Edit Listener (300ms)
    editor.onDidChangeModelContent(() => {
      if (this.editTimer) clearTimeout(this.editTimer);
      this.editTimer = setTimeout(() => {
        this.emitBatch(true);
      }, 300);
    });

    // 5. Diagnostic markers listener if Monaco instance provided
    if (m) {
      m.editor.onDidChangeMarkers(() => {
        this.emitBatch(false);
      });
    }
  }

  public updateActivePath(path: string) {
    if (this.activePath !== path) {
      this.activePath = path;
      this.emitBatch(false);
    }
  }

  private emitBatch(isEdit: boolean) {
    if (!this.activePath || !this.editor) return;

    try {
      const pos = this.editor.getPosition();
      const visibleRanges = this.editor.getVisibleRanges().map((r) => ({
        start_line: r.startLineNumber,
        end_line: r.endLineNumber,
      }));

      // Active Selection Range
      const selection = this.editor.getSelection();
      const model = this.editor.getModel();
      let selectionData: SCG2EventBatch["selection"] = undefined;

      if (selection && model && !selection.isEmpty()) {
        const selectedText = model.getValueInRange(selection);
        if (selectedText.trim().length > 0) {
          selectionData = {
            start_line: selection.startLineNumber,
            start_column: selection.startColumn,
            end_line: selection.endLineNumber,
            end_column: selection.endColumn,
            selected_text: selectedText,
          };
        }
      }

      // Model Diagnostic Markers (Compiler Errors/Warnings)
      let diagnosticsData: SCG2EventBatch["diagnostics"] = undefined;
      if (this.monacoInstance && model) {
        const markers = this.monacoInstance.editor.getModelMarkers({ resource: model.uri });
        if (markers.length > 0) {
          diagnosticsData = markers.map((m) => ({
            message: m.message,
            severity: m.severity === 8 ? "error" : m.severity === 4 ? "warning" : "info",
            start_line: m.startLineNumber,
            end_line: m.endLineNumber,
            file_path: this.activePath ?? undefined,
          }));
        }
      }

      const batch: SCG2EventBatch = {
        active_file: this.activePath,
        cursor: pos ? { line: pos.lineNumber, column: pos.column } : undefined,
        visible_ranges: visibleRanges,
        selection: selectionData,
        diagnostics: diagnosticsData,
        is_edit: isEdit,
        timestamp_ms: Date.now(),
      };

      pushScg2Events(batch);
    } catch {
      // Ignore telemetry errors
    }
  }
}

export const scg2Tracker = new SCG2TrackerService();
