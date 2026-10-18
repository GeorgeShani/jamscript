const PRIVATE_NAME = /(^\.|\.env(?:\.|$)|(?:^|[/\\])(node_modules|\.git|dist|build)(?:[/\\]|$))/i;

/** Share only music source documents, never local configuration or dependency files. */
export function shareableDocumentName(name: string) {
  return (
    name.length > 0 &&
    name.length <= 120 &&
    !name.includes("/") &&
    !name.includes("\\") &&
    !PRIVATE_NAME.test(name) &&
    /\.(js|strudel)$/i.test(name)
  );
}
