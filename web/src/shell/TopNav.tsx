import { useEffect, useRef, useState } from "react";
import { useSession } from "@/session/SessionContext";

export type NavView = "dashboard" | "templates" | "settings";

interface Props {
  active: NavView;
  onNavigate: (view: NavView) => void;
}

const ACTIVE_LINK = "text-primary border-b-2 border-primary pb-1 text-label-md font-label-md";
const INACTIVE_LINK =
  "text-on-surface-variant hover:text-primary transition-colors text-label-md font-label-md";

/**
 * Persistent top navigation — matches documents_dashboard's nav shell.
 * Rendered once the user is authenticated, on every screen except Auth.
 */
export function TopNav({ active, onNavigate }: Props) {
  const { user, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Close the account menu on outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [menuOpen]);

  const initials = user?.name?.[0]?.toUpperCase() ?? "?";

  return (
    <nav className="fixed top-0 z-50 w-full border-b border-outline-variant/30 bg-background backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-container-max-width items-center justify-between px-margin-page">
        <div className="flex items-center gap-stack-lg">
          <span className="font-headline-md text-headline-md font-medium italic text-primary">
            Docket
          </span>

          {/* Firm/workspace switcher — cosmetic, non-functional. */}
          <div className="hidden cursor-pointer items-center gap-1 rounded border border-outline-variant/50 bg-surface-container-low px-3 py-1.5 transition-colors hover:bg-surface-container md:flex">
            <span className="text-label-sm uppercase text-on-surface-variant">Firm Workspace</span>
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">
              unfold_more
            </span>
          </div>

          <div className="ml-4 hidden items-center gap-stack-md lg:flex">
            {/* "Dashboard" and "Documents" both route to the dashboard view for now. */}
            <button type="button" className={INACTIVE_LINK} onClick={() => onNavigate("dashboard")}>
              Dashboard
            </button>
            <button
              type="button"
              className={active === "dashboard" ? ACTIVE_LINK : INACTIVE_LINK}
              aria-current={active === "dashboard" ? "page" : undefined}
              onClick={() => onNavigate("dashboard")}
            >
              Documents
            </button>
            <button
              type="button"
              className={active === "templates" ? ACTIVE_LINK : INACTIVE_LINK}
              aria-current={active === "templates" ? "page" : undefined}
              onClick={() => onNavigate("templates")}
            >
              Templates
            </button>
          </div>
        </div>

        <div className="flex items-center gap-stack-md">
          {/* Cosmetic search — no backend search exists yet. */}
          <div className="relative hidden sm:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search across chambers…"
              aria-label="Search"
              className="w-64 rounded-lg border-none bg-surface-container-lowest py-2 pl-10 pr-4 text-body-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="button"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
            aria-label="Notifications"
          >
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button
            type="button"
            className="rounded-full p-2 text-on-surface-variant transition-colors hover:bg-surface-container-low"
            aria-label="Help"
          >
            <span className="material-symbols-outlined">help</span>
          </button>

          <div className="relative ml-2" ref={menuRef}>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant font-label-sm text-label-sm text-on-primary"
              style={{ background: user?.color ?? "#75777c" }}
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Account menu"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {initials}
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-10 mt-2 w-56 rounded-lg border border-outline-variant/30 bg-surface-container-lowest py-2 ink-shadow"
              >
                <div className="border-b border-outline-variant/20 px-4 py-2">
                  <p className="truncate font-label-md text-label-md text-primary">
                    {user?.name ?? "Unknown user"}
                  </p>
                  <p className="truncate text-label-sm text-on-surface-variant">{user?.email}</p>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left font-body-md text-on-surface transition-colors hover:bg-surface-container-low"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate("settings");
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">settings</span>
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left font-body-md text-error transition-colors hover:bg-surface-container-low"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
