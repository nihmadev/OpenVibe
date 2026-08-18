import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import type React from "react";
import { CheckIcon } from "@/base/browser/ui/icons/iconRegistry";
import { useI18n } from "@/platform/localization/localizationService";
import "./displayOptionsDropdown.css";

export interface DisplayOptions {
  groupBy: "project" | "none";
  sortBy: "last_updated" | "alphabetical" | "date_added";
  showSubtitles: boolean;
  showArchived: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  options: DisplayOptions;
  onChange: (options: DisplayOptions) => void;
  align?: "start" | "center" | "end" | "left" | "right";
  children?: React.ReactNode;
}

export function DisplayOptionsDropdown({
  isOpen,
  onClose,
  options,
  onChange,
  align = "end",
  children,
}: Props): React.ReactElement | null {
  const { t } = useI18n();
  const radixAlign: "start" | "center" | "end" = align === "left" ? "start" : align === "right" ? "end" : align;

  return (
    <DropdownPrimitive.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {children ? <DropdownPrimitive.Trigger asChild>{children}</DropdownPrimitive.Trigger> : null}
      <DropdownPrimitive.Portal>
        <DropdownPrimitive.Content
          className="display-options-dropdown"
          align={radixAlign}
          sideOffset={6}
          onEscapeKeyDown={onClose}
          onPointerDownOutside={onClose}
        >
          {/* Group By Section */}
          <div className="display-options-dropdown__section">
            <DropdownPrimitive.Label className="display-options-dropdown__header">
              {t("groupBy" as any) || "Group By"}
            </DropdownPrimitive.Label>
            <DropdownPrimitive.Item
              className={`display-options-dropdown__item${options.groupBy === "project" ? " display-options-dropdown__item--selected" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                onChange({ ...options, groupBy: "project" });
              }}
            >
              <span>{t("groupByProject" as any) || "Project"}</span>
              {options.groupBy === "project" && (
                <span className="display-options-dropdown__check">
                  <CheckIcon />
                </span>
              )}
            </DropdownPrimitive.Item>
            <DropdownPrimitive.Item
              className={`display-options-dropdown__item${options.groupBy === "none" ? " display-options-dropdown__item--selected" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                onChange({ ...options, groupBy: "none" });
              }}
            >
              <span>{t("groupByNone" as any) || "None"}</span>
              {options.groupBy === "none" && (
                <span className="display-options-dropdown__check">
                  <CheckIcon />
                </span>
              )}
            </DropdownPrimitive.Item>
          </div>

          <DropdownPrimitive.Separator className="display-options-dropdown__divider" />

          {/* Sort Section */}
          <div className="display-options-dropdown__section">
            <DropdownPrimitive.Label className="display-options-dropdown__header">
              {t("sortConversations" as any) || "Sort Conversations"}
            </DropdownPrimitive.Label>
            <DropdownPrimitive.Item
              className={`display-options-dropdown__item${options.sortBy === "last_updated" ? " display-options-dropdown__item--selected" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                onChange({ ...options, sortBy: "last_updated" });
              }}
            >
              <span>{t("sortByLastUpdated" as any) || "Last Updated"}</span>
              {options.sortBy === "last_updated" && (
                <span className="display-options-dropdown__check">
                  <CheckIcon />
                </span>
              )}
            </DropdownPrimitive.Item>
            <DropdownPrimitive.Item
              className={`display-options-dropdown__item${options.sortBy === "alphabetical" ? " display-options-dropdown__item--selected" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                onChange({ ...options, sortBy: "alphabetical" });
              }}
            >
              <span>{t("sortByAlphabetical" as any) || "Alphabetical (A-Z)"}</span>
              {options.sortBy === "alphabetical" && (
                <span className="display-options-dropdown__check">
                  <CheckIcon />
                </span>
              )}
            </DropdownPrimitive.Item>
            <DropdownPrimitive.Item
              className={`display-options-dropdown__item${options.sortBy === "date_added" ? " display-options-dropdown__item--selected" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                onChange({ ...options, sortBy: "date_added" });
              }}
            >
              <span>{t("sortByDateAdded" as any) || "Date Added"}</span>
              {options.sortBy === "date_added" && (
                <span className="display-options-dropdown__check">
                  <CheckIcon />
                </span>
              )}
            </DropdownPrimitive.Item>
          </div>

          <DropdownPrimitive.Separator className="display-options-dropdown__divider" />

          {/* Toggle options */}
          <div className="display-options-dropdown__section">
            <DropdownPrimitive.Item
              className={`display-options-dropdown__item${options.showSubtitles ? " display-options-dropdown__item--selected" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                onChange({ ...options, showSubtitles: !options.showSubtitles });
              }}
            >
              <span>{t("showSubtitles" as any) || "Show Subtitles"}</span>
              {options.showSubtitles && (
                <span className="display-options-dropdown__check">
                  <CheckIcon />
                </span>
              )}
            </DropdownPrimitive.Item>
            <DropdownPrimitive.Item
              className={`display-options-dropdown__item${options.showArchived ? " display-options-dropdown__item--selected" : ""}`}
              onSelect={(e) => {
                e.preventDefault();
                onChange({ ...options, showArchived: !options.showArchived });
              }}
            >
              <span>{t("showArchived" as any) || "Show Archived"}</span>
              {options.showArchived && (
                <span className="display-options-dropdown__check">
                  <CheckIcon />
                </span>
              )}
            </DropdownPrimitive.Item>
          </div>
        </DropdownPrimitive.Content>
      </DropdownPrimitive.Portal>
    </DropdownPrimitive.Root>
  );
}
