import { Button } from "@/components/ui/button";
import { invoke } from "@tauri-apps/api/core";
import { useDesktopAuth } from "./auth";

export function AuthControls() {
  const { person, signedIn, loading, available, device, error, begin, signOut } = useDesktopAuth();
  if (loading) return <span className="jam-muted">Checking account…</span>;
  return (
    <div className="jam-auth-controls" aria-label="JamScript account">
      {signedIn ? (
        <>
          <span title={person?.name ?? "Signed in"}>● {person?.name ?? "Signed in"}</span>
          <Button size="sm" variant="ghost" onClick={() => void signOut()}>
            Sign out
          </Button>
        </>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={!available || !!device}
          onClick={() => void begin()}
        >
          Sign in to JamScript
        </Button>
      )}
      {device && (
        <span role="status" className="jam-desktop-device-code">
          Enter <strong>{device.userCode}</strong> at{" "}
          <button type="button" onClick={() => void invoke("desktop_auth_open_verification")}>
            JamScript verification page
          </button>
        </span>
      )}
      {!available && !signedIn && (
        <span
          className="jam-muted"
          title="Configure Clerk OAuth and the collaboration API for desktop releases"
        >
          Collaboration unavailable
        </span>
      )}
      {error && (
        <span role="alert" className="jam-error">
          {error}
        </span>
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
