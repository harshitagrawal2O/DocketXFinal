/**
 * Firm Profile — matches the settings_firm_profile mockup. There is NO
 * backend model for a firm/org profile yet (see docs/API_CONTRACT.md and
 * packages/shared — no firm/org concept), so every field here lives in
 * local component state only. Nothing is ever persisted to the account;
 * the live letterhead preview is illustrative, driven only by what the
 * user has typed in this session. See the caption near the action row.
 */
import { useEffect, useRef, useState, type ChangeEvent } from "react";

export function FirmProfilePanel() {
  const [firmName, setFirmName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [gstin, setGstin] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep the latest object URL in a ref so the unmount cleanup can revoke it
  // without needing a dependency on state inside the effect closure.
  const logoUrlRef = useRef<string | null>(null);
  logoUrlRef.current = logoUrl;
  useEffect(() => {
    return () => {
      if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current);
    };
  }, []);

  function handleLogoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLogoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }

  function handleDiscard() {
    setFirmName("");
    setJurisdiction("");
    setGstin("");
    setLogoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="max-w-4xl mx-auto py-stack-lg px-margin-page">
      <div className="mb-stack-lg">
        <h1 className="font-headline-lg text-headline-lg text-primary mb-unit">Firm Profile</h1>
        <p className="font-body-md text-on-surface-variant">
          Configure your professional identity and stationery assets for formal correspondence.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-stack-lg items-start">
        {/* Form column */}
        <section className="space-y-stack-lg">
          <div className="space-y-stack-md bg-surface p-stack-lg rounded border border-outline-variant/50">
            <h2 className="font-label-md text-label-md uppercase tracking-widest text-secondary">
              General Identity
            </h2>
            <div className="space-y-stack-sm">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="firm-name"
              >
                FIRM NAME
              </label>
              <input
                id="firm-name"
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 transition-colors py-stack-sm font-body-md text-on-surface outline-none"
                type="text"
                placeholder="e.g., Chambers of S. Rao"
                value={firmName}
                onChange={(e) => setFirmName(e.target.value)}
              />
            </div>
            <div className="space-y-stack-sm">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="firm-jurisdiction"
              >
                PRACTICE JURISDICTION
              </label>
              <input
                id="firm-jurisdiction"
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 transition-colors py-stack-sm font-body-md text-on-surface outline-none"
                type="text"
                placeholder="e.g., Supreme Court of India"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              />
            </div>
            <div className="space-y-stack-sm">
              <label
                className="font-label-md text-label-md text-on-surface-variant"
                htmlFor="firm-gstin"
              >
                TAX IDENTIFICATION (GSTIN)
              </label>
              <input
                id="firm-gstin"
                className="w-full bg-transparent border-b border-outline-variant focus:border-primary focus:ring-0 transition-colors py-stack-sm font-body-md text-on-surface outline-none"
                type="text"
                placeholder="Enter GSTIN Number"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-stack-md bg-surface p-stack-lg rounded border border-outline-variant/50">
            <h2 className="font-label-md text-label-md uppercase tracking-widest text-secondary">
              Visual Assets
            </h2>
            <div className="flex items-center justify-between gap-stack-md">
              <div>
                <h3 className="font-label-md text-label-md">Firm Logo</h3>
                <p className="text-label-sm text-on-surface-variant">
                  Vector SVG or high-res PNG (min 400×400px). Kept on this device for this
                  session only.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-stack-md py-unit border border-primary font-label-md text-label-md hover:bg-primary hover:text-on-primary transition-all rounded whitespace-nowrap"
              >
                UPLOAD
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoChange}
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-stack-md flex-wrap">
            <p className="text-label-sm text-on-surface-variant italic flex-1 min-w-[240px]">
              Firm profile is not yet saved to your account — changes apply only to this preview.
            </p>
            <button
              type="button"
              onClick={handleDiscard}
              className="px-stack-lg py-stack-sm font-label-md text-label-md text-secondary border border-outline-variant hover:bg-surface-variant transition-all rounded"
            >
              Discard Changes
            </button>
            <button
              type="button"
              disabled
              aria-disabled="true"
              title="Saving requires an account-level firm profile, which doesn't exist yet."
              className="px-stack-lg py-stack-sm font-label-md text-label-md bg-primary text-on-primary rounded opacity-50 cursor-not-allowed"
            >
              Save Profile
            </button>
          </div>
        </section>

        {/* Preview column */}
        <aside className="sticky top-[112px]">
          <h2 className="font-label-md text-label-md uppercase tracking-widest text-secondary mb-stack-md ml-unit">
            Stationery Preview
          </h2>
          <div className="bg-white paper-shadow aspect-[1/1.414] w-full max-w-sm mx-auto p-margin-page relative border border-outline-variant/20 flex flex-col overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
            <div className="flex justify-between items-start mb-stack-lg gap-stack-md">
              <div className="w-12 h-12 bg-primary flex items-center justify-center flex-shrink-0 overflow-hidden">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Firm logo preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span
                    className="material-symbols-outlined text-white text-[24px]"
                    aria-hidden="true"
                  >
                    account_balance
                  </span>
                )}
              </div>
              <div className="text-right min-w-0">
                <p className="font-headline-md text-[18px] text-primary leading-tight truncate">
                  {firmName || "Your Firm Name"}
                </p>
                <p className="font-label-sm text-[9px] text-on-surface-variant mt-unit">
                  {jurisdiction || "Practice jurisdiction not set"}
                </p>
              </div>
            </div>
            <div
              className="mb-stack-lg opacity-30"
              style={{
                height: "1px",
                background: "linear-gradient(90deg, transparent, #c5c6cc, transparent)",
              }}
            />
            <div className="flex-1 space-y-stack-md">
              <div className="h-4 w-1/4 bg-surface-container-high rounded-sm opacity-60" />
              <div className="space-y-stack-sm pt-stack-md">
                <div className="h-2 w-full bg-surface-container-high rounded-sm opacity-40" />
                <div className="h-2 w-full bg-surface-container-high rounded-sm opacity-40" />
                <div className="h-2 w-3/4 bg-surface-container-high rounded-sm opacity-40" />
              </div>
              <div className="h-8 w-2/3 bg-surface-container-high rounded-sm opacity-20 mx-auto mt-stack-lg" />
              <div className="space-y-stack-sm pt-stack-lg">
                <div className="h-2 w-full bg-surface-container-high rounded-sm opacity-40" />
                <div className="h-2 w-full bg-surface-container-high rounded-sm opacity-40" />
                <div className="h-2 w-full bg-surface-container-high rounded-sm opacity-40" />
                <div className="h-2 w-4/5 bg-surface-container-high rounded-sm opacity-40" />
              </div>
            </div>
            <div className="mt-auto pt-stack-lg border-t border-outline-variant/30 text-[8px] text-on-surface-variant italic font-serif">
              {gstin ? `GSTIN: ${gstin}` : "GSTIN not provided"}
            </div>
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none rotate-[-30deg] px-stack-lg">
              <span className="text-headline-display font-bold text-primary select-none text-center">
                {(firmName || "YOUR FIRM").toUpperCase()}
              </span>
            </div>
          </div>
          <p className="text-center font-label-sm text-label-sm text-on-surface-variant mt-stack-md italic">
            Standard A4 letterhead projection — preview only, not yet saved
          </p>
        </aside>
      </div>
    </div>
  );
}
