import type { ReactNode } from "react";

export interface ServerPaneSlot {
  id: string;
  label: string;
  content: ReactNode;
}
