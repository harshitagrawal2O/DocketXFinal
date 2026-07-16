/** Per-document roles (PRD §4.1). Ordered by capability. */
export const ROLES = ["owner", "editor", "commenter", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type Capability =
  | "edit" // mutate the live Yjs doc
  | "comment" // create/resolve comment threads
  | "run_agent" // start a Viki run
  | "review" // accept/reject/edit-then-accept proposals
  | "manage_sharing" // invite/change roles
  | "manage_versions"; // save/rollback versions

const CAPS: Record<Role, Capability[]> = {
  owner: ["edit", "comment", "run_agent", "review", "manage_sharing", "manage_versions"],
  editor: ["edit", "comment", "run_agent", "review", "manage_versions"],
  commenter: ["comment"],
  viewer: [],
};

export function can(role: Role, cap: Capability): boolean {
  return CAPS[role].includes(cap);
}
