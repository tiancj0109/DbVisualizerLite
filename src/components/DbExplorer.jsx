import React, { useState, useEffect } from 'react';
import { Table, Search, RefreshCw } from 'lucide-react';

export default function DbExplorer({ 
  connection, 
  databases, 
  activeDb, 
  tables, 
  activeTable, 
  onSelectDatabase, 
  onSelectTable, 
  onRefresh 
}) {
  const [filterText, setFilterText] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredTables = tables.filter(t => 
    t.toLowerCase().includes(filterText.toLowerCase())
  );

  return (
    <div className="db-explorer">
      <div className="explorer-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="explorer-title">数据库浏览器</span>
          <button 
            className={`icon-btn ${refreshing ? 'spin' : ''}`} 
            onClick={handleRefresh} 
            title="刷新数据表架构"
            disabled={refreshing}
          >
            <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>

        {/* Database selector (Only if database type supports multiple databases, i.e., not SQLite) */}
        {connection && connection.type !== 'sqlite' && (
          <div className="form-group" style={{ gap: '4px' }}>
            <label style={{ fontSize: '10px' }}>当前数据库 (Active Schema)</label>
            <select 
              className="db-select" 
              value={activeDb || ''} 
              onChange={e => onSelectDatabase(e.target.value)}
            >
              <option value="" disabled>-- 选择数据库 --</option>
              {databases.map(db => (
                <option key={db} value={db}>{db}</option>
              ))}
            </select>
          </div>
        )}

        {/* Filter input */}
        <div style={{ position: 'relative', marginTop: connection && connection.type !== 'sqlite' ? '4px' : '0' }}>
          <input 
            type="text" 
            placeholder="搜索数据表..." 
            value={filterText}
            onChange={e => setFilterText(e.target.value)}
            style={{ paddingLeft: '28px', width: '100%', fontSize: '12px', height: '32px' }}
          />
          <Search 
            size={13} 
            style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dark)' }} 
          />
        </div>
      </div>

      <div className="explorer-list">
        <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '4px 8px', fontWeight: 600, textTransform: 'uppercase' }}>
          数据表 ({filteredTables.length})
        </div>

        {filteredTables.length === 0 ? (
          <div style={{ color: 'var(--text-dark)', fontSize: '12px', padding: '16px 8px', textAlign: 'center' }}>
            {filterText ? '无匹配的数据表。' : '当前数据库无数据表。'}
          </div>
        ) : (
          filteredTables.map(t => {
            const isActive = activeTable === t;
            return (
              <div 
                key={t} 
                className={`explorer-item ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTable(t)}
              >
                <Table size={14} style={{ color: isActive ? 'var(--accent-color)' : 'var(--text-muted)' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t}>
                  {t}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
