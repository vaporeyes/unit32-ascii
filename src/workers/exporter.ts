/* ABOUTME: Web Worker for exporting grid state to ANSI escape sequences. */

self.onmessage = (e: MessageEvent) => {
  const { buffer, width, height } = e.data;
  const uint32Buffer = new Uint32Array(buffer);
  
  let result = '';
  let lastFg = -1;
  let lastBg = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const value = uint32Buffer[y * width + x];
      const charCode = value & 0xFF;
      const fg = (value >> 8) & 0xFF;
      const bg = (value >> 16) & 0xFF;

      let style = '';
      if (fg !== lastFg || bg !== lastBg) {
        // ANSI escape sequence: \x1b[38;5;{fg}m\x1b[48;5;{bg}m
        // Simplified for this phase, assuming 8-bit colors
        style = `\x1b[38;5;${fg}m\x1b[48;5;${bg}m`;
        lastFg = fg;
        lastBg = bg;
      }

      result += style + String.fromCharCode(charCode);
    }
    result += '\x1b[0m\n'; // Reset and newline at end of row
    lastFg = -1;
    lastBg = -1;
  }

  self.postMessage(result);
};
