const origin = "https://jamscript.dev";
const checks = [
  ["/", 200],
  ["/app", 200],
  ["/desktop/connect?mode=sign-in&user_code=", 200],
  ["/licenses/THIRD_PARTY_NOTICES.txt", 200],
  ["/api/shared-projects", 401],
];

for (const [path, expected] of checks) {
  let failure;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(new URL(path, origin), {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel();
      if (response.status !== expected) {
        throw new Error(`${path}: expected HTTP ${expected}, received ${response.status}`);
      }
      console.log(`${path}: HTTP ${response.status}`);
      failure = undefined;
      break;
    } catch (error) {
      failure = error;
      if (attempt < 5) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
      }
    }
  }
  if (failure) throw failure;
}
