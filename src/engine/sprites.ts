/* ABOUTME: Font glyph atlas with reusable scratch canvas for color tinting. */
/* ABOUTME: One atlas, one tint canvas, no per-cell allocations on the hot path. */

const DEFAULT_FONT = '16px "JetBrains Mono", "Fira Code", "Menlo", monospace';
const ATLAS_COLS = 32;
const ATLAS_ROWS = 64;

export class SpriteSheet {
  private atlas: HTMLCanvasElement;
  private atlasCtx: CanvasRenderingContext2D;
  private tintCanvas: HTMLCanvasElement;
  private tintCtx: CanvasRenderingContext2D;
  private charWidth: number;
  private charHeight: number;
  private font: string;
  private charMap = new Map<number, { x: number; y: number }>();

  constructor(charWidth: number, charHeight: number, font: string = DEFAULT_FONT) {
    this.charWidth = charWidth;
    this.charHeight = charHeight;
    this.font = font;

    this.atlas = document.createElement('canvas');
    this.atlas.width = charWidth * ATLAS_COLS;
    this.atlas.height = charHeight * ATLAS_ROWS;
    const actx = this.atlas.getContext('2d');
    if (!actx) throw new Error('Could not get atlas 2d context');
    this.atlasCtx = actx;

    this.tintCanvas = document.createElement('canvas');
    this.tintCanvas.width = charWidth;
    this.tintCanvas.height = charHeight;
    const tctx = this.tintCanvas.getContext('2d');
    if (!tctx) throw new Error('Could not get tint 2d context');
    this.tintCtx = tctx;
  }

  // Returns a SpriteSheet only after the requested font has loaded so the
  // first baked glyphs aren't permanently a fallback face.
  public static async load(charWidth: number, charHeight: number, font: string = DEFAULT_FONT): Promise<SpriteSheet> {
    const sheet = new SpriteSheet(charWidth, charHeight, font);
    try {
      if (document.fonts && typeof document.fonts.load === 'function') {
        await document.fonts.load(font);
      }
    } catch {
      // Fall through with whatever the browser has.
    }
    return sheet;
  }

  private ensureChar(charCode: number): { x: number; y: number } {
    const cached = this.charMap.get(charCode);
    if (cached) return cached;

    const index = this.charMap.size;
    const col = index % ATLAS_COLS;
    const row = Math.floor(index / ATLAS_COLS);
    if (row >= ATLAS_ROWS) {
      // Atlas full; reuse a blank slot so we don't corrupt existing glyphs.
      const pos = { x: 0, y: 0 };
      this.charMap.set(charCode, pos);
      return pos;
    }
    const x = col * this.charWidth;
    const y = row * this.charHeight;

    this.atlasCtx.fillStyle = 'white';
    this.atlasCtx.font = this.font;
    this.atlasCtx.textAlign = 'center';
    this.atlasCtx.textBaseline = 'middle';
    this.atlasCtx.fillText(String.fromCharCode(charCode), x + this.charWidth / 2, y + this.charHeight / 2);

    const pos = { x, y };
    this.charMap.set(charCode, pos);
    return pos;
  }

  public drawChar(
    ctx: CanvasRenderingContext2D,
    charCode: number,
    destX: number,
    destY: number,
    fgColor: string,
    bgColor: string | null,
  ): void {
    const w = this.charWidth;
    const h = this.charHeight;

    if (bgColor === null || bgColor === 'transparent') {
      ctx.clearRect(destX, destY, w, h);
    } else {
      ctx.fillStyle = bgColor;
      ctx.fillRect(destX, destY, w, h);
    }

    // Spaces and null bytes have nothing to tint.
    if (charCode === 32 || charCode === 0) return;

    const { x: sx, y: sy } = this.ensureChar(charCode);

    this.tintCtx.globalCompositeOperation = 'copy';
    this.tintCtx.drawImage(this.atlas, sx, sy, w, h, 0, 0, w, h);
    this.tintCtx.globalCompositeOperation = 'source-in';
    this.tintCtx.fillStyle = fgColor;
    this.tintCtx.fillRect(0, 0, w, h);

    ctx.drawImage(this.tintCanvas, destX, destY);
  }
}
