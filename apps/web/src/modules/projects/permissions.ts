import type { OrganizationRole } from "@agentforge/contracts";

export function canManageProjects(role: OrganizationRole): boolean {
  return role === "owner" || role === "admin";
}
