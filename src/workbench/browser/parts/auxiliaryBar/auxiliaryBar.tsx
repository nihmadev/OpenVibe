import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type React from "react";
import { CloseIcon, PlusSmallIcon, RightSidebarToggleIcon } from "@/base/browser/ui/icons/iconRegistry";
import { Tooltip } from "@/base/browser/ui/tooltip/tooltip";
import "./auxiliaryBar.css";

export type WorkspaceRightTabId = "files" | "search" | "git" | "terminal" | "browser";

export interface WorkspaceRightTab {
  id: WorkspaceRightTabId;
  label: string;
  icon: React.ReactNode;
}

export interface WorkspaceRightNewTabItem extends WorkspaceRightTab {
  shortcut?: string;
}

interface WorkspaceRightPanelProps {
  tabs: WorkspaceRightTab[];
  activeTab: WorkspaceRightTabId;
  expanded: boolean;
  newTabItems: WorkspaceRightNewTabItem[];
  onActivateTab: (tab: WorkspaceRightTabId) => void;
  onCloseTab: (tab: WorkspaceRightTabId) => void;
  onOpenTab: (tab: WorkspaceRightTabId) => void;
  onToggleExpanded: () => void;
  onToggleVisible: () => void;
  children: React.ReactNode;
}

function ExpandPanelIcon({ expanded }: { expanded: boolean }): React.ReactElement {
  return expanded ? (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4.335 11c0-.367.298-.665.665-.665s.665.298.665.665v3.335H9a.665.665 0 0 1 0 1.33H5A.665.665 0 0 1 4.335 15v-4ZM14.335 9V5.665H11a.665.665 0 0 1 0-1.33h4c.367 0 .665.298.665.665v4a.665.665 0 0 1-1.33 0Z"
        fill="currentColor"
      />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M7.335 4.335a.665.665 0 0 1 0 1.33H5.665V7.33a.665.665 0 0 1-1.33 0V5c0-.367.298-.665.665-.665h2.335ZM12.665 15.665a.665.665 0 0 1 0-1.33h1.67V12.67a.665.665 0 0 1 1.33 0V15a.665.665 0 0 1-.665.665h-2.335ZM14.335 7.33V5.665h-1.67a.665.665 0 0 1 0-1.33H15c.367 0 .665.298.665.665v2.33a.665.665 0 0 1-1.33 0ZM5.665 12.67v1.665h1.67a.665.665 0 0 1 0 1.33H5A.665.665 0 0 1 4.335 15v-2.33a.665.665 0 0 1 1.33 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function WorkspaceRightPanel({
  tabs,
  activeTab,
  expanded,
  newTabItems,
  onActivateTab,
  onCloseTab,
  onOpenTab,
  onToggleExpanded,
  onToggleVisible,
  children,
}: WorkspaceRightPanelProps): React.ReactElement {
  const expandLabel = expanded ? "Restore panel width" : "Expand panel";

  const newTabMenu = (
    <DropdownMenu.Root>
      <Tooltip text="Open new tab" side="bottom">
        <DropdownMenu.Trigger asChild>
          <button type="button" className="workspace-right-panel__toolbar-button" aria-label="Open new tab">
            <PlusSmallIcon size={16} />
          </button>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="workspace-right-panel__new-tab-menu"
          align="start"
          sideOffset={8}
          collisionPadding={8}
        >
          <DropdownMenu.Label className="workspace-right-panel__new-tab-label">Open panel</DropdownMenu.Label>
          {newTabItems.map((item) => (
            <DropdownMenu.Item
              key={item.id}
              className="workspace-right-panel__new-tab-item"
              onSelect={() => onOpenTab(item.id)}
            >
              <span className="workspace-right-panel__new-tab-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="workspace-right-panel__new-tab-title">{item.label}</span>
              {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );

  return (
    <aside className="workspace-right-panel" data-expanded={expanded} data-app-shell-focus-area="right-panel">
      <div className="workspace-right-panel__tabs">
        <div className="workspace-right-panel__tab-scroll">
          <div className="workspace-right-panel__tab-list" role="tablist" aria-label="Workspace panels">
            {tabs.map((tab) => {
              const active = tab.id === activeTab;
              return (
                <div
                  key={tab.id}
                  className={`workspace-right-panel__tab${active ? " workspace-right-panel__tab--active" : ""}`}
                  data-tab-id={tab.id}
                  onMouseUp={(event) => {
                    if (event.button === 1) onCloseTab(tab.id);
                  }}
                >
                  <span className="workspace-right-panel__tab-background" aria-hidden="true" />
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className="workspace-right-panel__tab-button"
                    onClick={() => onActivateTab(tab.id)}
                  >
                    <span className="workspace-right-panel__tab-icon" aria-hidden="true">
                      {tab.icon}
                    </span>
                    <span className="workspace-right-panel__tab-label" dir="auto">
                      {tab.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="workspace-right-panel__tab-close"
                    aria-label={`Close ${tab.label} tab`}
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseTab(tab.id);
                    }}
                  >
                    <CloseIcon size={12} />
                  </button>
                </div>
              );
            })}
            {tabs.length > 0 ? <div className="workspace-right-panel__new-tab-inline">{newTabMenu}</div> : null}
          </div>
        </div>

        <div className="workspace-right-panel__actions">
          <Tooltip text="Hide side panel" side="bottom">
            <button
              type="button"
              className="workspace-right-panel__toolbar-button workspace-right-panel__sidebar-toggle"
              aria-label="Toggle side panel"
              aria-pressed="true"
              onClick={onToggleVisible}
            >
              <RightSidebarToggleIcon active />
            </button>
          </Tooltip>
          <Tooltip text={expandLabel} side="bottom">
            <button
              type="button"
              className={`workspace-right-panel__toolbar-button${expanded ? " workspace-right-panel__toolbar-button--active" : ""}`}
              aria-label={expandLabel}
              aria-pressed={expanded}
              onClick={onToggleExpanded}
            >
              <ExpandPanelIcon expanded={expanded} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div
        className="workspace-right-panel__content"
        role="tabpanel"
        aria-label={tabs.find((tab) => tab.id === activeTab)?.label ?? "New tab"}
        data-tab-id={tabs.length > 0 ? activeTab : "new-tab"}
        tabIndex={-1}
      >
        {tabs.length > 0 ? (
          children
        ) : (
          <div className="workspace-right-panel__empty-state">
            <ul className="workspace-right-panel__empty-list" aria-label="Open a panel">
              {newTabItems.map((item) => (
                <li key={item.id} className="workspace-right-panel__empty-entry">
                  <button
                    type="button"
                    className="workspace-right-panel__empty-item"
                    onClick={() => onOpenTab(item.id)}
                  >
                    <span className="workspace-right-panel__empty-icon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="workspace-right-panel__empty-title">{item.label}</span>
                    {item.shortcut ? <kbd>{item.shortcut}</kbd> : null}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </aside>
  );
}
