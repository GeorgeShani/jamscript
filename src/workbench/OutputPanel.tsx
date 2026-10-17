import { AudioContextProvider } from "@/hooks/use-audio-context";
import { useAudioAnalyser } from "@/hooks/use-audio-analyser";
import { LevelMeter } from "@/components/ui/level-meter";
import { Spectrum } from "@/components/ui/spectrum";

function LiveOutput({ node }: { node: AudioNode }) {
  const analyser = useAudioAnalyser(node, { channels: "stereo", bands: 32 });
  return (
    <div className="jam-output-visuals">
      <div className="jam-level-wrap">
        <span>MASTER</span>
        <LevelMeter
          source={analyser.meter}
          aria-label="Master output level"
          orientation="vertical"
        />
      </div>
      <Spectrum source={analyser.visual} aria-label="Master output spectrum" />
    </div>
  );
}

export function OutputPanel({
  error,
  output,
  playing,
  onDismiss,
}: {
  error: string | null;
  output: { context: AudioContext; node: AudioNode } | null;
  playing: boolean;
  onDismiss: () => void;
}) {
  return (
    <section className="jam-output" aria-label="Output panel">
      <div className="jam-panel-heading">
        OUTPUT <span>{playing ? "LIVE" : "IDLE"}</span>
      </div>
      <div className="jam-output-body">
        {error && (
          <div role="alert" className="jam-output-error">
            <span>{error}</span>
            <button onClick={onDismiss}>Dismiss</button>
          </div>
        )}
        {output && playing ? (
          <AudioContextProvider context={output.context}>
            <LiveOutput node={output.node} />
          </AudioContextProvider>
        ) : (
          <p className="jam-output-idle">Press Play to hear and inspect the active document.</p>
        )}
      </div>
    </section>
  );
}
