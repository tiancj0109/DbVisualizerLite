import React from 'react';
import { Database, Plus, Edit2, Trash2, ShieldCheck, DatabaseZap } from 'lucide-react';

export default function Sidebar({ 
  connections, 
  activeConnection, 
  onSelectConnection, 
  onAddConnection, 
  onEditConnection, 
  onDeleteConnection 
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <DatabaseZap size={22} className="text-accent" style={{ color: 'var(--accent-color)' }} />
        <span className="logo-text">DbVisualizerLite</span>
      </div>

      <div className="connection-list">
        <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '0 4px 4px 4px', fontWeight: 600, textTransform: 'uppercase' }}>
          连接列表
        </div>
        
        {connections.length === 0 ? (
          <div style={{ color: 'var(--text-dark)', fontSize: '12px', padding: '12px 4px', textAlign: 'center' }}>
            暂无连接，请点击下方按钮新建连接。
          </div>
        ) : (
          connections.map(conn => {
            const isActive = activeConnection && activeConnection.id === conn.id;
            return (
              <div 
                key={conn.id} 
                className={`connection-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectConnection(conn)}
              >
                <div className="connection-info">
                  <Database size={15} style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span className="connection-name" title={conn.name}>{conn.name}</span>
                    <span className="connection-type" style={{ width: 'fit-content', marginTop: '2px', fontSize: '9px' }}>{conn.type}</span>
                  </div>
                </div>

                <div className="connection-actions" onClick={e => e.stopPropagation()}>
                  <button className="icon-btn" onClick={() => onEditConnection(conn)} title="编辑连接">
                    <Edit2 size={12} />
                  </button>
                  <button className="icon-btn delete" onClick={() => onDeleteConnection(conn.id)} title="删除连接">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="sidebar-footer">
        <button className="btn btn-primary w-full" onClick={onAddConnection}>
          <Plus size={16} />
          新建连接
        </button>
      </div>
    </div>
  );
}
