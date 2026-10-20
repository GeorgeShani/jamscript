import { invoke } from "@tauri-apps/api/core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { desktopAuthError } from "./auth-errors";

type Person = { id: string; name: string; email?: string | null; imageUrl?: string | null };
type Status = { signedIn: boolean; available: boolean; pending?: Device; warning?: string };
type Device = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  accountSelectionUri?: string;
  interval: number;
  expiresIn: number;
};

type DesktopAuth = {
  person: Person | null;
  signedIn: boolean;
  hasToken: boolean;
  loading: boolean;
  available: boolean;
  device: Device | null;
  approvalReceived: boolean;
  error: string | null;
  connectionIssue: boolean;
  begin(): Promise<void>;
  openVerification(): Promise<void>;
  retryProfile(): Promise<void>;
  signOut(): Promise<void>;
};

const Context = createContext<DesktopAuth | null>(null);

export function useDesktopAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("Desktop authentication provider is missing");
  return value;
}

export function DesktopAuthProvider({ children }: { children: ReactNode }) {
  const [person, setPerson] = useState<Person | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [approvalReceived, setApprovalReceived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const accountEpoch = useRef(0);
  const profileRequest = useRef<Promise<Person> | null>(null);
  const reportError = useCallback((cause: unknown) => {
    const problem = desktopAuthError(cause);
    setError(problem.message);
    setConnectionIssue(problem.connectionIssue);
  }, []);

  useEffect(
    () => () => {
      accountEpoch.current++;
    },
    [],
  );

  const verifyProfile = useCallback(
    async (isActive: () => boolean = () => true) => {
      const epoch = accountEpoch.current;
      const current = () => isActive() && epoch === accountEpoch.current;
      const request = profileRequest.current ?? invoke<Person>("desktop_auth_profile");
      profileRequest.current = request;
      try {
        const profile = await request;
        if (!current()) return;
        setPerson(profile);
        setSignedIn(true);
        setHasToken(true);
        setError(null);
        setConnectionIssue(false);
      } catch (cause) {
        if (!current()) return;
        setPerson(null);
        setSignedIn(false);
        try {
          const status = await invoke<Status>("desktop_auth_status");
          if (!current()) return;
          setHasToken(status.signedIn);
          const problem = desktopAuthError(cause);
          setConnectionIssue(status.signedIn && problem.connectionIssue);
          setError(
            status.signedIn
              ? problem.message
              : (status.warning ??
                  "Browser approval did not create a desktop session. Sign in again."),
          );
        } catch (statusError) {
          if (!current()) return;
          reportError(statusError);
        }
      } finally {
        if (profileRequest.current === request) profileRequest.current = null;
      }
    },
    [reportError],
  );

  useEffect(() => {
    if (!hasToken || !connectionIssue || device) return;
    let active = true;
    let busy = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout>;
    const retry = async () => {
      if (!active || busy) return;
      clearTimeout(timer);
      busy = true;
      attempts++;
      await verifyProfile(() => active);
      busy = false;
      if (active && attempts < 3) timer = setTimeout(() => void retry(), 5000 * attempts);
    };
    const online = () => void retry();
    timer = setTimeout(online, 3000);
    window.addEventListener("online", online);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("online", online);
    };
  }, [hasToken, connectionIssue, device, verifyProfile]);

  useEffect(() => {
    let live = true;
    void invoke<Status>("desktop_auth_status")
      .then(async (status) => {
        if (!live) return;
        setAvailable(status.available);
        setDevice(status.pending ?? null);
        setHasToken(status.signedIn);
        setError(status.warning ?? null);
        if (!status.signedIn) return;
        await verifyProfile(() => live);
      })
      .catch((cause: unknown) => {
        if (live) reportError(cause);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [verifyProfile, reportError]);

  useEffect(() => {
    if (!device) return;
    let active = true;
    let polling = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const schedule = (delay: number) => {
      clearTimeout(timer);
      if (active) timer = setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      if (!active || polling) return;
      clearTimeout(timer);
      polling = true;
      let terminal = false;
      try {
        const result = await invoke<{ status: string; retryAfterMs?: number }>("desktop_auth_poll");
        if (!active) return;
        failures = 0;
        if (result.status === "complete") {
          terminal = true;
          accountEpoch.current++;
          profileRequest.current = null;
          setApprovalReceived(true);
          setHasToken(true);
          await verifyProfile(() => active);
          if (active) setDevice(null);
        } else if (result.status === "expired") {
          terminal = true;
          setDevice(null);
          setError("Sign-in expired or was declined. Try again.");
        } else {
          setError(null);
          schedule(Math.max(1000, result.retryAfterMs ?? device.interval * 1000));
        }
      } catch (cause) {
        if (active) {
          reportError(cause);
          failures++;
          schedule(Math.max(1000, device.interval * 1000) * Math.min(failures, 3));
        }
      } finally {
        polling = false;
        if (terminal) clearTimeout(timer);
      }
    };
    // Native code owns the OAuth rate limit, including slow_down responses.
    // Checking on resume avoids background-webview timer throttling delaying approval.
    const resume = () => {
      if (document.visibilityState !== "hidden") void poll();
    };
    schedule(Math.max(1, device.interval) * 1000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      clearTimeout(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [device, verifyProfile, reportError]);

  const begin = async () => {
    accountEpoch.current++;
    profileRequest.current = null;
    setConnectionIssue(false);
    setApprovalReceived(false);
    setError(null);
    if (!signedIn) setHasToken(false);
    try {
      setDevice(await invoke<Device>("desktop_auth_begin"));
    } catch (cause) {
      reportError(cause);
    }
  };
  const openVerification = async () => {
    try {
      await invoke("desktop_auth_open_verification");
    } catch (cause) {
      reportError(cause);
    }
  };
  const retryProfile = () => verifyProfile();
  const signOut = async () => {
    accountEpoch.current++;
    profileRequest.current = null;
    try {
      const result = await invoke<Status>("desktop_auth_sign_out");
      setPerson(null);
      setSignedIn(false);
      setHasToken(false);
      setDevice(null);
      setError(result.warning ?? null);
      setConnectionIssue(false);
    } catch (cause) {
      reportError(cause);
    }
  };
  return (
    <Context.Provider
      value={{
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
      }}
    >
      {children}
    </Context.Provider>
  );
}
