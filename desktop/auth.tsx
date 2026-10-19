import { invoke } from "@tauri-apps/api/core";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { collaborationApi } from "./collaboration-api";

type Person = { id: string; name: string };
type Status = { signedIn: boolean; available: boolean; warning?: string };
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
  loading: boolean;
  available: boolean;
  device: Device | null;
  error: string | null;
  begin(): Promise<void>;
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
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(false);
  const [device, setDevice] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void invoke<Status>("desktop_auth_status")
      .then(async (status) => {
        if (!live) return;
        setAvailable(status.available);
        setSignedIn(status.signedIn);
        if (!status.signedIn) return;
        const profile = await collaborationApi<Person>("/api/desktop-session");
        if (live) setPerson(profile);
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
  }, []);

  useEffect(() => {
    if (!device) return;
    let active = true;
    const interval = window.setInterval(
      () => {
        void invoke<{ status: string }>("desktop_auth_poll")
          .then(async ({ status }) => {
            if (!active) return;
            if (status === "complete") {
              window.clearInterval(interval);
              setSignedIn(true);
              const profile = await collaborationApi<Person>("/api/desktop-session");
              if (active) {
                setPerson(profile);
                setDevice(null);
                setError(null);
              }
            } else if (status === "expired") {
              window.clearInterval(interval);
              setDevice(null);
              setError("Sign-in expired or was declined. Try again.");
            }
          })
          .catch((cause: unknown) => {
            if (active) {
              window.clearInterval(interval);
              setDevice(null);
              setError(cause instanceof Error ? cause.message : String(cause));
            }
          });
      },
      Math.max(1, device.interval) * 1000,
    );
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [device]);

  const begin = async () => {
    setError(null);
    try {
      setDevice(await invoke<Device>("desktop_auth_begin"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const signOut = async () => {
    try {
      const result = await invoke<Status>("desktop_auth_sign_out");
      setPerson(null);
      setSignedIn(false);
      setDevice(null);
      setError(result.warning ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <Context.Provider
      value={{ person, signedIn, loading, available, device, error, begin, signOut }}
    >
      {children}
    </Context.Provider>
  );
}
