import { interactiveItemClassName } from "@zazaru/ui";
import React from "react";
import type { ContentMatch } from "@/features/files/model/fs";
import { getCachedHighlight } from "../../../highlighting/searchSyntax";

export interface SearchMatchRowProps {
  match: ContentMatch;
  lang: string;
  query: string;
  matchCase: boolean;
  isLastMatch: boolean;
  isSelected: boolean;
  onOpenFile: (path: string, line?: number, column?: number, matchLength?: number) => void;
  onClose: () => void;
  onMouseEnter?: () => void;
}

export function SearchMatchRow({
  match,
  lang,
  query,
  matchCase,
  isLastMatch,
  isSelected,
  onOpenFile,
  onClose: _onClose,
  onMouseEnter,
}: SearchMatchRowProps): React.ReactElement {
  return (
    <div
      className={interactiveItemClassName(
        isSelected,
        `sc-match-row${isLastMatch ? " sc-match-row--last" : ""}${isSelected ? " sc-match-row--selected" : ""}`,
      )}
      onClick={() => {
        onOpenFile(match.path, match.line, match.column, query.length);
      }}
      onMouseEnter={onMouseEnter}
    >
      <span className="sc-match-content">{getCachedHighlight(match.content, lang, query, matchCase)}</span>
    </div>
  );
}

export const SearchMatchRowMemo = React.memo(
  SearchMatchRow,
  (prev, next) =>
    prev.match.path === next.match.path &&
    prev.match.line === next.match.line &&
    prev.match.content === next.match.content &&
    prev.lang === next.lang &&
    prev.query === next.query &&
    prev.matchCase === next.matchCase &&
    prev.isLastMatch === next.isLastMatch &&
    prev.isSelected === next.isSelected,
);
