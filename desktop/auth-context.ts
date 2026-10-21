import { createContext, useContext } from "react";

export type Person = { id: string; name: string; email?: string | null; imageUrl?: string | null };
export type Status = { signedIn: boolean; available: boolean; pending?: Device; warning?: string };
export type Device = {
  userCode: string;
  verificationUri: string;
  verificationUriComplete?: string;
  accountSelectionUri?: string;
  interval: number;
  expiresIn: number;
};

export type DesktopAuth = {
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

export const Context = createContext<DesktopAuth | null>(null);

export function useDesktopAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("Desktop authentication provider is missing");
  return value;
}
