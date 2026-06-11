import React, { useState, useEffect } from 'react';
import { Play, FileCode, History, Trash, Download, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export default function SqlEditor({ initialQuery = '' }) {
  const [sql, setSql] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { success, rows, columns, affectedRows, duration, error }
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    // Load query history from localStorage
    const savedHistory = localStorage.getItem('sql_query_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  useEffect(() => {
    if (initialQuery) {
      setSql(initialQuery);
    }
  }, [initialQuery]);

  const saveToHistory = (queryStr) => {
    const trimmed = queryStr.trim();
    if (!trimmed) return;
    
    const filtered = history.filter(h => h !== trimmed);
    const updated = [trimmed, ...filtered].slice(0, 50); // limit to 50 items
    setHistory(updated);
    localStorage.setItem('sql_query_history', JSON.stringify(updated));
  };

  const handleExecute = async () => {
    if (!sql.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      saveToHistory(sql);
      const res = await window.electronAPI.executeRawQuery(sql);
      setResult(res);
    } catch (err) {
      setResult({
        success: false,
        error: err.message || '未知数据库执行错误',
        duration: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleExecute();
    }
  };

  const handleImportSql = async () => {
    try {
      const filePath = await window.electronAPI.showOpenImportDialog({ format: 'sql' });
      if (!filePath) return;
      
      setLoading(true);
      const res = await window.electronAPI.importSqlFile({ filePath });
      if (res.success) {
        alert(`SQL脚本执行成功！共执行 ${res.total} 条语句。成功: ${res.successCount}, 失败: ${res.errorCount}`);
        if (res.errorCount > 0) {
          console.error(res.errors);
          setResult({
            success: false,
            error: `部分语句执行失败，请检查控制台。第一个错误: ${res.errors[0]?.error || ''}`,
            duration: 0
          });
        } else {
          setResult({
            success: true,
            rows: [],
            columns: [],
            affectedRows: res.successCount,
            duration: 0
          });
        }
      }
    } catch (err) {
      console.error(err);
      alert('导入并执行 SQL 失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem('sql_query_history');
  };

  const handleExport = async (format) => {
    if (!result || !result.rows || result.rows.length === 0) return;
    try {
      const filePath = await window.electronAPI.showSaveExportDialog({ format });
      if (!filePath) return;
      
      setLoading(true);
      const res = await window.electronAPI.exportQueryData({
        rows: result.rows,
        filePath,
        format
      });
      if (res.success) {
        alert(`成功导出 ${res.count} 条查询结果。`);
      }
    } catch (err) {
      console.error(err);
      alert('导出失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="sql-editor">
      {/* Action bar */}
      <div className="editor-actions-bar">
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary btn-sm" onClick={handleExecute} disabled={loading}>
            <Play size={13} />
            {loading ? '执行中...' : '执行查询 (Ctrl+Enter)'}
          </button>
          
          <button className="btn btn-secondary btn-sm" onClick={handleImportSql} disabled={loading} title="执行外部 .sql 脚本文件">
            <FileCode size={13} />
            导入 SQL 脚本
          </button>

          <button 
            className={`btn btn-secondary btn-sm ${showHistory ? 'btn-active' : ''}`}
            onClick={() => setShowHistory(!showHistory)}
          >
            <History size={13} />
            执行历史
          </button>
        </div>

        {result && result.success && result.rows && result.rows.length > 0 && (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')} title="导出当前查询结果为 CSV">
              <Download size={12} />
              导出 CSV
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleExport('json')} title="导出当前查询结果为 JSON">
              <Download size={12} />
              导出 JSON
            </button>
          </div>
        )}
      </div>

      {/* Editor & History grid split */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <textarea
            className="sql-textarea"
            placeholder="SELECT * FROM my_table WHERE id = 1; \n-- 支持多行 SQL 语句与注释..."
            value={sql}
            onChange={e => setSql(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>

        {showHistory && (
          <div className="sql-history-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid var(--bg-darker)' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-light)' }}>历史查询记录</span>
              {history.length > 0 && (
                <button className="icon-btn delete" onClick={handleClearHistory} title="清空历史">
                  <Trash size={12} />
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ fontSize: '11px', color: 'var(--text-dark)', padding: '8px 0' }}>暂无查询历史记录。</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', flex: 1 }}>
                {history.map((h, idx) => (
                  <div 
                    key={idx} 
                    className="history-item"
                    onClick={() => { setSql(h); setShowHistory(false); }}
                    title={h}
                  >
                    {h}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result pane */}
      <div className="sql-result-pane">
        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-dark)', padding: '6px 12px', background: 'var(--bg-darker)', display: 'flex', justifyContent: 'space-between' }}>
          <span>查询结果</span>
          {result && (
            <span style={{ color: result.success ? 'var(--accent-color)' : '#ef4444' }}>
              {result.success ? `成功 (${result.duration}ms)` : '错误'}
            </span>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          {loading ? (
            <div className="loading-state">
              <RefreshCw size={24} className="spin text-accent" />
              <span>正在执行数据库查询，请稍候...</span>
            </div>
          ) : !result ? (
            <div className="loading-state">
              <span style={{ color: 'var(--text-dark)', fontSize: '12px' }}>
                在上方编辑 SQL 语句并点击“执行查询”或按 Ctrl+Enter 查看数据结果。
              </span>
            </div>
          ) : !result.success ? (
            <div style={{ padding: '16px', color: '#f87171', display: 'flex', gap: '8px', alignItems: 'flex-start', fontFamily: 'monospace', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>SQL 执行错误:</strong>
                <div style={{ marginTop: '4px' }}>{result.error}</div>
              </div>
            </div>
          ) : result.rows && result.rows.length > 0 ? (
            /* Selected grid output */
            <div className="table-wrapper" style={{ maxHeight: '100%' }}>
              <table>
                <thead>
                  <tr>
                    {result.columns.map(col => (
                      <th key={col} title={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, idx) => (
                    <tr key={idx}>
                      {result.columns.map(col => {
                        const val = row[col];
                        return (
                          <td key={col} title={val === null || val === undefined ? 'NULL' : String(val)}>
                            {val === null || val === undefined ? (
                              <span className="badge badge-null">NULL</span>
                            ) : (
                              String(val)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* Action query output (insert, update, delete) */
            <div style={{ padding: '16px', display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--text-light)' }}>
              <CheckCircle size={16} className="text-accent" style={{ color: 'var(--accent-color)' }} />
              <div>
                <span style={{ fontWeight: 600 }}>SQL 语句执行成功！</span>
                <span style={{ color: 'var(--text-dark)', marginLeft: '12px', fontSize: '12px' }}>
                  受影响行数: {result.affectedRows} 行 | 执行耗时: {result.duration}ms
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
