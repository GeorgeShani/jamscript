import { Button } from "@/components/ui/button";
import { useRef, useState } from "react";
import { useDesktopAuth } from "./auth";
import { ProfileMenu } from "./ProfileMenu";
import { DeviceSignInPanel } from "./DeviceSignInPanel";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";

export function AuthControls() {
  const {
    person,
    signedIn,
    hasToken,
    loading,
    available,
    device,
    approvalReceived,
    error,
    connectionIssue,
    begin,
    openVerification,
    retryProfile,
    signOut,
  } = useDesktopAuth();
  const [dismissed, setDismissed] = useState(false);
  const controls = useRef<HTMLDivElement>(null);
  if (loading) return <span className="jam-muted">Checking account…</span>;
  const verificationLink =
    device?.accountSelectionUri || device?.verificationUriComplete || device?.verificationUri || "";
  const start = () => {
    setDismissed(false);
    void begin();
  };
  return (
    <Popover open={!!device && !dismissed} onOpenChange={(open) => setDismissed(!open)}>
      <PopoverAnchor asChild>
        <div ref={controls} className="jam-auth-controls" aria-label="JamScript account">
          {signedIn && person ? (
            <ProfileMenu
              person={person}
              canSwitch={available && !device}
              switchAccount={start}
              signOut={signOut}
            />
          ) : hasToken && connectionIssue ? (
            <span className="jam-muted">Saved sign-in</span>
          ) : (
            <Button size="sm" variant="outline" disabled={!available || !!device} onClick={start}>
              Sign in to JamScript
            </Button>
          )}
          {device && dismissed && (
            <Button variant="ghost" size="sm" onClick={() => setDismissed(false)}>
              Sign-in pending
            </Button>
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
            <div
              className={`jam-desktop-auth-error${connectionIssue ? " is-network-issue" : ""}`}
              role="alert"
            >
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
      </PopoverAnchor>
      {device && (
        <PopoverContent
          align="end"
          sideOffset={12}
          className="jam-device-popover"
          aria-label="Desktop sign-in"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            controls.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
          }}
        >
          <DeviceSignInPanel
            key={device.userCode}
            code={device.userCode}
            link={verificationLink}
            switching={signedIn}
            approved={approvalReceived}
            error={error}
            openBrowser={openVerification}
            dismiss={() => setDismissed(true)}
          />
        </PopoverContent>
      )}
    </Popover>
  );
}

export function GuestWorkspaceNotice() {
  const { signedIn, loading } = useDesktopAuth();
  return !loading && !signedIn ? (
    <p className="jam-chooser-privacy">Saved locally · No account required</p>
  ) : null;
}
