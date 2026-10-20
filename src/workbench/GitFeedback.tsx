import { Check, CircleAlert, GitCommitHorizontal, RefreshCw } from "lucide-react";
import "./git-feedback.css";

export type GitOperation = "push" | "pull" | "commit" | "refresh" | "repository";
export type GitFeedbackState = {
  operation: GitOperation;
  phase: "pending" | "success" | "error";
  text: string;
};

/** Indeterminate movement shows direction, never an invented transfer percentage. */
export function GitFeedback({ state }: { state: GitFeedbackState }) {
  const transfer = state.operation === "push" || state.operation === "pull";
  const pendingDetail = {
    push: "Sending local commits",
    pull: "Checking remote commits",
    commit: "Recording selected files",
    refresh: "Reading saved files",
    repository: "Updating repository",
  };
  const completedDetail = {
    push: "Remote accepted the push",
    pull: "Remote check finished",
    commit: "Recorded in local history",
    refresh: "Working tree checked",
    repository: "Operation complete",
  };
  return (
    <div
      className="jam-git-feedback"
      data-operation={state.operation}
      data-phase={state.phase}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="jam-git-feedback-art" aria-hidden="true">
        {transfer ? (
          <svg viewBox="0 0 76 36" width="76" height="36" fill="none">
            <path className="jam-git-transfer-route" d="M14 26H33Q38 26 38 21V15Q38 10 43 10H62" />
            <rect
              className="jam-git-transfer-endpoint"
              x="5"
              y="22"
              width="8"
              height="8"
              rx="1.5"
            />
            <rect
              className="jam-git-transfer-endpoint"
              x="63"
              y="6"
              width="8"
              height="8"
              rx="1.5"
            />
            {state.phase === "pending" &&
              [0, 1, 2].map((index) => (
                <rect
                  key={index}
                  className="jam-git-transfer-packet"
                  x="-2"
                  y="-2"
                  width="4"
                  height="4"
                  rx=".5"
                  style={{ animationDelay: `${index * -0.45}s` }}
                />
              ))}
            {state.phase === "success" && (
              <path
                className="jam-git-transfer-check"
                d={state.operation === "push" ? "M61 10l4 4 7-8" : "M4 26l4 4 7-8"}
              />
            )}
            {state.phase === "error" && (
              <path className="jam-git-transfer-break" d="m34 15 8 8m0-8-8 8" />
            )}
          </svg>
        ) : state.phase === "success" ? (
          <Check className="jam-git-feedback-check" size={20} />
        ) : state.phase === "error" ? (
          <CircleAlert size={20} />
        ) : state.operation === "refresh" ? (
          <RefreshCw className="jam-git-refresh-mark" size={20} />
        ) : (
          <GitCommitHorizontal className="jam-git-commit-mark" size={22} />
        )}
      </div>
      <div className="jam-git-feedback-copy">
        <strong>{state.text}</strong>
        <span>
          {state.phase === "pending"
            ? pendingDetail[state.operation]
            : state.phase === "success"
              ? completedDetail[state.operation]
              : "See the details below"}
        </span>
      </div>
    </div>
  );
}
