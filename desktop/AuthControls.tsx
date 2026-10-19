import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useDesktopAuth } from "./auth";
import { ProfileMenu } from "./ProfileMenu";

export function AuthControls() {
  const {
    person,
    signedIn,
    hasToken,
    loading,
    available,
    device,
    error,
    begin,
    openVerification,
    retryProfile,
    signOut,
  } = useDesktopAuth();
  const [anotherAccount, setAnotherAccount] = useState(false);
  const [copied, setCopied] = useState(false);
  if (loading) return <span className="jam-muted">Checking account…</span>;
  const verificationLink = device?.verificationUriComplete ?? device?.verificationUri ?? "";
  const start = () => {
    setAnotherAccount(false);
    setCopied(false);
    void begin();
  };
  return (
    <div className="jam-auth-controls" aria-label="JamScript account">
      {signedIn && person ? (
        <ProfileMenu
          person={person}
          canSwitch={available && !device}
          switchAccount={start}
          signOut={signOut}
        />
      ) : (
        <Button size="sm" variant="outline" disabled={!available || !!device} onClick={start}>
          Sign in to JamScript
        </Button>
      )}
      {device && (
        <div
          className="jam-desktop-device-panel"
          role="group"
          aria-label="Choose JamScript account"
        >
          <strong>Choose your JamScript account</strong>
          <p>
            Enter <strong>{device.userCode}</strong> on the JamScript sign-in page.
          </p>
          {anotherAccount ? (
            <>
              <p>
                Open this link in a private browser window, then sign in with the account you want
                to use. Your current browser session stays signed in.
              </p>
              <input
                aria-label="Verification link"
                readOnly
                value={verificationLink}
                onFocus={(event) => event.currentTarget.select()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!navigator.clipboard?.writeText) {
                    setCopied(false);
                    return;
                  }
                  void navigator.clipboard
                    .writeText(verificationLink)
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false));
                }}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </>
          ) : (
            <div className="jam-desktop-device-actions">
              <Button size="sm" onClick={() => void openVerification()}>
                Use browser account
              </Button>
              <Button size="sm" variant="outline" onClick={() => setAnotherAccount(true)}>
                Choose another account
              </Button>
            </div>
          )}
          {error && (
            <p role="alert" className="jam-error">
              {error}
            </p>
          )}
        </div>
      )}
      {!available && !signedIn && (
        <span
          className="jam-muted"
          title="Configure Clerk OAuth and the collaboration API for desktop releases"
        >
          Collaboration unavailable
        </span>
      )}
      {!device && error && (
        <div className="jam-desktop-auth-error" role="alert">
          <span>{error}</span>
          {!signedIn && hasToken && (
            <Button size="sm" variant="outline" onClick={() => void retryProfile()}>
              Retry account check
            </Button>
          )}
          {!signedIn && !hasToken && (
            <Button size="sm" variant="outline" onClick={() => void signOut()}>
              Clear saved sign-in
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function GuestWorkspaceNotice() {
  const { signedIn, loading } = useDesktopAuth();
  return !loading && !signedIn ? (
    <p className="jam-chooser-privacy">Saved locally · No account required</p>
  ) : null;
}
