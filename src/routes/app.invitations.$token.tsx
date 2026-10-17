import { Show, SignInButton, useAuth } from "@clerk/tanstack-react-start";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/invitations/$token")({
  component: InvitationPage,
});

function InvitationPage() {
  const { token } = Route.useParams();
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const accept = async () => {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/shared-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", token }),
      });
      const body = (await response.json()) as { error?: string; documentId?: string | null };
      if (!response.ok || !body.documentId)
        throw new Error(body.error ?? "Invitation was not accepted");
      await navigate({ to: "/app/shared/$documentId", params: { documentId: body.documentId } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invitation was not accepted");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="jam-chooser">
      <div className="jam-chooser-body">
        <h1>Join a shared project</h1>
        {error && (
          <p role="alert" className="jam-error">
            {error}
          </p>
        )}
        <Show when="signed-out">
          <SignInButton mode="modal">
            <Button>Sign in to accept</Button>
          </SignInButton>
        </Show>
        {isSignedIn && (
          <Button disabled={pending} onClick={() => void accept()}>
            {pending ? "Joining" : "Accept invitation"}
          </Button>
        )}
      </div>
    </main>
  );
}
