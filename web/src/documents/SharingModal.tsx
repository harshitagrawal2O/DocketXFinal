import { useCallback, useEffect, useState } from "react";
import type { Role } from "@docket/shared";
import { can } from "@docket/shared";
import { docsApi } from "@/lib/api";

interface Member {
  userId: string;
  name: string;
  email: string;
  color: string;
  role: Role;
}

const INVITE_ROLE_OPTIONS: Role[] = ["editor", "commenter", "viewer"];

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  editor: "Editor",
  commenter: "Commenter",
  viewer: "Viewer",
};

/** "Anjali Mehta" -> "AM"; single-word names take the first two letters. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Canonical sharing modal (docs/STITCH_PATTERNS.md "sharing_roles_modal").
 * Not wired into DocumentWorkspace.tsx yet — drop it into the workspace
 * toolbar and render it when a "Share" action is clicked, passing the
 * current document's id/title and the viewer's own role.
 */
export function SharingModal({
  documentId,
  documentTitle,
  myRole,
  onClose,
}: {
  documentId: string;
  documentTitle: string;
  myRole: Role;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("editor");
  const [inviting, setInviting] = useState(false);

  const canManage = can(myRole, "manage_sharing");

  const load = useCallback(async () => {
    try {
      const d = await docsApi.get(documentId);
      setMembers(d.members);
    } catch {
      setError("Could not load the people with access to this document.");
    }
  }, [documentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function invite() {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    setError(null);
    try {
      await docsApi.addMember(documentId, email, inviteRole);
      setInviteEmail("");
      await load();
    } catch {
      setError("Could not invite that person. Check the email and try again.");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, role: Role) {
    setBusyUserId(userId);
    setError(null);
    try {
      await docsApi.updateMemberRole(documentId, userId, role);
      await load();
    } catch {
      setError("Could not update that member's role.");
    } finally {
      setBusyUserId(null);
    }
  }

  async function remove(userId: string) {
    if (!window.confirm("Remove this person from the document?")) return;
    setBusyUserId(userId);
    setError(null);
    try {
      await docsApi.removeMember(documentId, userId);
      await load();
    } catch {
      setError("Could not remove that member.");
    } finally {
      setBusyUserId(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-stack-md"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-[560px] flex-col overflow-hidden rounded-lg bg-surface-container-lowest ink-shadow"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-stack-lg pt-stack-lg pb-stack-md">
          <div className="space-y-1">
            <h1 className="font-headline-md text-headline-md text-primary">Share document</h1>
            <p className="font-body-md text-body-md italic text-on-surface-variant">
              {documentTitle}
            </p>
          </div>
          <button
            aria-label="Close modal"
            className="rounded-full p-2 transition-colors hover:bg-surface-container"
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-outline">close</span>
          </button>
        </div>

        {error && (
          <div className="mx-stack-lg mb-stack-sm flex items-center gap-2 rounded bg-error-container px-3 py-2 text-body-md text-on-error-container">
            <span className="material-symbols-outlined text-[18px]">error</span>
            {error}
          </div>
        )}

        {/* Invite row — only members who can manage sharing may invite. */}
        {canManage && (
          <div className="px-stack-lg py-stack-md">
            <label className="mb-2 block font-label-md text-label-md text-on-surface-variant">
              ADD MEMBERS BY EMAIL
            </label>
            <div className="flex gap-2">
              <input
                className="flex-grow border-b border-outline-variant bg-transparent px-1 py-2 font-body-md text-body-md text-on-surface placeholder:text-outline-variant outline-none transition-colors focus:border-primary"
                placeholder="e.g., senior.counsel@chambers.in"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void invite();
                }}
              />
              <div className="relative min-w-[120px]">
                <select
                  className="w-full cursor-pointer appearance-none border-b border-outline-variant bg-transparent px-1 py-2 font-label-md text-label-md text-on-surface outline-none transition-colors focus:border-primary"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                >
                  {INVITE_ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-sm text-outline">
                  expand_more
                </span>
              </div>
              <button
                className="flex items-center gap-2 rounded-sm bg-primary px-stack-md py-2 font-label-md text-label-md text-on-primary transition-all hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!inviteEmail.trim() || inviting}
                onClick={() => void invite()}
              >
                {inviting ? "Inviting…" : "Invite"}
              </button>
            </div>
          </div>
        )}

        {/* Members list */}
        <div className="flex-grow overflow-hidden px-stack-lg py-stack-md">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-label-md text-label-md text-on-surface-variant">
              PEOPLE WITH ACCESS
            </h3>
            {members && (
              <span className="font-label-sm text-label-sm uppercase tracking-widest text-secondary">
                {members.length} {members.length === 1 ? "Member" : "Members"}
              </span>
            )}
          </div>

          {members === null && !error && (
            <p className="font-body-md text-body-md italic text-on-surface-variant">
              Loading members…
            </p>
          )}

          <div className="max-h-[280px] space-y-4 overflow-y-auto pr-2">
            {members?.map((m) => (
              <div key={m.userId} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ backgroundColor: m.color }}
                  >
                    {initials(m.name)}
                  </div>
                  <div>
                    <p className="font-body-md text-body-md font-semibold text-primary">
                      {m.name}
                    </p>
                    <p className="font-label-sm text-label-sm text-outline">{m.email}</p>
                  </div>
                </div>

                {m.role === "owner" ? (
                  <span className="pr-4 font-label-md text-label-md italic text-outline">
                    Owner
                  </span>
                ) : canManage ? (
                  <select
                    className="cursor-pointer rounded border-none bg-transparent p-1 text-right font-label-md text-label-md text-primary focus:ring-0 disabled:opacity-50"
                    value={m.role}
                    disabled={busyUserId === m.userId}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "remove") {
                        void remove(m.userId);
                      } else {
                        void changeRole(m.userId, value as Role);
                      }
                    }}
                  >
                    <option value="editor">Editor</option>
                    <option value="commenter">Commenter</option>
                    <option value="viewer">Viewer</option>
                    <option value="remove" className="text-error">
                      Remove
                    </option>
                  </select>
                ) : (
                  <span className="pr-4 font-label-md text-label-md text-on-surface-variant">
                    {ROLE_LABEL[m.role]}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer restriction note */}
        <div className="flex items-start gap-3 bg-surface-container-low px-stack-lg py-stack-md">
          <span className="material-symbols-outlined pt-0.5 text-sm text-secondary">info</span>
          <p className="font-body-md text-label-sm leading-relaxed text-on-surface-variant">
            <span className="font-bold text-primary">Note: </span>
            Viewers and Commenters cannot accept AI changes, run Viki, or manage permissions.
          </p>
        </div>
      </div>
    </div>
  );
}
