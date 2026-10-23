import {
  OAuthDeviceVerification,
  SignIn,
  SignUp,
  useClerk,
  useUser,
} from "@clerk/tanstack-react-start";
import { ArrowLeftRight, ArrowRight, Monitor, ShieldCheck } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import "./desktop-connect.css";

const appearance: NonNullable<ComponentProps<typeof SignIn>["appearance"]> = {
  options: { socialButtonsVariant: "blockButton" },
  elements: {
    rootBox: { width: "100%" },
    cardBox: { width: "100%", boxShadow: "none", overflow: "visible" },
    card: { background: "transparent", boxShadow: "none", padding: 0 },
    header: { display: "none" },
    logoBox: { display: "none" },
    socialButtons: { gridTemplateColumns: "1fr", gap: "10px" },
    socialButtonsBlockButton: {
      minHeight: "44px",
      background: "var(--card)",
      border: "1px solid var(--input)",
      borderRadius: "6px",
    },
    footer: { background: "transparent" },
  },
};

export function DesktopConnect({
  userCode,
  mode = "sign-in",
}: {
  userCode: string;
  mode?: "sign-in" | "sign-up";
}) {
  return (
    <main className="jam-connect-page">
      <a className="jam-connect-brand" href="/" aria-label="JamScript home">
        <img src="/brand/logo.svg" alt="JamScript" width={133} height={28} />
      </a>
      <section className="jam-connect-content" aria-labelledby="connect-title">
        <div className="jam-connect-overview">
          <h1 id="connect-title">Connect to JamScript Desktop</h1>
          <p className="jam-connect-intro">
            Choose the account you want to use in JamScript Desktop.
          </p>
          {userCode && (
            <div className="jam-connect-device">
              <Monitor size={24} aria-hidden="true" />
              <div>
                <span>Desktop connection code</span>
                <code>{userCode}</code>
              </div>
            </div>
          )}
          <p className="jam-connect-footnote">
            <ShieldCheck size={16} aria-hidden="true" /> Local music stays on your device.
          </p>
        </div>
        <div className="jam-connect-panel">
          {userCode ? (
            import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] ? (
              <AccountChoice userCode={userCode} mode={mode} />
            ) : (
              <p role="alert">Account sign-in is not configured on this website.</p>
            )
          ) : (
            <p role="alert">
              Open this page using “Continue in browser” in JamScript Desktop to start a new
              sign-in.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}

export function AccountChoice({
  userCode,
  mode = "sign-in",
}: {
  userCode: string;
  mode?: "sign-in" | "sign-up";
}) {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [verify, setVerify] = useState(false);
  const [changing, setChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const returnPath = `/desktop/connect?user_code=${encodeURIComponent(userCode)}`;
  if (!isLoaded) return <p role="status">Checking your browser account…</p>;
  if (!isSignedIn)
    return (
      <div className="jam-connect-signin">
        {mode === "sign-up" ? (
          <SignUp
            routing="hash"
            oidcPrompt="select_account"
            forceRedirectUrl={returnPath}
            signInUrl={returnPath}
            appearance={appearance}
          />
        ) : (
          <SignIn
            routing="hash"
            oidcPrompt="select_account"
            forceRedirectUrl={returnPath}
            signUpForceRedirectUrl={returnPath}
            signUpUrl={`${returnPath}&mode=sign-up`}
            appearance={appearance}
          />
        )}
      </div>
    );
  return (
    <div className="jam-connect-choice">
      <div className="jam-connect-person">
        {user.imageUrl && <img src={user.imageUrl} alt="" width={44} height={44} />}
        <div>
          <strong>{user.fullName || user.username || "Your account"}</strong>
          <span>{user.primaryEmailAddress?.emailAddress}</span>
        </div>
      </div>
      {verify ? (
        <OAuthDeviceVerification appearance={appearance} />
      ) : (
        <>
          <Button className="jam-connect-continue" onClick={() => setVerify(true)}>
            Continue with this account <ArrowRight size={16} aria-hidden="true" />
          </Button>
          <div className="jam-connect-other">
            <Button
              variant="outline"
              disabled={changing}
              onClick={() => {
                setChanging(true);
                setError(null);
                void signOut({ redirectUrl: returnPath }).catch(() => {
                  setChanging(false);
                  setError("Couldn't switch accounts. Try again.");
                });
              }}
            >
              <ArrowLeftRight size={16} aria-hidden="true" />
              {changing ? "Opening sign-in…" : "Use another account"}
            </Button>
            <p>
              This signs you out of JamScript in this browser, then opens the available sign-in
              methods. Your desktop account stays connected until you approve a replacement.
            </p>
          </div>
        </>
      )}
      {verify && (
        <Button className="jam-connect-back" variant="ghost" onClick={() => setVerify(false)}>
          Back to account choice
        </Button>
      )}
      {error && (
        <p role="alert" className="jam-error">
          {error}
        </p>
      )}
    </div>
  );
}
