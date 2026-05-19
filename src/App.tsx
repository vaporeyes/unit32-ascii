/* ABOUTME: Top-level App for the unit32-ascii editor. */
/* ABOUTME: Owns engine lifecycle, document list, pointer/keyboard wiring, share/publish UI. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { Engine } from './engine/core';
import { SpriteSheet } from './engine/sprites';
import { Storage, randomId } from './engine/storage';
import type { DocSummary } from './engine/storage';
import Palette from './components/Palette';
import ColorPicker from './components/ColorPicker';
import Toolbar from './components/Toolbar';
import DocPanel from './components/DocPanel';
import UnderlayControl from './components/UnderlayControl';
import type { GridConfig, ToolKind, ToolState } from './engine/types';
import { encodeShare, decodeShare } from './engine/share';
import { publishArtwork, fetchArtwork } from './engine/api';

const CHAR_WIDTH = 10;
const CHAR_HEIGHT = 20;
const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 40;
const MIN_DIM = 8;
const MAX_DIM = 200;

interface DocBootstrap {
  id: string;
  name: string;
  width: number;
  height: number;
  buffer?: Uint32Array;
}

async function bootstrapDoc(storage: Storage): Promise<DocBootstrap> {
  const params = new URLSearchParams(window.location.search);
  const galleryId = params.get('id');
  const hash = window.location.hash.startsWith('#s=') ? window.location.hash.slice(3) : '';

  if (hash) {
    const decoded = await decodeShare(hash);
    if (decoded) {
      return {
        id: randomId(),
        name: 'Shared',
        width: decoded.width,
        height: decoded.height,
        buffer: decoded.buffer,
      };
    }
  }

  if (galleryId) {
    try {
      const fetched = await fetchArtwork(galleryId);
      return {
        id: randomId(),
        name: fetched.title || 'Gallery import',
        width: fetched.width,
        height: fetched.height,
        buffer: fetched.buffer,
      };
    } catch (err) {
      console.warn('Gallery fetch failed:', err);
    }
  }

  const currentId = await storage.getCurrentId();
  if (currentId) {
    const doc = await storage.loadDoc(currentId);
    if (doc) {
      return { id: doc.id, name: doc.name, width: doc.width, height: doc.height, buffer: doc.buffer };
    }
  }

  return {
    id: randomId(),
    name: 'Untitled',
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
  };
}

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const spritesRef = useRef<SpriteSheet | null>(null);
  const storageRef = useRef<Storage>(new Storage());
  const underlayUrlRef = useRef<string | null>(null);
  const activeToolRef = useRef<ToolKind>('brush');
  const activeGestureRef = useRef<{ pointerId: number; button: number; previousTool: ToolKind | null } | null>(null);

  const [ready, setReady] = useState(false);
  const [toolState, setToolState] = useState<ToolState>({ char: 64, fg: 15, bg: 0 });
  const [activeTool, setActiveTool] = useState<ToolKind>('brush');
  const [docInfo, setDocInfo] = useState<{ id: string; name: string }>({ id: '', name: 'Untitled' });
  const [config, setConfig] = useState<GridConfig>({
    width: DEFAULT_WIDTH,
    height: DEFAULT_HEIGHT,
    charWidth: CHAR_WIDTH,
    charHeight: CHAR_HEIGHT,
  });
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [bootstrap, setBootstrap] = useState<DocBootstrap | null>(null);
  const [status, setStatus] = useState<string>('');
  const [showHelp, setShowHelp] = useState(false);
  const [sidebarsOpen, setSidebarsOpen] = useState(true);
  const [underlayUrl, setUnderlayUrl] = useState<string | null>(null);
  const [underlayOpacity, setUnderlayOpacity] = useState(0.5);

  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // One-time bootstrap.
  useEffect(() => {
    (async () => {
      const boot = await bootstrapDoc(storageRef.current);
      setBootstrap(boot);
      setConfig(prev => ({ ...prev, width: boot.width, height: boot.height }));
      setDocInfo({ id: boot.id, name: boot.name });
    })();
  }, []);

  const refreshDocList = useCallback(async () => {
    const list = await storageRef.current.listDocs();
    setDocs(list);
  }, []);

  // Build engine after canvas + bootstrap are ready, or when config changes.
  useEffect(() => {
    if (!canvasRef.current || !bootstrap) return;
    let cancelled = false;
    let engine: Engine | null = null;

    (async () => {
      const sprites = spritesRef.current ?? (await SpriteSheet.load(CHAR_WIDTH, CHAR_HEIGHT));
      spritesRef.current = sprites;
      if (cancelled || !canvasRef.current) return;

      engine = new Engine(canvasRef.current, config, sprites, bootstrap.id);
      engine.onToolStateChange = state => setToolState({ ...state });
      engine.onDocChange = info => setDocInfo(info);
      engineRef.current = engine;
      engine.setTool(activeTool);
      engine.setToolState(toolState);
      await engine.init(bootstrap.buffer, bootstrap.name);
      await engine.persistDoc();
      await refreshDocList();
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (engine) engine.stop();
      engineRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrap, config.width, config.height]);

  // Pointer wiring on the canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;

    const point = (e: PointerEvent) => engineRef.current?.getGridPoint(e.clientX, e.clientY, canvas);

    const onDown = (e: PointerEvent) => {
      const eng = engineRef.current;
      const p = point(e);
      if (!eng || !p) return;
      if (e.button !== 0 && e.button !== 2) return;
      if (activeGestureRef.current) return;
      e.preventDefault();
      const previousTool = e.button === 2 ? activeToolRef.current : null;
      if (e.button === 2) eng.setTool('eraser');
      activeGestureRef.current = { pointerId: e.pointerId, button: e.button, previousTool };
      canvas.setPointerCapture(e.pointerId);
      eng.currentTool.onPointerDown(p);
    };
    const onMove = (e: PointerEvent) => {
      const eng = engineRef.current;
      const p = point(e);
      if (!eng || !p) return;
      eng.setHover(p);
      if (activeGestureRef.current?.pointerId !== e.pointerId) return;
      eng.currentTool.onPointerMove(p);
    };
    const onUp = (e: PointerEvent) => {
      const eng = engineRef.current;
      const gesture = activeGestureRef.current;
      if (!eng || !gesture || gesture.pointerId !== e.pointerId) return;
      const p = point(e);
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      if (p) eng.currentTool.onPointerUp(p);
      if (gesture.button === 2 && gesture.previousTool) eng.setTool(gesture.previousTool);
      activeGestureRef.current = null;
    };
    const onLeave = () => engineRef.current?.setHover(null);
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('contextmenu', onContextMenu);

    return () => {
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('contextmenu', onContextMenu);
      activeGestureRef.current = null;
    };
  }, [ready]);

  const setTool = useCallback((kind: ToolKind) => {
    setActiveTool(kind);
    engineRef.current?.setTool(kind);
  }, []);

  const swapColors = useCallback(() => {
    setToolState(prev => {
      const next = { ...prev, fg: prev.bg, bg: prev.fg };
      engineRef.current?.setToolState(next);
      return next;
    });
  }, []);

  const handleCharSelect = useCallback((code: number) => {
    const next = { ...toolState, char: code };
    setToolState(next);
    engineRef.current?.setToolState({ char: code });
  }, [toolState]);

  const handleFgSelect = useCallback((index: number) => {
    setToolState(prev => ({ ...prev, fg: index }));
    engineRef.current?.setToolState({ fg: index });
  }, []);

  const handleBgSelect = useCallback((index: number) => {
    setToolState(prev => ({ ...prev, bg: index }));
    engineRef.current?.setToolState({ bg: index });
  }, []);

  const handleNew = useCallback(async () => {
    const widthStr = window.prompt('Width (cells):', String(config.width));
    if (widthStr === null) return;
    const heightStr = window.prompt('Height (cells):', String(config.height));
    if (heightStr === null) return;
    const width = Math.min(MAX_DIM, Math.max(MIN_DIM, parseInt(widthStr, 10) || DEFAULT_WIDTH));
    const height = Math.min(MAX_DIM, Math.max(MIN_DIM, parseInt(heightStr, 10) || DEFAULT_HEIGHT));
    const boot: DocBootstrap = { id: randomId(), name: 'Untitled', width, height };
    setBootstrap(boot);
    setConfig(prev => ({ ...prev, width, height }));
    setDocInfo({ id: boot.id, name: boot.name });
  }, [config.width, config.height]);

  // Keyboard shortcuts.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) engineRef.current?.redo();
        else engineRef.current?.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        engineRef.current?.redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        handleNew();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key.toLowerCase()) {
        case 'b': setTool('brush'); break;
        case 'e': setTool('eraser'); break;
        case 'f': setTool('fill'); break;
        case 'i': setTool('eyedropper'); break;
        case 'l': setTool('line'); break;
        case 'r': setTool('rect'); break;
        case 'x': swapColors(); break;
        case '?': setShowHelp(s => !s); break;
        default:
          if (e.key.length === 1 && e.key.charCodeAt(0) >= 32 && e.key.charCodeAt(0) <= 126) {
            handleCharSelect(e.key.charCodeAt(0));
          }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setTool, swapColors, handleCharSelect, handleNew]);

  const flash = useCallback((msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(s => (s === msg ? '' : s)), 2400);
  }, []);

  const handleExport = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    const ansi = await eng.exportToANSI();
    const blob = new Blob([ansi], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${docInfo.name || 'artwork'}.ans`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Exported .ans');
  }, [docInfo.name, flash]);

  const handleCopyAnsi = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    const ansi = await eng.exportToANSI();
    await navigator.clipboard.writeText(ansi);
    flash('ANSI copied to clipboard');
  }, [flash]);

  const handleCopyPlain = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    await navigator.clipboard.writeText(eng.exportToPlainText());
    flash('Plain text copied');
  }, [flash]);

  const handleShareUrl = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    const token = await encodeShare(eng.config.width, eng.config.height, eng.memory.getBuffer());
    const url = `${window.location.origin}${window.location.pathname}#s=${token}`;
    await navigator.clipboard.writeText(url);
    flash(`Share URL copied (${url.length} chars)`);
  }, [flash]);

  const handlePublish = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng) return;
    const author = window.prompt('Author name (optional):', '') ?? '';
    try {
      setStatus('Publishing...');
      const meta = await publishArtwork({
        title: docInfo.name || 'Untitled',
        author,
        width: eng.config.width,
        height: eng.config.height,
        buffer: eng.memory.getBuffer(),
      });
      const url = `${window.location.origin}${window.location.pathname}?id=${meta.id}`;
      await navigator.clipboard.writeText(url);
      flash(`Published. Gallery URL copied.`);
    } catch (err) {
      flash(`Publish failed: ${(err as Error).message}`);
    }
  }, [docInfo.name, flash]);

  const handleRename = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setDocInfo(prev => ({ ...prev, name }));
    engineRef.current?.setName(name);
  }, []);

  const handleOpen = useCallback(async (id: string) => {
    const doc = await storageRef.current.loadDoc(id);
    if (!doc) return;
    const boot: DocBootstrap = {
      id: doc.id, name: doc.name, width: doc.width, height: doc.height, buffer: doc.buffer,
    };
    setBootstrap(boot);
    setConfig(prev => ({ ...prev, width: doc.width, height: doc.height }));
    setDocInfo({ id: doc.id, name: doc.name });
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Delete this document?')) return;
    await storageRef.current.deleteDoc(id);
    if (id === docInfo.id) handleNew();
    await refreshDocList();
  }, [docInfo.id, handleNew, refreshDocList]);

  const handleClear = useCallback(() => {
    if (!window.confirm('Clear the canvas?')) return;
    engineRef.current?.clear();
  }, []);

  const handleUnderlayUpload = useCallback((file: File) => {
    if (!file.type.match(/^image\/(png|jpeg)$/)) {
      flash('Use a PNG or JPEG underlay');
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    if (underlayUrlRef.current) URL.revokeObjectURL(underlayUrlRef.current);
    underlayUrlRef.current = nextUrl;
    setUnderlayUrl(nextUrl);
    flash('Underlay loaded');
  }, [flash]);

  const handleUnderlayClear = useCallback(() => {
    if (underlayUrlRef.current) URL.revokeObjectURL(underlayUrlRef.current);
    underlayUrlRef.current = null;
    setUnderlayUrl(null);
    flash('Underlay cleared');
  }, [flash]);

  useEffect(() => {
    return () => {
      if (underlayUrlRef.current) URL.revokeObjectURL(underlayUrlRef.current);
      underlayUrlRef.current = null;
    };
  }, []);

  // Periodically refresh doc list to reflect debounced persist.
  useEffect(() => {
    const t = window.setInterval(refreshDocList, 1500);
    return () => clearInterval(t);
  }, [refreshDocList]);

  const sidebarsClass = useMemo(() => (sidebarsOpen ? 'open' : 'closed'), [sidebarsOpen]);

  return (
    <div className="app-container">
      <header className="editor-header">
        <button className="sidebar-toggle" onClick={() => setSidebarsOpen(o => !o)} title="Toggle panels">
          {sidebarsOpen ? '<<' : '>>'}
        </button>
        <input
          className="doc-name-input"
          value={docInfo.name}
          onChange={handleRename}
          placeholder="Untitled"
          spellCheck={false}
        />
        <div className="toolbar">
          <button onClick={handleNew} title="New document (Ctrl+N)">New</button>
          <button onClick={handleClear} title="Clear canvas">Clear</button>
          <div className="divider" />
          <button onClick={handleCopyAnsi} title="Copy as ANSI text">Copy ANSI</button>
          <button onClick={handleCopyPlain} title="Copy as plain text">Copy Text</button>
          <button onClick={handleExport} title="Download .ans file">Export</button>
          <div className="divider" />
          <button onClick={handleShareUrl} title="Copy a shareable URL (no account required)">Share URL</button>
          <button onClick={handlePublish} title="Publish to the gallery backend">Publish</button>
          <div className="divider" />
          <button onClick={() => setShowHelp(true)} title="Keyboard shortcuts (?)">Help</button>
        </div>
      </header>
      <div className="editor-body">
        <aside className={`sidebar-left ${sidebarsClass}`}>
          <Toolbar active={activeTool} onSelect={setTool} />
          <Palette onSelect={handleCharSelect} selectedChar={toolState.char} />
          <ColorPicker
            selectedFg={toolState.fg}
            selectedBg={toolState.bg}
            onSelectFg={handleFgSelect}
            onSelectBg={handleBgSelect}
            onSwap={swapColors}
          />
          <UnderlayControl
            hasUnderlay={underlayUrl !== null}
            opacity={underlayOpacity}
            onUpload={handleUnderlayUpload}
            onClear={handleUnderlayClear}
            onOpacityChange={setUnderlayOpacity}
          />
          <DocPanel
            docs={docs}
            currentId={docInfo.id}
            onOpen={handleOpen}
            onNew={handleNew}
            onDelete={handleDelete}
          />
        </aside>
        <main className={`editor-main tool-${activeTool}`}>
          <div className="canvas-wrapper">
            {underlayUrl && (
              <div
                className="underlay-layer"
                style={{ backgroundImage: `url("${underlayUrl}")`, opacity: underlayOpacity }}
                aria-hidden="true"
              />
            )}
            <canvas ref={canvasRef} id="ascii-canvas"></canvas>
          </div>
        </main>
      </div>
      <footer className="editor-footer">
        <div className="status-bar">
          <span>{config.width} x {config.height}</span>
          <span>{status}</span>
          <span>Press ? for shortcuts</span>
        </div>
      </footer>
      {showHelp && (
        <div className="help-overlay" onClick={() => setShowHelp(false)}>
          <div className="help-modal" onClick={e => e.stopPropagation()}>
            <h2>Keyboard Shortcuts</h2>
            <table>
              <tbody>
                <tr><th>B / E / F</th><td>Brush / Eraser / Fill</td></tr>
                <tr><th>I / L / R</th><td>Eyedropper / Line / Rectangle</td></tr>
                <tr><th>X</th><td>Swap foreground and background</td></tr>
                <tr><th>Any printable</th><td>Select that character as the brush</td></tr>
                <tr><th>Right-click</th><td>Erase without changing tools</td></tr>
                <tr><th>Click color</th><td>Set foreground</td></tr>
                <tr><th>Shift+Click color</th><td>Set background</td></tr>
                <tr><th>Ctrl/Cmd+Z</th><td>Undo</td></tr>
                <tr><th>Ctrl/Cmd+Shift+Z</th><td>Redo</td></tr>
                <tr><th>Ctrl/Cmd+N</th><td>New document</td></tr>
                <tr><th>?</th><td>Toggle this help</td></tr>
              </tbody>
            </table>
            <button onClick={() => setShowHelp(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
