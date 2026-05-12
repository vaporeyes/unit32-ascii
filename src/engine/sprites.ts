/* ABOUTME: Font sprite sheet generator and manager. */

export class SpriteSheet {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private charWidth: number;
  private charHeight: number;
  private font: string;
  private charMap: Map<number, { x: number, y: number }> = new Map();

  constructor(charWidth: number, charHeight: number, font: string = '16px "JetBrains Mono", monospace') {
    this.charWidth = charWidth;
    this.charHeight = charHeight;
    this.font = font;
    this.canvas = document.createElement('canvas');
    // We'll grow the canvas as needed or pre-allocate for a set
    this.canvas.width = charWidth * 32;
    this.canvas.height = charHeight * 32;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    this.ctx = ctx;
  }

  private ensureChar(charCode: number): { x: number, y: number } {
    if (this.charMap.has(charCode)) return this.charMap.get(charCode)!;

    const index = this.charMap.size;
    const x = (index % 32) * this.charWidth;
    const y = Math.floor(index / 32) * this.charHeight;

    this.ctx.fillStyle = 'white';
    this.ctx.font = this.font;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(String.fromCharCode(charCode), x + this.charWidth / 2, y + this.charHeight / 2);

    const pos = { x, y };
    this.charMap.set(charCode, pos);
    return pos;
  }

  public drawChar(ctx: CanvasRenderingContext2D, charCode: number, destX: number, destY: number, fgColor: string, bgColor: string): void {
    const { x: sx, y: sy } = this.ensureChar(charCode);

    // Draw background
    ctx.fillStyle = bgColor;
    ctx.fillRect(destX, destY, this.charWidth, this.charHeight);

    // To color the character:
    // 1. Draw the character sprite (white on transparent)
    // 2. Use 'source-in' to fill it with fgColor
    
    // We'll use a temporary offscreen canvas for this to avoid affecting the main canvas composite
    const offscreen = document.createElement('canvas');
    offscreen.width = this.charWidth;
    offscreen.height = this.charHeight;
    const octx = offscreen.getContext('2d');
    if (!octx) return;

    // Draw the sprite
    octx.drawImage(this.canvas, sx, sy, this.charWidth, this.charHeight, 0, 0, this.charWidth, this.charHeight);
    
    // Tint with fgColor
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = fgColor;
    octx.fillRect(0, 0, this.charWidth, this.charHeight);
    
    // Draw back to main canvas
    ctx.drawImage(offscreen, destX, destY);
  }
}
