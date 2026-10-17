import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditorSlot } from "@/components/jam/EditorSlot";
import { RepoPopover } from "@/components/jam/RepoPopover";
import { ReviewPanel } from "@/components/jam/InlinePanel";
import { TakesRail } from "@/components/jam/TakesRail";
import { SharePopover } from "@/components/jam/SharePopover";
import { ExampleAvatar } from "@/components/jam/ExampleAvatar";
import { ReworkBar } from "@/components/jam/ReworkBar";
import { REVIEW_EXAMPLES, type ReviewExample } from "@/components/jam/review-fixtures";
import { SAMPLE_CODE } from "@/components/jam/session";
import type { MusicDocument } from "@/engine/music-document";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Night bus | JamScript" },
      {
        name: "description",
        content:
          "Jam on the Night bus session in JamScript: code, knobs and step grids in one view.",
      },
      { property: "og:title", content: "Night bus | JamScript" },
      {
        property: "og:description",
        content:
          "Jam on the Night bus session in JamScript: code, knobs and step grids in one view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Editor,
});

function Editor() {
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [panel, setPanel] = useState<{
    review: ReviewExample;
    launcher: HTMLElement | null;
  } | null>(null);
  const reworkInput = useRef<HTMLInputElement>(null);
  const [toolbarPopover, setToolbarPopover] = useState<"repo" | "share" | null>(null);
  const [wideToolbar, setWideToolbar] = useState(true);
  const code = useRef(SAMPLE_CODE);
  const playingNow = useRef(false);
  const mounted = useRef(true);
  const evaluation = useRef(0);
  const pendingUpdate = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [tempo, setTempo] = useState(0.6);

  const evaluateCurrent = useCallback(async () => {
    const request = ++evaluation.current;
    if (!playingNow.current) setLoading(true);
    try {
      const playback = await import("@/engine/playback");
      if (!mounted.current || request !== evaluation.current) return;
      const ok = await playback.play(code.current);
      if (!mounted.current || request !== evaluation.current) return;
      if (ok) {
        playingNow.current = true;
        setPlaying(true);
        setPlayError(null);
      }
    } catch (error) {
      if (mounted.current && request === evaluation.current)
        setPlayError(error instanceof Error ? error.message : String(error));
    } finally {
      if (mounted.current && request === evaluation.current) setLoading(false);
    }
  }, []);

  const onCodeChange = useCallback(
    (source: string, model: MusicDocument) => {
      code.current = source;
      if (model.tempo !== null) setTempo(model.tempo);
      if (pendingUpdate.current) clearTimeout(pendingUpdate.current);
      if (playingNow.current && model.valid) {
        pendingUpdate.current = setTimeout(() => {
          void evaluateCurrent();
        }, 180);
      }
    },
    [evaluateCurrent],
  );
  useEffect(() => {
    mounted.current = true;
    const media = window.matchMedia("(min-width: 900px)");
    const update = () => setWideToolbar(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const closeReview = useCallback(() => {
    const launcher = panel?.launcher;
    setPanel(null);
    requestAnimationFrame(() => {
      if (launcher?.isConnected) launcher.focus({ preventScroll: true });
      else reworkInput.current?.focus({ preventScroll: true });
    });
  }, [panel]);

  useEffect(() => {
    // Browser only: the playback adapter (and Strudel behind it) loads on demand.
    let active = true;
    import("@/engine/playback").then((pb) => {
      if (active) pb.onError((message) => setPlayError(message));
    });
    return () => {
      active = false;
      mounted.current = false;
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This request counter must invalidate its latest value on unmount.
      evaluation.current++;
      if (pendingUpdate.current) clearTimeout(pendingUpdate.current);
      import("@/engine/playback").then((pb) => {
        pb.onError(null);
        void pb.stop();
      });
    };
  }, []);

  const onPlayToggle = async () => {
    if (playingNow.current) {
      playingNow.current = false;
      const stoppedAt = ++evaluation.current;
      if (pendingUpdate.current) clearTimeout(pendingUpdate.current);
      const pb = await import("@/engine/playback");
      await pb.stop();
      if (!mounted.current || evaluation.current !== stoppedAt) return;
      setPlaying(false);
      setLoading(false);
      return;
    }
    await evaluateCurrent();
  };

  const transport = (
    <Button
      className="jam-play shrink-0"
      size="sm"
      title={playing ? "Stop playback" : "Play current code (Ctrl+Enter)"}
      variant={playing ? "default" : "outline"}
      disabled={loading}
      onClick={onPlayToggle}
    >
      {playing ? <Square /> : <Play />}
      {loading ? "Loading sounds" : playing ? "Stop" : "Play"}
    </Button>
  );

  return (
    <div className="jam-app-frame flex min-h-0 min-w-0 flex-col bg-background text-ui">
      <header className="jam-toolbar shrink-0 border-b border-border bg-card">
        <div className="jam-identity flex min-w-0 items-center gap-3 whitespace-nowrap">
          <span className="jam-wordmark shrink-0 font-semibold">JamScript</span>
          <span aria-hidden className="jam-identity-divider h-5 w-px shrink-0 bg-border" />
          <span className="jam-session-name truncate">Night bus</span>
        </div>
        {!wideToolbar && transport}
        <div className="jam-repo min-w-0">
          <RepoPopover
            open={toolbarPopover === "repo"}
            suppressCloseFocus={toolbarPopover === "share"}
            onOpenChange={(open) =>
              setToolbarPopover((current) => (open ? "repo" : current === "repo" ? null : current))
            }
            onOpenDiff={(launcher) => setPanel({ review: REVIEW_EXAMPLES.repo, launcher })}
          />
        </div>
        <div className="jam-presence flex shrink-0 -space-x-2">
          <ExampleAvatar initials="NK" ring="ring-track-6" />
          <ExampleAvatar initials="GS" ring="ring-track-5" />
        </div>
        <span className="jam-tempo code-face shrink-0 whitespace-nowrap">
          {tempo.toFixed(2)} cps
        </span>
        {wideToolbar && transport}
        <SharePopover
          open={toolbarPopover === "share"}
          suppressCloseFocus={toolbarPopover === "repo"}
          onOpenChange={(open) =>
            setToolbarPopover((current) => (open ? "share" : current === "share" ? null : current))
          }
        />
      </header>

      {playError && (
        <div
          role="status"
          className="flex min-h-9 shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-1 text-ui text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 break-words">
            This pattern has an error: {playError} Fix it to play.
          </p>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Dismiss"
            className="size-7 shrink-0"
            onClick={() => setPlayError(null)}
          >
            <X />
          </Button>
        </div>
      )}

      <main className="relative min-h-0 min-w-0 flex-1">
        <EditorSlot
          panelOpen={panel !== null}
          onChange={onCodeChange}
          onEvaluate={() => {
            void evaluateCurrent();
          }}
        />
        {panel && <ReviewPanel review={panel.review} onClose={closeReview} />}
      </main>

      <TakesRail onCompare={(review, launcher) => setPanel({ review, launcher })} />

      <ReworkBar
        inputRef={reworkInput}
        onPreview={(review, launcher) => setPanel({ review, launcher })}
      />
    </div>
  );
}
