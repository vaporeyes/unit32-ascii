/* ABOUTME: Palette component for selecting ASCII and box-drawing characters. */
import React, { useState } from 'react';
import './Palette.css';

interface PaletteProps {
  onSelect: (charCode: number) => void;
  selectedChar: number;
}

const CHAR_SETS = {
  Printable: Array.from({ length: 95 }, (_, i) => i + 32),
  Box: [
    0x2500, 0x2501, 0x2502, 0x2503, 0x250C, 0x250D, 0x250E, 0x250F,
    0x2510, 0x2511, 0x2512, 0x2513, 0x2514, 0x2515, 0x2516, 0x2517,
    0x2518, 0x2519, 0x251A, 0x251B, 0x251C, 0x251D, 0x251E, 0x251F,
    0x2520, 0x2521, 0x2522, 0x2523, 0x2524, 0x2525, 0x2526, 0x2527,
    0x2528, 0x2529, 0x252A, 0x252B, 0x252C, 0x252D, 0x252E, 0x252F,
    0x2530, 0x2531, 0x2532, 0x2533, 0x2534, 0x2535, 0x2536, 0x2537,
    0x2538, 0x2539, 0x253A, 0x253B, 0x253C, 0x253D, 0x253E, 0x253F,
  ],
  Blocks: [
    0x2580, 0x2581, 0x2582, 0x2583, 0x2584, 0x2585, 0x2586, 0x2587,
    0x2588, 0x2589, 0x258A, 0x258B, 0x258C, 0x258D, 0x258E, 0x258F,
    0x2591, 0x2592, 0x2593,
  ]
};

const Palette: React.FC<PaletteProps> = ({ onSelect, selectedChar }) => {
  const [activeTab, setActiveTab] = useState<keyof typeof CHAR_SETS>('Printable');

  return (
    <div className="char-palette">
      <div className="palette-tabs">
        {(Object.keys(CHAR_SETS) as (keyof typeof CHAR_SETS)[]).map(tab => (
          <button 
            key={tab} 
            className={activeTab === tab ? 'active' : ''}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="palette-grid">
        {CHAR_SETS[activeTab].map((code) => (
          <button
            key={code}
            className={`char-item ${selectedChar === code ? 'selected' : ''}`}
            onClick={() => onSelect(code)}
            title={`Char code: 0x${code.toString(16).toUpperCase()}`}
          >
            {String.fromCharCode(code)}
          </button>
        ))}
      </div>
    </div>
  );
};

export default Palette;
