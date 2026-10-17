class JamScriptRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.left = new Float32Array(4096);
    this.right = new Float32Array(4096);
    this.position = 0;
    this.stopped = false;
    this.port.onmessage = (event) => {
      if (event.data === "stop") {
        this.flush();
        this.stopped = true;
        this.port.postMessage({ done: true });
      }
    };
  }

  flush() {
    if (!this.position) return;
    const left = this.left.slice(0, this.position);
    const right = this.right.slice(0, this.position);
    this.port.postMessage({ left, right }, [left.buffer, right.buffer]);
    this.position = 0;
  }

  process(inputs) {
    if (this.stopped) return false;
    const input = inputs[0];
    if (!input?.[0]) return true;
    const left = input[0];
    const right = input[1] ?? left;
    for (let index = 0; index < left.length; index++) {
      this.left[this.position] = left[index];
      this.right[this.position] = right[index];
      this.position++;
      if (this.position === this.left.length) this.flush();
    }
    return true;
  }
}

registerProcessor("jamscript-recorder", JamScriptRecorder);
