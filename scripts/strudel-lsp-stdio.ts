import { StrudelLanguageService } from "../src/features/language/strudel-lsp-core";

const service = new StrudelLanguageService();
let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk: Buffer) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd < 0) return;
    const header = buffer.subarray(0, headerEnd).toString("ascii");
    const length = Number(header.match(/(?:^|\r\n)Content-Length:\s*(\d+)/i)?.[1]);
    if (!Number.isSafeInteger(length) || length < 0 || length > 10_000_000) {
      process.stderr.write("Invalid LSP Content-Length\n");
      process.exitCode = 1;
      process.stdin.pause();
      return;
    }
    if (buffer.length < headerEnd + 4 + length) return;
    const body = buffer.subarray(headerEnd + 4, headerEnd + 4 + length);
    buffer = buffer.subarray(headerEnd + 4 + length);
    try {
      for (const reply of service.handle(JSON.parse(body.toString("utf8")))) {
        const output = Buffer.from(JSON.stringify(reply));
        process.stdout.write(`Content-Length: ${output.length}\r\n\r\n`);
        process.stdout.write(output);
      }
    } catch (cause) {
      process.stderr.write(
        `Strudel LSP error: ${cause instanceof Error ? cause.message : String(cause)}\n`,
      );
    }
  }
});
