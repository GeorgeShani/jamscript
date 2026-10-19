import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useClerk,
} from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";

function ProfileButton() {
  const clerk = useClerk();
  return (
    <Button size="sm" variant="ghost" onClick={() => clerk.openUserProfile()}>
      Profile
    </Button>
  );
}

/** Local browser workspaces remain available before Clerk keys are configured. */
export function AuthControls() {
  if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]) return null;

  return (
    <div className="jam-auth-controls" aria-label="Account">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <Button size="sm" variant="ghost">
            Sign in
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button size="sm" variant="outline">
            Sign up
          </Button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <ProfileButton />
        <UserButton />
      </Show>
    </div>
  );
}

export function GuestWorkspaceNotice() {
  const notice = <p className="jam-chooser-privacy">Saved locally · No account required</p>;
  if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]) return notice;
  return <Show when="signed-out">{notice}</Show>;
}
