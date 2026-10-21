import type { ReactNode } from "react";

import { parseMarkdownBlocks } from "./markdown-parser";

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
