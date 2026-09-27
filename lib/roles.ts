export const roles = ["sales", "technical", "admin"] as const;
export type Role = (typeof roles)[number];

export const permissions = {
  sales: ["chat:use", "conversation:read", "knowledge:read", "feedback:create"],
  technical: [
    "chat:use",
    "conversation:read",
    "knowledge:read",
    "knowledge:write",
    "ticket:read",
    "ticket:write",
    "feedback:create",
  ],
  admin: ["*"],
} as const satisfies Record<Role, readonly string[]>;

export function hasPermission(role: Role, permission: string): boolean {
  const rolePermissions: readonly string[] = permissions[role];
  return rolePermissions.includes("*") || rolePermissions.includes(permission);
}
