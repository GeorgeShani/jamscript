import { Check, Copy, ExternalLink, Monitor, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import "./device-sign-in.css";

export function DeviceSignInPanel({
  code,
  link,
  switching,
  error,
  openBrowser,
  dismiss,
}: {
  code: string;
  link: string;
  switching: boolean;
  error: string | null;
  openBrowser(): Promise<void>;
  dismiss(): void;
}) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [opening, setOpening] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
    }
  };
  return (
    <section className="jam-desktop-device-panel" aria-label="Choose JamScript account">
      <header className="jam-device-heading">
        <span className="jam-device-icon">
          <Monitor size={20} aria-hidden="true" />
        </span>
        <div>
          <h2>{switching ? "Switch your account" : "Connect your account"}</h2>
          <p>Continue securely in your browser</p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Dismiss sign-in panel" onClick={dismiss}>
          <X />
        </Button>
      </header>
      <div className="jam-device-body">
        <p>Choose an account and sign-in method on JamScript, then approve this device.</p>
        <div className="jam-device-code">
          <span>Match this code</span>
          <strong>{code}</strong>
        </div>
        <Button
          className="jam-device-open"
          disabled={opening}
          onClick={() => {
            setOpening(true);
            void openBrowser().finally(() => setOpening(false));
          }}
        >
          {opening ? "Opening browser…" : "Continue in browser"}
          <ExternalLink size={16} aria-hidden="true" />
        </Button>
        {switching && (
          <p className="jam-device-reassurance">
            Your current desktop account stays connected until the new account is approved.
          </p>
        )}
        <div className="jam-device-waiting" role="status">
          <span aria-hidden="true" />
          Waiting for browser approval
        </div>
        {error && (
          <p role="alert" className="jam-error">
            {error}
          </p>
        )}
      </div>
      <footer className="jam-device-footer">
        <span>Browser didn’t open?</span>
        <Button variant="ghost" size="sm" onClick={() => void copy()}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Link copied" : "Copy sign-in link"}
        </Button>
      </footer>
      {copyError && (
        <div className="jam-device-copy-fallback">
          <label htmlFor="jam-device-link">Copy this sign-in link</label>
          <input
            id="jam-device-link"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      )}
    </section>
  );
}
