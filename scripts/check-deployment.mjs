const origin = "https://jamscript.dev";
const checks = [
  ["/", 200],
  ["/app", 200],
  ["/desktop/connect?mode=sign-in&user_code=", 200],
  ["/licenses/THIRD_PARTY_NOTICES.txt", 200],
  ["/api/shared-projects", 401],
];

async function check(url, expected, location) {
  let failure;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(15_000),
      });
      await response.body?.cancel();
      if (response.status !== expected) {
        throw new Error(`${url}: expected HTTP ${expected}, received ${response.status}`);
      }
      if (location && response.headers.get("location") !== location) {
        throw new Error(`${url}: expected redirect to ${location}`);
      }
      console.log(`${url}: HTTP ${response.status}`);
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

for (const [path, expected] of checks) {
  await check(new URL(path, origin), expected);
}

for (const path of ["/", "/app/library?from=www", "/brand/logo.svg"]) {
  await check(`https://www.jamscript.dev${path}`, 308, `${origin}${path}`);
}
