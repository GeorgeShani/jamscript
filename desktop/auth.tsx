import { invoke } from "@tauri-apps/api/core";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

type Person = { id: string; name: string; email?: string | null };
type Status = { signedIn: boolean; available: boolean; pending?: Device; warning?: string };
type Device = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
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
  error: string | null;
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
  const [error, setError] = useState<string | null>(null);

  const verifyProfile = useCallback(async (isActive: () => boolean = () => true) => {
    try {
      const profile = await invoke<Person>("desktop_auth_profile");
      if (!isActive()) return;
      setPerson(profile);
      setSignedIn(true);
      setHasToken(true);
      setError(null);
    } catch (cause) {
      if (!isActive()) return;
      setPerson(null);
      setSignedIn(false);
      try {
        const status = await invoke<Status>("desktop_auth_status");
        if (!isActive()) return;
        setHasToken(status.signedIn);
        setError(
          status.signedIn
            ? cause instanceof Error
              ? cause.message
              : String(cause)
            : (status.warning ??
                "Browser approval did not create a desktop session. Sign in again."),
        );
      } catch (statusError) {
        if (!isActive()) return;
        setHasToken(false);
        setError(statusError instanceof Error ? statusError.message : String(statusError));
      }
    }
  }, []);

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
        if (live) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [verifyProfile]);

  useEffect(() => {
    if (!device) return;
    let active = true;
    let polling = false;
    const interval = window.setInterval(
      () => {
        if (polling) return;
        polling = true;
        let completed = false;
        void invoke<{ status: string }>("desktop_auth_poll")
          .then(async ({ status }) => {
            if (!active) return;
            if (status === "complete") {
              completed = true;
              window.clearInterval(interval);
              await verifyProfile(() => active);
              if (active) setDevice(null);
            } else if (status === "expired") {
              window.clearInterval(interval);
              setDevice(null);
              setError("Sign-in expired or was declined. Try again.");
            } else {
              setError(null);
            }
          })
          .catch((cause: unknown) => {
            if (active) {
              if (completed) setDevice(null);
              setError(cause instanceof Error ? cause.message : String(cause));
            }
          })
          .finally(() => {
            polling = false;
          });
      },
      Math.max(1, device.interval) * 1000,
    );
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [device, verifyProfile]);

  const begin = async () => {
    setError(null);
    if (!signedIn) setHasToken(false);
    try {
      setDevice(await invoke<Device>("desktop_auth_begin"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const openVerification = async () => {
    try {
      await invoke("desktop_auth_open_verification");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const retryProfile = verifyProfile;
  const signOut = async () => {
    try {
      const result = await invoke<Status>("desktop_auth_sign_out");
      setPerson(null);
      setSignedIn(false);
      setHasToken(false);
      setDevice(null);
      setError(result.warning ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
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
        error,
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
