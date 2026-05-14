/* ABOUTME: Web Worker for exporting grid state to ANSI escape sequences. */
/* ABOUTME: Unpacks cells using the same 16/8/8 layout as GridMemory.pack. */

self.onmessage = (e: MessageEvent) => {
  const { buffer, width, height } = e.data as {
    buffer: ArrayBuffer;
    width: number;
    height: number;
  };
  const cells = new Uint32Array(buffer);

  const out: string[] = [];
  let lastFg = -1;
  let lastBg = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = cells[y * width + x];
      const char = value & 0xffff;
      const fg = (value >>> 16) & 0xff;
      const bg = (value >>> 24) & 0xff;

      if (fg !== lastFg || bg !== lastBg) {
        out.push(`\x1b[38;5;${fg};48;5;${bg}m`);
        lastFg = fg;
        lastBg = bg;
      }

      out.push(char === 0 ? ' ' : String.fromCharCode(char));
    }
    out.push('\x1b[0m\n');
    lastFg = -1;
    lastBg = -1;
  }

  self.postMessage(out.join(''));
};
