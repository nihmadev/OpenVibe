// Typed Tauri adapter for project persistence commands.
import { invoke } from "@tauri-apps/api/core";
import type { Project } from "../common/workspace";

export const workspaceService = {
  list: (): Promise<Project[]> => invoke<Project[]>("projects_list"),
  active: (): Promise<Project | null> => invoke<Project | null>("projects_active"),
  add: (): Promise<Project | null> => invoke<Project | null>("projects_add"),
  setActive: (id: string): Promise<Project | null> => invoke<Project | null>("projects_set_active", { id }),
  remove: (id: string): Promise<Project | null> => invoke<Project | null>("projects_remove", { id }),
  rename: (id: string, name: string): Promise<void> => invoke("projects_rename", { id, name }),
  setColor: (id: string, color: string): Promise<void> => invoke("projects_set_color", { id, color }),
  setIcon: (id: string, icon: string | null): Promise<void> => invoke("projects_set_icon", { id, icon }),
  setPhoto: (id: string, photo: string | null): Promise<void> => invoke("projects_set_photo", { id, photo }),
  close: (): Promise<void> => invoke("projects_close"),
};
