import { REVIEW_EXAMPLES, type ReviewCheckStatus, type ReviewExample } from "./review-fixtures";

// Presentation only: no requests, evaluation, source edits or playback access.
export const REWORK_SAMPLE_REQUEST = "Busier hats, keep the kick";
export const REWORK_UNAVAILABLE = "Live Rework is not connected. Try the example request to preview the review.";
export function reworkRequestKind(request: string): "empty" | "sample" | "unavailable" {
  const value = request.trim();
  if (!value) return "empty";
  return value.toLowerCase() === REWORK_SAMPLE_REQUEST.toLowerCase() ? "sample" : "unavailable";
}
function checkFixture(status: ReviewCheckStatus): ReviewExample {
  return { ...REVIEW_EXAMPLES.rework, checks: (REVIEW_EXAMPLES.rework.checks ?? []).map((check) => ({ ...check, status })) };
}
export const REWORK_FIXTURES = {
  normal: REVIEW_EXAMPLES.rework,
  passed: checkFixture("passed"),
  failed: checkFixture("failed"),
  pending: checkFixture("pending"),
  unavailable: checkFixture("unavailable"),
} as const;