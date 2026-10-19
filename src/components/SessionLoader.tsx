import { useEffect, useRef, useState, type CSSProperties } from "react";

import "./session-loader.css";

const pattern = ["bd", "~", "sd", "~", "bd", "bd", "sd", "~"];

/** Illustrative code becomes pads while work is pending; this is not audio data. */
export function SessionLoader({
  label,
  fullScreen = false,
}: {
  label: string;
  fullScreen?: boolean;
}) {
  const statusRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let inView = true;
    const update = () => setPaused(!inView || document.visibilityState === "hidden");
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting ?? false;
            update();
          });
    if (statusRef.current) observer?.observe(statusRef.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const tokens = fullScreen ? pattern : pattern.slice(0, 4);
  const spacing = fullScreen ? 28 : 22;
  const center = fullScreen ? 160 : 88;
  const origin = center - ((tokens.length - 1) * spacing) / 2;
  const baseline = fullScreen ? 48 : 30;
  return (
    <div className={fullScreen ? "jam-loading" : undefined}>
      <div
        ref={statusRef}
        className={`jam-session-loader${fullScreen ? " jam-session-loader-full" : ""}`}
        data-paused={paused}
        role="status"
      >
        <svg
          className="jam-session-loader-scene"
          viewBox={fullScreen ? "0 0 320 96" : "0 0 176 60"}
          aria-hidden="true"
          focusable="false"
        >
          <g className="jam-session-loader-syntax" dominantBaseline="central">
            <text x={origin - (fullScreen ? 40 : 36)} y={baseline}>
              {'s("'}
            </text>
            <text x={origin + (tokens.length - 1) * spacing + (fullScreen ? 20 : 18)} y={baseline}>
              {'")'}
            </text>
          </g>
          {tokens.map((token, step) => (
            <g key={step} transform={`translate(${origin + step * spacing} ${baseline})`}>
              <g
                className="jam-session-loader-token"
                style={
                  {
                    "--step": step,
                    "--travel-x": `${(step - (tokens.length - 1) / 2) * (fullScreen ? 4 : 6)}px`,
                  } as CSSProperties
                }
              >
                <rect
                  className={`jam-session-loader-pad${token === "~" ? " is-rest" : ""}`}
                  x="-11"
                  y="-11"
                  width="22"
                  height="22"
                  rx="3"
                />
                <text
                  className={`jam-session-loader-glyph${token === "~" ? " is-rest" : ""}`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  y="0"
                >
                  {token}
                </text>
              </g>
            </g>
          ))}
        </svg>
        <span className="jam-session-loader-label">{label}</span>
      </div>
    </div>
  );
}
