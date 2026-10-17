import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/tanstack-react-start";
import { Button } from "@/components/ui/button";

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
        <UserButton />
      </Show>
    </div>
  );
}
