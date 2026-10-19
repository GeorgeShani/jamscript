/** Stream the newest editor state without overlapping evaluations or waiting for a drag to end. */
export function createLiveEvaluation(evaluate: () => Promise<void>, interval = 40) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pending = false;

  const flush = async () => {
    timer = null;
    if (!pending || running) return;
    pending = false;
    running = true;
    try {
      await evaluate();
    } finally {
      running = false;
      if (pending) schedule();
    }
  };
  const schedule = () => {
    if (!running && timer === null) timer = setTimeout(() => void flush(), interval);
  };
  return {
    request() {
      pending = true;
      schedule();
    },
    cancel() {
      pending = false;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}
