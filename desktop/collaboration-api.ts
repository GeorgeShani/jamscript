import { invoke } from "@tauri-apps/api/core";

type NativeResponse = { status: number; body: string };

export async function collaborationApi<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
  const response = await invoke<NativeResponse>("desktop_collaboration_request", {
    path,
    method: options.method ?? "GET",
    body: options.body === undefined ? null : JSON.stringify(options.body),
  });
  let value: { error?: string } | T;
  try {
    value = JSON.parse(response.body) as T;
  } catch {
    throw new Error("Collaboration service returned an invalid response");
  }
  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      typeof value === "object" && value && "error" in value && typeof value.error === "string"
        ? value.error
        : `Collaboration request failed (${response.status})`,
    );
  }
  return value as T;
}
