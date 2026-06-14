import React from "react";
import { StreamingMarkdown } from "./StreamingMarkdown.js";

interface MarkdownProps {
  content: string;
  className?: string;
  isAssistant?: boolean;
  simplifiedCodeBlocks?: boolean;
  noFileIcons?: boolean;
}

export const Markdown = React.memo(function Markdown({
  content,
  className,
  isAssistant,
  simplifiedCodeBlocks,
  noFileIcons,
}: MarkdownProps) {
  return (
    <div className={"markdown-body " + (className || "")}>
      <StreamingMarkdown
        content={content}
        isAssistant={isAssistant}
        noFileIcons={noFileIcons}
        simplifiedCodeBlocks={simplifiedCodeBlocks}
      />
    </div>
  );
});
