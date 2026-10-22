// A setInterval/clearInterval pair driven by a Worker. Browsers throttle main-thread
// timers in hidden or covered tabs, which would starve Strudel's scheduler; a worker's
// timer keeps its cadence. Falls back to the window timers where workers are unavailable
// or stop working, so playback never depends on the worker.
type TimerPair = {
  setInterval: (callback: () => void, milliseconds?: number) => number;
  clearInterval: (id?: number) => void;
};

export function createWorkerTimer(): TimerPair {
  const fallback: TimerPair = {
    setInterval: (callback, milliseconds) => window.setInterval(callback, milliseconds),
    clearInterval: (id) => window.clearInterval(id),
  };
  try {
    if (typeof Worker === "undefined" || typeof Blob === "undefined") return fallback;
    const url = URL.createObjectURL(
      new Blob(
        [
          "const timers=new Map();onmessage=(e)=>{const{id,ms,stop}=e.data;if(stop){clearInterval(timers.get(id));timers.delete(id);}else timers.set(id,setInterval(()=>postMessage(id),ms));};",
        ],
        { type: "text/javascript" },
      ),
    );
    const worker = new Worker(url);
    URL.revokeObjectURL(url);
    const timers = new Map<
      number,
      { callback: () => void; milliseconds: number; native?: number }
    >();
    let next = 0;
    let broken = false;
    worker.onmessage = (event: MessageEvent<number>) => timers.get(event.data)?.callback();
    worker.onerror = () => {
      broken = true;
      worker.terminate();
      for (const timer of timers.values())
        timer.native = window.setInterval(timer.callback, timer.milliseconds);
    };
    return {
      setInterval: (callback, milliseconds = 0) => {
        const id = ++next;
        const timer: { callback: () => void; milliseconds: number; native?: number } = {
          callback,
          milliseconds,
        };
        timers.set(id, timer);
        if (broken) timer.native = window.setInterval(callback, milliseconds);
        else worker.postMessage({ id, ms: milliseconds });
        return id;
      },
      clearInterval: (id) => {
        if (id === undefined) return;
        const timer = timers.get(id);
        timers.delete(id);
        if (timer?.native !== undefined) window.clearInterval(timer.native);
        if (!broken) worker.postMessage({ id, stop: true });
      },
    };
  } catch {
    return fallback;
  }
}
