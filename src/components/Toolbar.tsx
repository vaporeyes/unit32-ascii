/* ABOUTME: Tool selector strip. */
/* ABOUTME: Keys are matched in App.tsx; shortcuts shown in tooltips. */
import React from 'react';
import type { ToolKind } from '../engine/types';
import './Toolbar.css';

interface ToolbarProps {
  active: ToolKind;
  onSelect: (kind: ToolKind) => void;
}

const TOOLS: Array<{ kind: ToolKind; label: string; key: string; glyph: string }> = [
  { kind: 'brush', label: 'Brush', key: 'B', glyph: 'B' },
  { kind: 'eraser', label: 'Eraser', key: 'E', glyph: 'E' },
  { kind: 'fill', label: 'Fill', key: 'F', glyph: 'F' },
  { kind: 'eyedropper', label: 'Eyedropper', key: 'I', glyph: 'I' },
  { kind: 'line', label: 'Line', key: 'L', glyph: 'L' },
  { kind: 'rect', label: 'Rectangle', key: 'R', glyph: 'R' },
];

const Toolbar: React.FC<ToolbarProps> = ({ active, onSelect }) => (
  <div className="tool-strip">
    {TOOLS.map(t => (
      <button
        key={t.kind}
        className={`tool-btn ${active === t.kind ? 'active' : ''}`}
        onClick={() => onSelect(t.kind)}
        title={`${t.label} (${t.key})`}
      >
        <span className="tool-glyph">{t.glyph}</span>
        <span className="tool-label">{t.label}</span>
      </button>
    ))}
  </div>
);

export default Toolbar;
