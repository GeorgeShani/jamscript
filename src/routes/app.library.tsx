import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, FileCode2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SessionLoader } from "@/components/SessionLoader";
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
  const searchRef = useRef<HTMLInputElement>(null);
  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

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
      <div className="jam-library-content">
        <div className="jam-library-intro">
          <h1>Your documents</h1>
          <p>Find music saved in workspaces in this browser profile.</p>
        </div>
        <div className="jam-library-search">
          <Search size={17} aria-hidden />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search documents or workspaces"
            aria-label="Search documents or workspaces"
          />
          {query && (
            <button type="button" onClick={clearSearch} aria-label="Clear search">
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
        <div className="jam-library-results" aria-busy={loading}>
          {error ? (
            <div className="jam-library-empty" role="alert">
              <h2>Could not load your documents</h2>
              <p>{error}</p>
              <Button variant="outline" asChild>
                <Link to="/app">Back to workspaces</Link>
              </Button>
            </div>
          ) : loading ? (
            <div className="jam-library-empty">
              <SessionLoader label="Loading documents" />
            </div>
          ) : filtered.length ? (
            <>
              <p className="jam-library-count" role="status">
                {filtered.length} {filtered.length === 1 ? "document" : "documents"}
                {query.trim() ? ` matching “${query.trim()}”` : " saved locally"}
              </p>
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
                      <ArrowUpRight size={17} aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="jam-library-empty">
              {query.trim() ? (
                <Search size={28} aria-hidden />
              ) : (
                <FileCode2 size={28} aria-hidden />
              )}
              <h2>{query.trim() ? "No matching documents" : "No documents yet"}</h2>
              <p>
                {query.trim()
                  ? "Try a different document or workspace name."
                  : "Create a workspace to start. Your saved documents will appear here."}
              </p>
              {query.trim() ? (
                <Button variant="outline" onClick={clearSearch}>
                  Clear search
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/app">
                    Go to workspaces <ArrowUpRight size={16} aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
