/**
 * Settings section shell — left sidebar + content outlet, per the
 * reconciled IA in docs/STITCH_PATTERNS.md ("Settings information
 * architecture — pick settings_firm_profile's IA"): the app's persistent
 * top nav stays visible above this; this component only owns the
 * settings-scoped sidebar + panel switch below it. "Billing & Usage" lives
 * in this same sidebar, not a separate top-header sub-nav.
 *
 * "Members" is intentionally omitted from this sidebar — in this product,
 * membership is per-document (see docsApi.addMember/updateMemberRole), not
 * firm-wide, so a firm-wide roster item here would be fabricated. Per-doc
 * sharing already lives in the document workspace.
 *
 * Not yet wired into App.tsx — that is a separate follow-up step.
 */
import { useState } from "react";
import { BillingUsagePanel } from "@/settings/BillingUsagePanel";
import { FirmProfilePanel } from "@/settings/FirmProfilePanel";
import { SecurityPanel } from "@/settings/SecurityPanel";

type SettingsSection = "firm-profile" | "billing-usage" | "security";

const SECTIONS: Array<{ id: SettingsSection; label: string; icon: string }> = [
  { id: "firm-profile", label: "Workspace", icon: "business_center" },
  { id: "billing-usage", label: "Billing & Usage", icon: "payments" },
  { id: "security", label: "Security", icon: "security" },
];

export function SettingsShell() {
  const [active, setActive] = useState<SettingsSection>("firm-profile");

  return (
    <div className="mx-auto flex min-h-[calc(100vh-64px)] max-w-container-max-width bg-surface-container-low">
      <aside className="w-64 shrink-0 self-start sticky top-16 h-[calc(100vh-64px)] flex flex-col border-r border-outline-variant bg-surface-container-low p-stack-md">
        <div className="px-stack-md pb-stack-md mb-stack-sm border-b border-outline-variant/50">
          <p className="font-label-sm text-label-sm uppercase tracking-widest text-outline">
            Settings
          </p>
        </div>
        <nav className="flex-1 flex flex-col gap-unit" aria-label="Settings sections">
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
                    ? "flex items-center gap-stack-sm px-stack-md py-stack-md bg-surface-container-highest text-primary font-bold rounded-lg transition-all text-left"
                    : "flex items-center gap-stack-sm px-stack-md py-stack-md text-on-surface-variant hover:bg-surface-container-high transition-all rounded-lg text-left"
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
      <main className="flex-1 min-w-0 bg-surface-container-low">
        {active === "firm-profile" && <FirmProfilePanel />}
        {active === "billing-usage" && <BillingUsagePanel />}
        {active === "security" && <SecurityPanel />}
      </main>
    </div>
  );
}
