import { useAuth } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EditorView } from "@codemirror/view";

import { Button } from "@/components/ui/button";
import type { DocumentRecord } from "@/workspaces/storage";
import { attachSharedDocument, type SharedPresence } from "./binding";
import type { CollaborationRole } from "./shared-document";

export function SharedProjectList() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<
    { documentId: string; documentName: string; workspaceName: string; role: string }[]
  >([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!isSignedIn) return;
    void fetch("/api/shared-projects")
      .then(async (response) => {
        const body = (await response.json()) as { error?: string } | typeof items;
        if (!response.ok || !Array.isArray(body))
          throw new Error(!Array.isArray(body) ? body.error : "Shared projects are unavailable");
        setItems(body);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Shared projects are unavailable"),
      );
  }, [isSignedIn]);
  if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] || !isSignedIn) return null;
  return (
    <section className="jam-chooser-section" aria-labelledby="shared-heading">
      <h2 id="shared-heading">Shared projects</h2>
      {error && <p role="alert">{error}</p>}
      {items.length === 0 ? (
        <p>Projects you own or join will appear here.</p>
      ) : (
        <ul>
          {items.map((item) => (
            <li key={item.documentId}>
              <button
                type="button"
                onClick={() =>
                  void navigate({
                    to: "/app/shared/$documentId",
                    params: { documentId: item.documentId },
                  })
                }
              >
                {item.workspaceName} · {item.documentName} · {item.role}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ShareControls({
  document,
  onShared,
}: {
  document: DocumentRecord | null;
  onShared: (document: DocumentRecord) => void;
}) {
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]) return null;
  if (!isSignedIn || !document || (document.shared && document.shared.role !== "owner"))
    return null;

  const share = async () => {
    setPending(true);
    setNotice(null);
    try {
      const response = await fetch("/api/shared-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: document.shared ? "invite" : "create",
          name: document.name,
          documentName: document.name,
          source: document.source,
          workspaceId: document.shared?.workspaceId,
          email,
          role,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        url?: string;
        workspaceId?: string;
        documentId?: string;
        role?: CollaborationRole;
      };
      if (!response.ok) throw new Error(body.error ?? "Could not share this document");
      if (body.workspaceId && body.documentId && body.role) {
        onShared({
          ...document,
          shared: { workspaceId: body.workspaceId, documentId: body.documentId, role: body.role },
        });
      }
      setNotice(body.url ? `Invite link: ${body.url}` : "Shared document is ready");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not share this document");
    } finally {
      setPending(false);
    }
  };

  return (
    <form
      className="jam-share"
      onSubmit={(event) => {
        event.preventDefault();
        void share();
      }}
    >
      <label>
        Invite email
        <input
          aria-label="Invite email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          required={!!document.shared}
        />
      </label>
      <label>
        Role
        <select
          aria-label="Invitation role"
          value={role}
          onChange={(event) => setRole(event.target.value === "viewer" ? "viewer" : "editor")}
        >
          <option value="editor">Editor</option>
          <option value="viewer">Viewer</option>
        </select>
      </label>
      <Button size="sm" variant="outline" type="submit" disabled={pending}>
        {document.shared ? "Invite" : "Share"}
      </Button>
      {notice && <span role="status">{notice}</span>}
    </form>
  );
}

export function SharedSession({
  view,
  document,
  onStatus,
  onPresence,
}: {
  view: EditorView | null;
  document: DocumentRecord;
  onStatus: (status: string) => void;
  onPresence: (people: SharedPresence[]) => void;
}) {
  const shared = document.shared;
  useEffect(() => {
    if (!view || !shared) return;
    return attachSharedDocument(view, {
      documentId: shared.documentId,
      role: shared.role,
      initialSource: document.source,
      onStatus,
      onPresence,
    });
    // The source captured here is the pre-sync snapshot. Later keystrokes stay in the Yjs document.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPresence, onStatus, shared?.documentId, shared?.role, view]);
  return null;
}
