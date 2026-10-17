import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileCode2, Search } from "lucide-react";
import {
  listDocuments,
  listWorkspaces,
  type DocumentRecord,
  type WorkspaceRecord,
} from "@/workspaces/storage";

export const Route = createFileRoute("/app/library")({
  head: () => ({ meta: [{ title: "JamScript | Library" }] }),
  component: LibraryPage,
});

type LibraryItem = { workspace: WorkspaceRecord; document: DocumentRecord };

function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void listWorkspaces()
      .then(async (workspaces) => {
        const groups = await Promise.all(
          workspaces.map(async (workspace) =>
            (await listDocuments(workspace.id)).map((document) => ({ workspace, document })),
          ),
        );
        if (current)
          setItems(groups.flat().sort((a, b) => b.document.updatedAt - a.document.updatedAt));
      })
      .catch((cause: unknown) => {
        if (current) setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, []);

  const filtered = items.filter((item) =>
    `${item.document.name} ${item.workspace.name}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  return (
    <main className="jam-help jam-library">
      <header className="jam-help-header">
        <Link to="/app" aria-label="Back to workspaces">
          <ArrowLeft size={18} /> Workspaces
        </Link>
        <img src="/brand/logo.svg" alt="JamScript" width={113} height={22} />
      </header>
      <div className="jam-help-content">
        <p className="jam-eyebrow">LOCAL LIBRARY</p>
        <h1>Your documents</h1>
        <p>Find music saved in workspaces in this browser profile.</p>
        <label className="jam-library-search">
          <Search size={17} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents or workspaces"
            aria-label="Search documents or workspaces"
          />
        </label>
        {error ? (
          <p role="alert">Could not load your local documents: {error}</p>
        ) : loading ? (
          <p>Loading documents…</p>
        ) : filtered.length ? (
          <ul className="jam-library-list">
            {filtered.map(({ workspace, document }) => (
              <li key={document.id}>
                <Link
                  to="/app/workspaces/$workspaceId"
                  params={{ workspaceId: workspace.id }}
                  search={{ document: document.id }}
                >
                  <FileCode2 size={19} aria-hidden />
                  <span>
                    <strong>{document.name}</strong>
                    <small>{workspace.name}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            {query ? "No matching documents." : "No documents yet. Create a workspace to start."}
          </p>
        )}
      </div>
    </main>
  );
}
