import { useEffect, useState } from "react";
import type { InviteDTO, OrgMemberDTO, OrgRole } from "@docket/shared";
import { adminApi, ApiError } from "@/lib/api";
import { LoadingState, ErrorState, EmptyState } from "@/shell/States";
import { useSession } from "@/session/SessionContext";

function acceptUrl(invite: InviteDTO): string {
  const url = new URL(window.location.origin);
  url.searchParams.set("invite", invite.token);
  url.searchParams.set("email", invite.email);
  return url.toString();
}

export function MembersPanel() {
  const { user } = useSession();
  const [members, setMembers] = useState<OrgMemberDTO[] | null>(null);
  const [invites, setInvites] = useState<InviteDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [inviting, setInviting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function load() {
    setError(null);
    Promise.all([adminApi.members(), adminApi.invites()])
      .then(([m, i]) => {
        setMembers(m);
        setInvites(i);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load members."));
  }

  useEffect(load, []);

  async function sendInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const invite = await adminApi.createInvite({ email: inviteEmail.trim(), role: inviteRole });
      setInvites((prev) => [invite, ...(prev ?? [])]);
      setInviteEmail("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the invite.");
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(userId: string, orgRole: OrgRole) {
    setError(null);
    try {
      const updated = await adminApi.updateMemberRole(userId, { orgRole });
      setMembers((prev) => prev?.map((m) => (m.userId === userId ? updated : m)) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change that member's role.");
    }
  }

  async function removeMember(userId: string) {
    setError(null);
    try {
      await adminApi.removeMember(userId);
      setMembers((prev) => prev?.filter((m) => m.userId !== userId) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove that member.");
    }
  }

  async function revoke(id: string) {
    setError(null);
    try {
      await adminApi.revokeInvite(id);
      setInvites((prev) => prev?.filter((i) => i.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not revoke that invite.");
    }
  }

  function copy(invite: InviteDTO) {
    void navigator.clipboard.writeText(acceptUrl(invite));
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId((c) => (c === invite.id ? null : c)), 2000);
  }

  if (!members || !invites) {
    if (error) return <ErrorState title="Could not load members" body={error} onRetry={load} />;
    return <LoadingState label="Loading members…" />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-stack-lg px-margin-page py-stack-lg">
      <div>
        <h1 className="mb-unit font-headline-lg text-headline-lg text-primary">Members &amp; Invites</h1>
        <p className="font-body-md text-on-surface-variant">
          Everyone here shares this organization's Anthropic key, database, and credit balance.
        </p>
      </div>

      {error && <p className="rounded bg-error-container px-stack-md py-stack-sm text-body-md text-on-error-container">{error}</p>}

      <section className="space-y-stack-md rounded border border-outline-variant/50 bg-surface p-stack-lg">
        <h2 className="font-label-md text-label-md uppercase tracking-widest text-secondary">Invite someone</h2>
        <div className="flex flex-wrap items-end gap-stack-md">
          <label className="min-w-[220px] flex-1 space-y-stack-sm">
            <span className="font-label-md text-label-sm text-on-surface-variant">Email</span>
            <input
              type="email"
              className="w-full rounded border border-outline-variant bg-white px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@yourfirm.in"
            />
          </label>
          <label className="space-y-stack-sm">
            <span className="font-label-md text-label-sm text-on-surface-variant">Role</span>
            <select
              className="rounded border border-outline-variant bg-white px-3 py-2 text-body-md focus:border-primary focus:outline-none"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as OrgRole)}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button
            type="button"
            onClick={() => void sendInvite()}
            disabled={inviting || !inviteEmail.trim()}
            className="rounded bg-primary px-stack-lg py-2 font-label-md text-label-md text-on-primary transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {inviting ? "Creating…" : "Create invite"}
          </button>
        </div>
        <p className="text-label-sm text-on-surface-variant">
          There's no email delivery yet — copy the generated link and send it to them yourself.
        </p>

        {invites.length > 0 && (
          <ul className="space-y-stack-sm">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-stack-md rounded border border-outline-variant/50 p-stack-sm">
                <div className="min-w-0">
                  <p className="truncate font-label-md text-label-md text-on-surface">{inv.email}</p>
                  <p className="text-label-sm text-on-surface-variant">
                    {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-stack-sm">
                  <button
                    type="button"
                    onClick={() => copy(inv)}
                    className="rounded border border-outline-variant px-3 py-1.5 text-label-sm text-primary hover:bg-surface-container-high"
                  >
                    {copiedId === inv.id ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void revoke(inv.id)}
                    className="rounded border border-error/30 px-3 py-1.5 text-label-sm text-error hover:bg-error-container"
                  >
                    Revoke
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-stack-md rounded border border-outline-variant/50 bg-surface p-stack-lg">
        <h2 className="font-label-md text-label-md uppercase tracking-widest text-secondary">Members</h2>
        {members.length === 0 ? (
          <EmptyState icon="group" heading="No members yet" body="Invite your first colleague above." />
        ) : (
          <ul className="space-y-stack-sm">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center justify-between gap-stack-md rounded border border-outline-variant/50 p-stack-sm">
                <div className="flex min-w-0 items-center gap-stack-sm">
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: m.color }}
                  >
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-label-md text-label-md text-on-surface">
                      {m.name} {m.userId === user?.id && <span className="text-on-surface-variant">(you)</span>}
                    </p>
                    <p className="truncate text-label-sm text-on-surface-variant">{m.email}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-stack-sm">
                  <select
                    className="rounded border border-outline-variant bg-white px-2 py-1.5 text-label-sm focus:border-primary focus:outline-none"
                    value={m.orgRole}
                    onChange={(e) => void changeRole(m.userId, e.target.value as OrgRole)}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  {m.userId !== user?.id && (
                    <button
                      type="button"
                      onClick={() => void removeMember(m.userId)}
                      className="rounded border border-error/30 px-3 py-1.5 text-label-sm text-error hover:bg-error-container"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
