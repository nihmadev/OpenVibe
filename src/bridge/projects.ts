import { invoke } from "@tauri-apps/api/core";

export const projectsBridge = {
  projects: {
    list: () => invoke("projects_list"),
    active: () => invoke("projects_active"),
    add: () => invoke("projects_add"),
    setActive: (id: string) => invoke("projects_set_active", { id }),
    remove: (id: string) => invoke("projects_remove", { id }),
    rename: (id: string, name: string) => invoke("projects_rename", { id, name }),
    setColor: (id: string, color: string) => invoke("projects_set_color", { id, color }),
    setIcon: (id: string, icon: string | null) => invoke("projects_set_icon", { id, icon }),
    setPhoto: (id: string, photo: string | null) => invoke("projects_set_photo", { id, photo }),
    close: () => invoke("projects_close"),
  },
};
