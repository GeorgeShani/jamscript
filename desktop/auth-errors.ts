export function desktopAuthError(cause: unknown) {
  const detail = cause instanceof Error ? cause.message : String(cause);
  const connectionIssue =
    /ACCOUNT_(NETWORK|SERVICE)_UNAVAILABLE|dns failed|resolve dns name|connection (?:refused|reset|interrupted)|timed? ?out|network (?:is )?unreachable/i.test(
      detail,
    );
  return {
    connectionIssue,
    message: connectionIssue
      ? "Can't reach the account service. Check your connection and retry. Local work is still available."
      : detail,
  };
}
