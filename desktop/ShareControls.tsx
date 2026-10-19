import type { EditorView } from "@codemirror/view";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { attachSharedDocument, type SharedPresence } from "@/features/collaboration/binding";
import { shareableDocumentName } from "@/features/collaboration/shareable";
import type { CollaborationRole } from "@/features/collaboration/shared-document";
import type { DocumentRecord } from "@/workspaces/storage";
import { useDesktopAuth } from "./auth";
import { collaborationApi } from "./collaboration-api";

type SharedItem = {
  workspaceId: string;
  documentId: string;
  documentName: string;
  workspaceName: string;
  role: string;
};

export const OPEN_SHARED_DOCUMENT = "jamscript:open-shared-document";

export function SharedProjectList() {
  const { person } = useDesktopAuth();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const reload = () => setRefresh((value) => value + 1);
    window.addEventListener("focus", reload);
    return () => window.removeEventListener("focus", reload);
  }, []);
  useEffect(() => {
    if (!person) {
      setItems([]);
      return;
    }
    let live = true;
    setLoading(true);
    void collaborationApi<SharedItem[]>("/api/shared-projects")
      .then((items) => {
        if (live) setItems(items);
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
  }, [person, refresh]);
  if (!person) return null;
  const projects = [...new Map(items.map((item) => [item.workspaceId, item])).values()];
  return (
    <section className="jam-chooser-section jam-chooser-shared" aria-labelledby="shared-heading">
      <h2 id="shared-heading">Shared with you</h2>
      <button type="button" onClick={() => setRefresh((value) => value + 1)}>
        Refresh
      </button>
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <p className="jam-muted">Loading shared projects…</p>
      ) : projects.length === 0 ? (
        <p className="jam-muted">Projects you create or join appear here.</p>
      ) : (
        <ul>
          {projects.map((item) => (
            <li key={item.workspaceId}>
              <button
                type="button"
                className="jam-shared-open"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent(OPEN_SHARED_DOCUMENT, { detail: item.documentId }),
                  )
                }
              >
                <span className="jam-shared-open-name">{item.workspaceName}</span>
                <small>
                  {items.filter((file) => file.workspaceId === item.workspaceId).length} files ·{" "}
                  {item.role}
                </small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type SharedResult = {
  workspaceId: string;
  documentId: string;
  role: CollaborationRole;
  documents: { id: string; name: string }[];
  delivery?: "email" | "link";
  url?: string;
  invitationError?: string;
};

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
  const { person } = useDesktopAuth();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [members, setMembers] = useState<{ userId: string; email: string | null; role: string }[]>(
    [],
  );
  const [invitations, setInvitations] = useState<{ id: string; email: string; role: string }[]>([]);
  const [version, setVersion] = useState(0);
  const activeDocumentId = document?.id;
  useEffect(() => {
    setSelectedIds(activeDocumentId ? [activeDocumentId] : []);
  }, [activeDocumentId]);
  useEffect(() => {
    const workspaceId = document?.shared?.workspaceId;
    if (!person || !workspaceId || document?.shared?.role !== "owner") return;
    let live = true;
    void Promise.all([
      collaborationApi<typeof members>(
        `/api/shared-projects?workspaceId=${encodeURIComponent(workspaceId)}&members=1`,
      ),
      collaborationApi<typeof invitations>(
        `/api/shared-projects?workspaceId=${encodeURIComponent(workspaceId)}&invitations=1`,
      ),
    ])
      .then(([members, invitations]) => {
        if (live) {
          setMembers(members);
          setInvitations(invitations);
        }
      })
      .catch((cause: unknown) => {
        if (live) setNotice(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      live = false;
    };
  }, [person, document?.shared?.workspaceId, document?.shared?.role, version]);
  if (!person || !document || (document.shared && document.shared.role !== "owner")) return null;

  const share = async () => {
    setPending(true);
    setNotice(null);
    setInviteUrl(null);
    try {
      const selected = document.shared
        ? [document]
        : documents.filter(
            (item) => selectedIds.includes(item.id) && shareableDocumentName(item.name),
          );
      if (!selected.length) throw new Error("Select at least one music source file");
      const result = await collaborationApi<SharedResult>("/api/shared-projects", {
        method: "POST",
        body: {
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
        },
      });
      setInviteUrl(result.url ?? null);
      if (result.workspaceId && result.documentId && result.role) {
        const ids = new Map(result.documents.map((item) => [item.name, item.id]));
        onShared(
          selected.flatMap((item) => {
            const documentId =
              ids.get(item.name) ?? (item === selected[0] ? result.documentId : null);
            return documentId
              ? [
                  {
                    ...item,
                    shared: { workspaceId: result.workspaceId, documentId, role: result.role },
                  },
                ]
              : [];
          }),
        );
      }
      setNotice(
        result.invitationError ??
          (result.delivery === "email"
            ? "Invitation email sent"
            : result.url
              ? "Share the invitation link below"
              : "Shared workspace is ready"),
      );
      setVersion((value) => value + 1);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  const ownerAction = async (action: "revoke" | "remove-member", key: string) => {
    setPending(true);
    try {
      await collaborationApi("/api/shared-projects", {
        method: "POST",
        body:
          action === "revoke"
            ? { action, invitationId: key }
            : { action, workspaceId: document.shared?.workspaceId, memberId: key },
      });
      setVersion((value) => value + 1);
      setNotice(action === "revoke" ? "Invitation revoked" : "Collaborator removed");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  };

  return (
    <details className="jam-share-control">
      <summary>{document.shared ? "Collaborators" : "Share workspace"}</summary>
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
                      setSelectedIds((ids) =>
                        event.target.checked
                          ? [...ids, item.id]
                          : ids.filter((id) => id !== item.id),
                      )
                    }
                  />
                  {item.name}
                </label>
              ))}
          </fieldset>
        )}
        <label>
          Collaborator email
          <input
            type="email"
            value={email}
            required={!!document.shared}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Access
          <select
            value={role}
            onChange={(event) => setRole(event.target.value === "viewer" ? "viewer" : "editor")}
          >
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
        </label>
        <Button size="sm" variant="outline" type="submit" disabled={pending}>
          {document.shared ? "Send invite" : "Create shared workspace"}
        </Button>
        {members.length > 0 && (
          <ul className="jam-share-people" aria-label="Collaborators">
            {members.map((member) => (
              <li key={member.userId}>
                <span>
                  {member.email ?? "Collaborator"} · {member.role}
                </span>
                {member.role !== "owner" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void ownerAction("remove-member", member.userId)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {invitations.length > 0 && (
          <ul className="jam-share-people" aria-label="Pending invitations">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <span>
                  {invitation.email} · {invitation.role} · pending
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void ownerAction("revoke", invitation.id)}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
        {notice && <span role="status">{notice}</span>}
        {inviteUrl && (
          <label>
            Invitation link
            <input value={inviteUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
        )}
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
  const { person } = useDesktopAuth();
  const shared = document.shared;
  useEffect(() => {
    if (!view || !shared || !person) return;
    return attachSharedDocument(view, {
      documentId: shared.documentId,
      role: shared.role,
      userId: person.id,
      name: person.name,
      onStatus,
      onPresence,
      authEndpoint: (room) =>
        collaborationApi<{ token: string }>("/api/collaboration/auth", {
          method: "POST",
          body: { room },
        }),
    });
    // Callback identities change on workbench renders; connection identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, shared?.documentId, shared?.role, person?.id, person?.name]);
  return null;
}
