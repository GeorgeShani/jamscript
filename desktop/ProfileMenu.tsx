import { useState } from "react";
import { ArrowLeftRight, Check, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function ProfileMenu({
  person,
  canSwitch,
  switchAccount,
  signOut,
}: {
  person: { name: string; email?: string | null };
  canSwitch: boolean;
  switchAccount: () => void;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const initials = (person.name || person.email || "JamScript")
    .split("@")[0]!
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const name = person.name === person.email ? "JamScript account" : person.name;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="jam-profile-trigger"
          aria-label="Open account profile"
          title={person.email ?? person.name}
        >
          <span aria-hidden="true">{initials}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="jam-profile-menu"
        aria-label="JamScript profile"
      >
        <div className="jam-profile-identity">
          <span className="jam-profile-avatar" aria-hidden="true">
            {initials}
          </span>
          <div className="jam-profile-details">
            <strong>{name}</strong>
            {person.email && <span>{person.email}</span>}
            <small>
              <Check size={12} aria-hidden="true" /> Signed in to JamScript
            </small>
          </div>
        </div>
        <div className="jam-profile-actions">
          <Button
            variant="ghost"
            className="jam-profile-action"
            disabled={!canSwitch || leaving}
            onClick={() => {
              setOpen(false);
              switchAccount();
            }}
          >
            <ArrowLeftRight size={16} aria-hidden="true" /> Switch account
          </Button>
          <Button
            variant="ghost"
            className="jam-profile-action jam-profile-signout"
            disabled={leaving}
            onClick={() => {
              setLeaving(true);
              void signOut().finally(() => {
                setLeaving(false);
                setOpen(false);
              });
            }}
          >
            <LogOut size={16} aria-hidden="true" /> {leaving ? "Signing out…" : "Sign out"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
