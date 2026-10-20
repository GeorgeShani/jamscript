import { useAuth, useUser } from "@clerk/tanstack-react-start";
import { useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { EditorView } from "@codemirror/view";

import { Button } from "@/components/ui/button";
import { SessionLoader } from "@/components/SessionLoader";
import { browserStorage } from "@/workspaces/storage";
import type { DocumentRecord } from "@/workspaces/storage";
import { attachSharedDocument, type SharedPresence } from "./binding";
import { detachLocalWorkspace } from "./detach-local-workspace";
import { SharedWorkspaceRow } from "./SharedWorkspaceRow";
import { SharedWorkspaceHeading } from "./SharedWorkspaceHeading";
import type { CollaborationRole } from "./shared-document";
import { shareableDocumentName } from "./shareable";

export function SharedProjectList() {
  const { isSignedIn } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<
    {
      workspaceId: string;
      documentId: string;
      documentName: string;
      workspaceName: string;
      role: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!isSignedIn) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(null);
    void fetch("/api/shared-projects")
      .then(async (response) => {
        const body = (await response.json()) as { error?: string } | typeof items;
        if (!response.ok || !Array.isArray(body))
          throw new Error(!Array.isArray(body) ? body.error : "Shared projects are unavailable");
        setItems(body);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : "Shared projects are unavailable"),
      )
      .finally(() => setLoading(false));
  }, [isSignedIn, refresh]);
  if (!import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"] || !isSignedIn) return null;
  const projects = [...new Map(items.map((item) => [item.workspaceId, item])).values()];
  const manage = async (
    workspaceId: string,
    action: "rename-workspace" | "delete-workspace" | "leave-workspace",
    name?: string,
  ) => {
    const response = await fetch("/api/shared-projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, workspaceId, name }),
    });
    const body = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(body.error ?? "Could not update shared workspace");
    if (action !== "rename-workspace") await detachLocalWorkspace(browserStorage, workspaceId);
    setRefresh((value) => value + 1);
  };
  return (
    <section className="jam-chooser-section jam-chooser-shared" aria-labelledby="shared-heading">
      <SharedWorkspaceHeading loading={loading} refresh={() => setRefresh((value) => value + 1)} />
      {error && <p role="alert">{error}</p>}
      {loading ? (
        <SessionLoader label="Loading shared projects" />
      ) : items.length === 0 ? (
        <p className="jam-muted">
          Sign-in workspaces you create or join appear here. Invite people from an open session with
          Share.
        </p>
      ) : (
        <ul>
          {projects.map((item) => (
            <SharedWorkspaceRow
              key={item.workspaceId}
              item={{
                ...item,
                fileCount: items.filter((file) => file.workspaceId === item.workspaceId).length,
              }}
              onOpen={() =>
                void navigate({
                  to: "/app/shared/$documentId",
                  params: { documentId: item.documentId },
                })
              }
              onManage={(action, name) => manage(item.workspaceId, action, name)}
            />
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
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invitations, setInvitations] = useState<
    { id: string; email: string; role: string; expiresAt: string }[]
  >([]);
  const [members, setMembers] = useState<
    { userId: string; role: string; email: string | null; joinedAt: string }[]
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
    void fetch(`/api/shared-projects?workspaceId=${encodeURIComponent(workspaceId)}&management=1`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load workspace access");
        const { invitations: inviteRows, members: memberRows } = (await response.json()) as {
          invitations: typeof invitations;
          members: typeof members;
        };
        if (current) {
          setInvitations(inviteRows);
          setMembers(memberRows);
        }
      })
      .catch((cause: unknown) => {
        if (current)
          setNotice(cause instanceof Error ? cause.message : "Could not load collaborators");
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
    setInviteUrl(null);
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
        delivery?: "email" | "link";
        invitationError?: string;
        workspaceId?: string;
        documentId?: string;
        role?: CollaborationRole;
        documents?: { id: string; name: string }[];
      };
      if (!response.ok) throw new Error(body.error ?? "Could not share this document");
      setInviteUrl(body.url ?? null);
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
      setNotice(
        body.invitationError
          ? `${body.invitationError} Share the invitation link below.`
          : body.delivery === "email"
            ? `Invitation email sent to ${email.trim()}`
            : body.url
              ? "Email delivery is not configured. Share the invitation link below."
              : "Shared document is ready",
      );
      if (body.delivery === "email") setEmail("");
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

  const remove = async (memberId: string) => {
    const workspaceId = document.shared?.workspaceId;
    if (!workspaceId) return;
    setPending(true);
    try {
      const response = await fetch("/api/shared-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove-member", workspaceId, memberId }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Could not remove collaborator");
      setInviteVersion((version) => version + 1);
      setNotice("Collaborator removed");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Could not remove collaborator");
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
          Collaborator email
          <input
            aria-label="Collaborator email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            required={!!document.shared}
          />
        </label>
        <label>
          Access
          <select
            aria-label="Collaborator access"
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
        {document.shared && members.length > 0 && (
          <ul className="jam-share-people" aria-label="Collaborators">
            {members.map((member) => (
              <li key={member.userId}>
                <span>
                  {member.email ?? (member.role === "owner" ? "Owner" : "Collaborator")} ·{" "}
                  {member.role}
                </span>
                {member.role !== "owner" && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => void remove(member.userId)}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {document.shared && invitations.length > 0 && (
          <ul className="jam-share-people" aria-label="Pending invitations">
            {invitations.map((invitation) => (
              <li key={invitation.id}>
                <span>
                  {invitation.email} · {invitation.role} · pending
                </span>
                <button type="button" disabled={pending} onClick={() => void revoke(invitation.id)}>
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
            <input
              aria-label="Invitation link"
              value={inviteUrl}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
            />
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
  const { user } = useUser();
  const userId = user?.id ?? "";
  const name = user?.fullName || user?.username || user?.firstName || "Musician";
  const shared = document.shared;
  useEffect(() => {
    if (!view || !shared || !userId) return;
    return attachSharedDocument(view, {
      documentId: shared.documentId,
      role: shared.role,
      userId,
      name,
      onStatus,
      onPresence,
    });
    // Callback identities change on workbench renders; a room only reattaches
    // when its identity, role, editor or displayed name changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shared?.documentId, shared?.role, view, userId, name]);
  return null;
}
