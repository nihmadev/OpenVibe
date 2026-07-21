import { describe, it, expect } from "vitest";
import { sanitizeMarkdown } from "../sanitizeMarkdown.js";

describe("sanitizeMarkdown", () => {
  it("leaves balanced inline code inside parentheses unchanged (e.g., (`COLORS`))", () => {
    const input = "Палитра цветов (`COLORS`): 8 полупрозрачных цветов в hex-формате (#223883ff, #0e5340ff, ...).";
    const sanitized = sanitizeMarkdown(input, false);
    expect(sanitized).toBe(input);
  });

  it("escapes unpaired stray backticks when isStreaming is false (e.g., from token dropout)", () => {
    // 3 backticks: `pick_color` (paired) and `byte` (unpaired)
    const input =
      "Алгоритм `pick_color`: простая хеш = h * 31 + byte` — детерминированная, что даёт одному и тому же пути всегда один цвет; если цвет уже занят — берётся следующий из палитры по кругу.";
    const sanitized = sanitizeMarkdown(input, false);
    expect(sanitized).toContain("`pick_color`");
    expect(sanitized).toContain("byte&#96; — детерминированная");
  });

  it("escapes single orphan backtick on a past line from token dropout", () => {
    const input =
      "chats_db(project_id) — возвращает путь к `chтного проекта (создаёт директорию если нужно).\nСледующая строка.";
    const sanitized = sanitizeMarkdown(input, false);
    expect(sanitized).toContain("путь к &#96;chтного проекта");
  });

  it("auto-closes open backtick on the actively streaming last line", () => {
    const input = "Здесь мы вызываем функцию `pick_color";
    const sanitized = sanitizeMarkdown(input, true);
    expect(sanitized).toBe("Здесь мы вызываем функцию `pick_color`");
  });

  it("auto-closes unclosed fenced code block at EOF", () => {
    const input = "Вот пример кода:\n```ts\nconst x = 42;\nconsole.log(x);";
    const sanitized = sanitizeMarkdown(input, true);
    expect(sanitized.endsWith("```")).toBe(true);
    expect(sanitized).toContain("```ts\nconst x = 42;\nconsole.log(x);\n```");
  });

  it("does not alter valid closed fenced code blocks", () => {
    const input = "```ts\nconst x = 1;\n```\nТекст после.";
    const sanitized = sanitizeMarkdown(input, false);
    expect(sanitized).toBe(input);
  });

  it("balances unclosed <file> and <folder> tags", () => {
    const input = "Посмотрите в <file>src/lib.rs и в <folder>crates/db";
    const sanitized = sanitizeMarkdown(input, true);
    expect(sanitized).toBe("Посмотрите в <file>src/lib.rs и в <folder>crates/db</file></folder>");
  });

  it("auto-recovers unclosed bold code spans like **`search_codebase", () => {
    const input = "6. **`search_codebase кодовой базе (паттерн или естественный запрос)";
    const sanitized = sanitizeMarkdown(input, false);
    expect(sanitized).toBe("6. **`search_codebase`** кодовой базе (паттерн или естественный запрос)");
  });

  it("preserves already-closed bold code spans with parentheses like **`definitions()`**", () => {
    const input = "- **`definitions()`** — вызывает `build_tool_definitions()`, затем **`execute()`**";
    const sanitized = sanitizeMarkdown(input, false);
    expect(sanitized).toBe(input);
  });
});
