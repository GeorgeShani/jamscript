import { useAuth } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EditorView } from "@codemirror/view";

import { Button } from "@/components/ui/button";
import type { DocumentRecord } from "@/workspaces/storage";
import { attachSharedDocument, type SharedPresence } from "./binding";
import type { CollaborationRole } from "./shared-document";
import { shareableDocumentName } from "./shareable";

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
  documents,
  workspaceName,
  onShared,
}: {
  document: DocumentRecord | null;
  documents: DocumentRecord[];
  workspaceName: string;
  onShared: (documents: DocumentRecord[]) => void;
}) {
  const { isSignedIn } = useAuth();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invitations, setInvitations] = useState<
    { id: string; email: string; role: string; expiresAt: string }[]
  >([]);
  const [inviteVersion, setInviteVersion] = useState(0);
  const activeDocumentId = document?.id;
  useEffect(() => {
    setSelectedIds(activeDocumentId ? [activeDocumentId] : []);
  }, [activeDocumentId]);
  useEffect(() => {
    const workspaceId = document?.shared?.workspaceId;
    if (!workspaceId || document?.shared?.role !== "owner") return;
    let current = true;
    void fetch(`/api/shared-projects?workspaceId=${encodeURIComponent(workspaceId)}&invitations=1`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load invitations");
        const rows = (await response.json()) as typeof invitations;
        if (current) setInvitations(rows);
      })
      .catch((cause: unknown) => {
        if (current)
          setNotice(cause instanceof Error ? cause.message : "Could not load invitations");
      });
    return () => {
      current = false;
    };
  }, [document?.shared?.workspaceId, document?.shared?.role, inviteVersion]);
  if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]) return null;
  if (!isSignedIn || !document || (document.shared && document.shared.role !== "owner"))
    return null;

  const share = async () => {
    setPending(true);
    setNotice(null);
    try {
      const selected = document.shared
        ? [document]
        : documents.filter(
            (item) => selectedIds.includes(item.id) && shareableDocumentName(item.name),
          );
      if (!selected.length) throw new Error("Select at least one music source file");
      const response = await fetch("/api/shared-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: document.shared ? "invite" : "create",
          name: workspaceName,
          documentName: selected[0]!.name,
          source: selected[0]!.source,
          files: document.shared
            ? undefined
            : selected.slice(1).map((item) => ({ name: item.name, source: item.source })),
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
        documents?: { id: string; name: string }[];
      };
      if (!response.ok) throw new Error(body.error ?? "Could not share this document");
      if (body.workspaceId && body.documentId && body.role) {
        const remote = new Map((body.documents ?? []).map((item) => [item.name, item.id]));
        onShared(
          selected.flatMap((item) => {
            const documentId =
              remote.get(item.name) ?? (item === selected[0] ? body.documentId : null);
            return documentId
              ? [
                  {
                    ...item,
                    shared: { workspaceId: body.workspaceId!, documentId, role: body.role! },
                  },
                ]
              : [];
          }),
        );
      }
      setNotice(body.url ? `Invite link: ${body.url}` : "Shared document is ready");
      if (document.shared) setInviteVersion((version) => version + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not share this document");
    } finally {
      setPending(false);
    }
  };

  const revoke = async (invitationId: string) => {
    setPending(true);
    try {
      const response = await fetch("/api/shared-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", invitationId }),
      });
      if (!response.ok) throw new Error("Could not revoke invitation");
      setInviteVersion((version) => version + 1);
      setNotice("Invitation revoked");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not revoke invitation");
    } finally {
      setPending(false);
    }
  };

  return (
    <details className="jam-share-control">
      <summary>{document.shared ? "Invite" : "Share"}</summary>
      <form
        className="jam-share"
        onSubmit={(event) => {
          event.preventDefault();
          void share();
        }}
      >
        {!document.shared && (
          <fieldset>
            <legend>Files to share</legend>
            {documents
              .filter((item) => shareableDocumentName(item.name))
              .map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(item.id)}
                    onChange={(event) =>
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...current, item.id]
                          : current.filter((id) => id !== item.id),
                      )
                    }
                  />
                  {item.name}
                </label>
              ))}
          </fieldset>
        )}
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
        {document.shared && invitations.length > 0 && (
          <ul aria-label="Pending invitations">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                {invitation.email} · {invitation.role}
                <button type="button" disabled={pending} onClick={() => void revoke(invitation.id)}>
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
        {notice && <span role="status">{notice}</span>}
      </form>
    </details>
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
