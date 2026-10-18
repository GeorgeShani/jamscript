import type { ReactNode } from "react";

/** Escape HTML so untrusted model text never becomes markup. */
export function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "code"; language: string; code: string }
  | { kind: "paragraph"; text: string };

function inlineNodes(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = pattern.exec(text))) {
    if (match.index > last)
      nodes.push(<span key={`${keyPrefix}-t${index++}`}>{text.slice(last, match.index)}</span>);
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={`${keyPrefix}-c${index++}`} className="jam-chat-inline-code">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      const safe = /^https?:\/\//i.test(href) ? href : undefined;
      nodes.push(
        safe ? (
          <a key={`${keyPrefix}-a${index++}`} href={safe} target="_blank" rel="noopener noreferrer">
            {link?.[1]}
          </a>
        ) : (
          <span key={`${keyPrefix}-a${index++}`}>{link?.[1]}</span>
        ),
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={`${keyPrefix}-b${index++}`}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i${index++}`}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }
  if (last < text.length)
    nodes.push(<span key={`${keyPrefix}-t${index++}`}>{text.slice(last)}</span>);
  return nodes;
}

export function parseMarkdownBlocks(markdown: string): Block[] {
  const lines = markdown.replaceAll("\r\n", "\n").split("\n");
  const blocks: Block[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index]!;
    if (!line.trim()) {
      index += 1;
      continue;
    }
    const fence = /^```([\w-]*)\s*$/.exec(line);
    if (fence) {
      const language = fence[1] ?? "";
      const code: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index]!)) {
        code.push(lines[index]!);
        index += 1;
      }
      index += 1;
      blocks.push({ kind: "code", language, code: code.join("\n") });
      continue;
    }
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1]!.length as 1 | 2 | 3,
        text: heading[2]!,
      });
      index += 1;
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (index < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[index]!)) {
        items.push(lines[index]!.replace(/^\s*([-*]|\d+\.)\s+/, ""));
        index += 1;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    const paragraph: string[] = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index]!.trim() &&
      !/^```/.test(lines[index]!) &&
      !/^#{1,3}\s+/.test(lines[index]!) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[index]!)
    ) {
      paragraph.push(lines[index]!);
      index += 1;
    }
    blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
  }
  return blocks;
}

export function ChatMarkdown({
  text,
  onInsertCode,
}: {
  text: string;
  onInsertCode?: (code: string) => void;
}) {
  const blocks = parseMarkdownBlocks(text);
  return (
    <div className="jam-chat-markdown">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          const Tag = `h${block.level}` as "h1" | "h2" | "h3";
          return (
            <Tag key={index} className="jam-chat-heading">
              {inlineNodes(block.text, `h${index}`)}
            </Tag>
          );
        }
        if (block.kind === "list") {
          const Tag = block.ordered ? "ol" : "ul";
          return (
            <Tag key={index} className="jam-chat-list">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inlineNodes(item, `l${index}-${itemIndex}`)}</li>
              ))}
            </Tag>
          );
        }
        if (block.kind === "code") {
          return (
            <div key={index} className="jam-chat-code">
              <div className="jam-chat-code-actions">
                <button
                  type="button"
                  onClick={() => void navigator.clipboard?.writeText(block.code)}
                >
                  Copy
                </button>
                {onInsertCode && (
                  <button type="button" onClick={() => onInsertCode(block.code)}>
                    Insert at cursor
                  </button>
                )}
              </div>
              <pre>
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }
        return (
          <p key={index} className="jam-chat-paragraph">
            {inlineNodes(block.text, `p${index}`)}
          </p>
        );
      })}
    </div>
  );
}
