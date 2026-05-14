/* ABOUTME: List of saved documents with new/open/delete actions. */
import React from 'react';
import type { DocSummary } from '../engine/storage';
import './DocPanel.css';

interface DocPanelProps {
  docs: DocSummary[];
  currentId: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return 'now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h`;
  return d.toLocaleDateString();
}

const DocPanel: React.FC<DocPanelProps> = ({ docs, currentId, onOpen, onNew, onDelete }) => (
  <div className="doc-panel">
    <div className="doc-panel-header">
      <span>Documents</span>
      <button onClick={onNew} title="New document (Ctrl+N)">+ New</button>
    </div>
    <div className="doc-list">
      {docs.length === 0 && <div className="doc-empty">No saved documents yet.</div>}
      {docs.map(d => (
        <div key={d.id} className={`doc-row ${d.id === currentId ? 'active' : ''}`}>
          <button className="doc-open" onClick={() => onOpen(d.id)}>
            <span className="doc-name">{d.name || 'Untitled'}</span>
            <span className="doc-meta">{d.width}x{d.height} . {formatTime(d.updatedAt)}</span>
          </button>
          <button
            className="doc-delete"
            onClick={() => onDelete(d.id)}
            title="Delete"
            aria-label={`Delete ${d.name}`}
          >x</button>
        </div>
      ))}
    </div>
  </div>
);

export default DocPanel;
