/* ABOUTME: Controls the local reference image shown beneath the ASCII canvas. */
/* ABOUTME: Owns file picking UI while App owns object URL lifecycle. */
import React, { useRef } from 'react';
import './UnderlayControl.css';

interface UnderlayControlProps {
  hasUnderlay: boolean;
  opacity: number;
  onUpload: (file: File) => void;
  onClear: () => void;
  onOpacityChange: (opacity: number) => void;
}

const UnderlayControl: React.FC<UnderlayControlProps> = ({
  hasUnderlay,
  opacity,
  onUpload,
  onClear,
  onOpacityChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    onUpload(file);
  };

  return (
    <section className="underlay-control" aria-label="Reference image controls">
      <div className="underlay-header">
        <span>Underlay</span>
        <span className={hasUnderlay ? 'underlay-state active' : 'underlay-state'}>{hasUnderlay ? 'On' : 'Off'}</span>
      </div>
      <div className="underlay-actions">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          title="Upload a PNG or JPEG reference image. Left-click paints. Right-click erases."
        >
          Upload Image
        </button>
        <button
          type="button"
          onClick={onClear}
          disabled={!hasUnderlay}
          title="Clear the reference image. Left-click paints. Right-click erases."
        >
          Clear Image
        </button>
      </div>
      <label className="underlay-opacity">
        <span>Opacity</span>
        <output>{Math.round(opacity * 100)}%</output>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={opacity}
          onChange={e => onOpacityChange(Number(e.target.value))}
          disabled={!hasUnderlay}
          title="Adjust reference image opacity. Left-click paints. Right-click erases."
        />
      </label>
      <input
        ref={inputRef}
        className="underlay-file"
        type="file"
        accept="image/png, image/jpeg"
        onChange={handleFileChange}
      />
    </section>
  );
};

export default UnderlayControl;
