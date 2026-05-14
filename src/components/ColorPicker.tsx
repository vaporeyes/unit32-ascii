/* ABOUTME: Color picker component for 256 xterm colors. */
import React from 'react';
import './ColorPicker.css';
import { XTERM_COLORS } from '../engine/colors';

interface ColorPickerProps {
  selectedFg: number;
  selectedBg: number;
  onSelectFg: (index: number) => void;
  onSelectBg: (index: number) => void;
  onSwap?: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ selectedFg, selectedBg, onSelectFg, onSelectBg, onSwap }) => {
  return (
    <div className="color-picker">
      <div className="active-colors">
        <div className="color-preview">
          <div 
            className="fg-swatch" 
            style={{ backgroundColor: XTERM_COLORS[selectedFg] }}
            title="Foreground"
          ></div>
          <div 
            className="bg-swatch" 
            style={{ backgroundColor: XTERM_COLORS[selectedBg] }}
            title="Background"
          ></div>
        </div>
        <div className="color-indices">
          FG: {selectedFg} | BG: {selectedBg}
        </div>
        {onSwap && (
          <button className="color-swap" onClick={onSwap} title="Swap FG/BG (X)">Swap</button>
        )}
      </div>
      <div className="color-grid">
        {XTERM_COLORS.map((color, index) => (
          <div
            key={index}
            className={`color-item ${selectedFg === index ? 'selected-fg' : ''} ${selectedBg === index ? 'selected-bg' : ''}`}
            style={{ backgroundColor: color }}
            onClick={(e) => {
              if (e.shiftKey) {
                onSelectBg(index);
              } else {
                onSelectFg(index);
              }
            }}
            title={`Color ${index}: ${color} (Click: FG, Shift+Click: BG)`}
          ></div>
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;
