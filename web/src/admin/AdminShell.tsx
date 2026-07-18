/**
 * Admin portal shell — visible only to org admins (gated in App.tsx by
 * user.orgRole === "admin"). Same left-sidebar + content-outlet pattern as
 * SettingsShell, but this is org-wide administration, not personal settings:
 * organization profile, members & invites, the org's own Anthropic API key,
 * the org's own database connection, and credits/usage.
 */
import { useState } from "react";
import { OrganizationPanel } from "@/admin/OrganizationPanel";
import { MembersPanel } from "@/admin/MembersPanel";
import { ApiKeyPanel } from "@/admin/ApiKeyPanel";
import { DatabasePanel } from "@/admin/DatabasePanel";
import { CreditsPanel } from "@/admin/CreditsPanel";

type AdminSection = "organization" | "members" | "api-key" | "database" | "credits";

const SECTIONS: Array<{ id: AdminSection; label: string; icon: string }> = [
  { id: "organization", label: "Organization", icon: "business_center" },
  { id: "members", label: "Members & Invites", icon: "group" },
  { id: "api-key", label: "Anthropic API Key", icon: "vpn_key" },
  { id: "database", label: "Database", icon: "storage" },
  { id: "credits", label: "Credits & Usage", icon: "toll" },
];

export function AdminShell() {
  const [active, setActive] = useState<AdminSection>("organization");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-container-max-width bg-surface-container-low">
      <aside className="sticky top-16 flex h-[calc(100vh-64px)] w-64 shrink-0 flex-col self-start border-r border-outline-variant bg-surface-container-low p-stack-md">
        <div className="mb-stack-sm border-b border-outline-variant/50 px-stack-md pb-stack-md">
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-outline">Admin Portal</p>
        </div>
        <nav className="flex flex-1 flex-col gap-unit" aria-label="Admin sections">
          {SECTIONS.map((section) => {
            const isActive = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActive(section.id)}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "flex items-center gap-stack-sm rounded-lg bg-surface-container-highest px-stack-md py-stack-md text-left font-bold text-primary transition-all"
                    : "flex items-center gap-stack-sm rounded-lg px-stack-md py-stack-md text-left text-on-surface-variant transition-all hover:bg-surface-container-high"
                }
              >
                <span className="material-symbols-outlined" aria-hidden="true">
                  {section.icon}
                </span>
                <span className="font-label-md text-label-md">{section.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="min-w-0 flex-1 bg-surface-container-low">
        {active === "organization" && <OrganizationPanel />}
        {active === "members" && <MembersPanel />}
        {active === "api-key" && <ApiKeyPanel />}
        {active === "database" && <DatabasePanel />}
        {active === "credits" && <CreditsPanel />}
      </main>
    </div>
  );
}
