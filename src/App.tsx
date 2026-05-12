/* ABOUTME: Main App component for the ASCII art creator. */
import React, { useEffect, useRef, useState } from 'react';
import './App.css';
import { Engine } from './engine/core';
import Palette from './components/Palette';
import ColorPicker from './components/ColorPicker';
import type { GridConfig } from './engine/types';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [selectedChar, setSelectedChar] = useState(64); // '@'
  const [selectedFg, setSelectedFg] = useState(15); // White
  const [selectedBg, setSelectedBg] = useState(0); // Black
  const [activeTool, setActiveTool] = useState<'brush' | 'fill'>('brush');

  useEffect(() => {
    if (!canvasRef.current) return;

    const config: GridConfig = {
      width: 80,
      height: 40,
      charWidth: 10,
      charHeight: 20,
    };

    const engine = new Engine(canvasRef.current, config);
    engineRef.current = engine;
    engine.init();

    // Initial tool sync
    engine.brush.char = selectedChar;
    engine.brush.fg = selectedFg;
    engine.brush.bg = selectedBg;
    engine.fill.char = selectedChar;
    engine.fill.fg = selectedFg;
    engine.fill.bg = selectedBg;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) {
          engine.redo();
        } else {
          engine.undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const canvas = canvasRef.current;
    const handleMouseDown = (e: MouseEvent) => {
      const p = engine.getGridPoint(e.clientX, e.clientY, canvas);
      engine.currentTool.onMouseDown(p);
    };
    const handleMouseMove = (e: MouseEvent) => {
      const p = engine.getGridPoint(e.clientX, e.clientY, canvas);
      engine.currentTool.onMouseMove(p);
    };
    const handleMouseUp = (e: MouseEvent) => {
      const p = engine.getGridPoint(e.clientX, e.clientY, canvas);
      engine.currentTool.onMouseUp(p);
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    const handleResize = () => {};

    let resizeTimeout: number;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(handleResize, 200);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  const setTool = (tool: 'brush' | 'fill') => {
    if (!engineRef.current) return;
    setActiveTool(tool);
    if (tool === 'brush') engineRef.current.currentTool = engineRef.current.brush;
    if (tool === 'fill') engineRef.current.currentTool = engineRef.current.fill;
  };

  const handleCharSelect = (code: number) => {
    setSelectedChar(code);
    if (engineRef.current) {
      engineRef.current.brush.char = code;
      engineRef.current.fill.char = code;
    }
  };

  const handleFgSelect = (index: number) => {
    setSelectedFg(index);
    if (engineRef.current) {
      engineRef.current.brush.fg = index;
      engineRef.current.fill.fg = index;
    }
  };

  const handleBgSelect = (index: number) => {
    setSelectedBg(index);
    if (engineRef.current) {
      engineRef.current.brush.bg = index;
      engineRef.current.fill.bg = index;
    }
  };

  return (
    <div className="app-container">
      <header className="editor-header">
        <div className="toolbar">
          <button 
            className={activeTool === 'brush' ? 'active' : ''} 
            onClick={() => setTool('brush')}
          >
            Brush
          </button>
          <button 
            className={activeTool === 'fill' ? 'active' : ''} 
            onClick={() => setTool('fill')}
          >
            Fill
          </button>
          <div className="divider"></div>
          <button onClick={async () => {
            if (engineRef.current) {
              const ansi = await engineRef.current.exportToANSI();
              const blob = new Blob([ansi], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'artwork.txt';
              a.click();
              URL.revokeObjectURL(url);
            }
          }}>Export</button>
        </div>
      </header>
      <div className="editor-body">
        <div className="sidebar-left">
          <Palette onSelect={handleCharSelect} selectedChar={selectedChar} />
          <ColorPicker 
            selectedFg={selectedFg} 
            selectedBg={selectedBg} 
            onSelectFg={handleFgSelect} 
            onSelectBg={handleBgSelect} 
          />
        </div>
        <main className="editor-main">
          <div className="canvas-wrapper">
            <canvas ref={canvasRef} id="ascii-canvas"></canvas>
          </div>
        </main>
      </div>
      <footer className="editor-footer">
        <div className="status-bar">
          <span>80x40</span>
          <span>Ctrl+Z: Undo | Ctrl+Shift+Z: Redo</span>
        </div>
      </footer>
    </div>
  );
};

export default App;
