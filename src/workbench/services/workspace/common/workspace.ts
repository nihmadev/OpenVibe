// Project entity (owned by the projects feature).

export interface Project {
  id: string;
  path: string;
  name: string;
  color: string;
  addedAt: number;
  icon?: string | null;
  photo?: string | null;
}
