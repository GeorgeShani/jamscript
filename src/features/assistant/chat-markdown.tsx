import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { classHighlighter, highlightTree } from "@lezer/highlight";
import {
  javascriptLanguage,
  typescriptLanguage,
  jsxLanguage,
  tsxLanguage,
} from "@codemirror/lang-javascript";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

function highlightCode(code: string, language: string): ReactNode {
  if (
    code.length > 30_000 ||
    !/^(js|javascript|ts|typescript|jsx|tsx|strudel|json)$/i.test(language)
  )
    return code;
  const grammar = /^tsx$/i.test(language)
    ? tsxLanguage
    : /^jsx$/i.test(language)
      ? jsxLanguage
      : /^(ts|typescript)$/i.test(language)
        ? typescriptLanguage
        : javascriptLanguage;
  const nodes: ReactNode[] = [];
  let position = 0;
  highlightTree(grammar.parser.parse(code), classHighlighter, (from, to, classes) => {
    if (from > position) nodes.push(code.slice(position, from));
    nodes.push(
      <span key={`${from}-${to}`} className={classes}>
        {code.slice(from, to)}
      </span>,
    );
    position = to;
  });
  if (position < code.length) nodes.push(code.slice(position));
  return nodes;
}

function CodeBlock({
  code,
  language,
  onInsertCode,
}: {
  code: string;
  language: string;
  onInsertCode?: (code: string) => void;
}) {
  const highlighted = useMemo(() => highlightCode(code, language), [code, language]);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  return (
    <div className="jam-chat-code">
      <div className="jam-chat-code-actions">
        <span>{language || "code"}</span>
        <Button
          size="sm"
          variant="ghost"
          aria-label={copied ? "Code copied" : "Copy code"}
          onClick={() => {
            void Promise.resolve()
              .then(() => navigator.clipboard.writeText(code))
              .then(() => {
                setCopied(true);
                setFailed(false);
              })
              .catch(() => setFailed(true));
          }}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </Button>
        {onInsertCode && (
          <Button size="sm" variant="ghost" onClick={() => onInsertCode(code)}>
            Insert at cursor
          </Button>
        )}
      </div>
      <pre>
        <code>{highlighted}</code>
      </pre>
      {failed && (
        <p className="jam-chat-error" role="alert">
          Clipboard access failed. You can select and copy the code.
        </p>
      )}
    </div>
  );
}

export function ChatMarkdown({
  text,
  onInsertCode,
}: {
  text: string;
  onInsertCode?: (code: string) => void;
}) {
  return (
    <div className="jam-chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          code: ({ children }) => <code className="jam-chat-inline-code">{children}</code>,
          pre: ({ children }) => {
            const child = Children.toArray(children).find((item) =>
              isValidElement<{ children?: ReactNode; className?: string }>(item),
            );
            if (!isValidElement<{ children?: ReactNode; className?: string }>(child))
              return <pre>{children}</pre>;
            const code = String(child.props.children ?? "").replace(/\n$/, "");
            const language = /language-([\w+-]+)/.exec(child.props.className ?? "")?.[1] ?? "";
            return (
              <CodeBlock
                code={code}
                language={language}
                {...(onInsertCode ? { onInsertCode } : {})}
              />
            );
          },
          a: ({ href, children }) =>
            /^https?:\/\//i.test(href ?? "") ? (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            ) : (
              <span>{children}</span>
            ),
          table: ({ children }) => (
            <div className="jam-chat-table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
