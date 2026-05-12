/* ABOUTME: 256-color palette (xterm standard) utility. */

export const XTERM_COLORS: string[] = [
  // 16 Standard colors
  '#000000', '#800000', '#008000', '#808000', '#000080', '#800080', '#008080', '#c0c0c0',
  '#808080', '#ff0000', '#00ff00', '#ffff00', '#0000ff', '#ff00ff', '#00ffff', '#ffffff',
];

// 6x6x6 Color cube
const levels = [0, 95, 135, 175, 215, 255];
for (let r = 0; r < 6; r++) {
  for (let g = 0; g < 6; g++) {
    for (let b = 0; b < 6; b++) {
      const hex = (n: number) => n.toString(16).padStart(2, '0');
      XTERM_COLORS.push(`#${hex(levels[r])}${hex(levels[g])}${hex(levels[b])}`);
    }
  }
}

// 24 Greyscale levels
for (let i = 0; i < 24; i++) {
  const v = 8 + i * 10;
  const hex = v.toString(16).padStart(2, '0');
  XTERM_COLORS.push(`#${hex}${hex}${hex}`);
}

export function getXtermColor(index: number): string {
  return XTERM_COLORS[index] || '#ffffff';
}
