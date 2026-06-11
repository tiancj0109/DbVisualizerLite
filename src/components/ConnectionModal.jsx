import React, { useState, useEffect } from 'react';
import { X, FolderOpen, FilePlus } from 'lucide-react';

export default function ConnectionModal({ connection, onSave, onClose }) {
  const [type, setType] = useState('mysql');
  const [name, setName] = useState('');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('3306');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [database, setDatabase] = useState('');
  const [sqlitePath, setSqlitePath] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    if (connection) {
      setType(connection.type || 'mysql');
      setName(connection.name || '');
      setHost(connection.host || 'localhost');
      setPort(connection.port || '3306');
      setUsername(connection.username || '');
      setPassword(connection.password || '');
      setDatabase(connection.database || '');
      setSqlitePath(connection.sqlitePath || '');
      setTestResult(null);
    } else {
      // Clear all fields for new connection
      setType('mysql');
      setName('');
      setHost('localhost');
      setPort('3306');
      setUsername('root');
      setPassword('');
      setDatabase('');
      setSqlitePath('');
      setTestResult(null);
    }
  }, [connection]);

  const resetForm = (newType) => {
    setType(newType);
    setTestResult(null);
    if (newType === 'mysql') {
      setPort('3306');
      setUsername('root');
      setHost('localhost');
    } else if (newType === 'pg') {
      setPort('5432');
      setUsername('postgres');
      setHost('localhost');
    } else if (newType === 'mssql') {
      setPort('1433');
      setUsername('sa');
      setHost('localhost');
    }
  };

  const handleTypeChange = (e) => {
    const newType = e.target.value;
    resetForm(newType);
  };

  const handleSelectSqliteFile = async () => {
    try {
      const path = await window.electronAPI.showOpenSqliteDialog();
      if (path) {
        setSqlitePath(path);
        if (!name) {
          const fileName = path.split('\\').pop().split('/').pop();
          setName(fileName);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateSqliteFile = async () => {
    try {
      const path = await window.electronAPI.showSaveSqliteDialog();
      if (path) {
        setSqlitePath(path);
        if (!name) {
          const fileName = path.split('\\').pop().split('/').pop();
          setName(fileName);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const config = { type, host, port, username, password, database, sqlitePath };
    try {
      const res = await window.electronAPI.connectDatabase(config);
      if (res && res.success) {
        setTestResult({ success: true, message: res.message });
      } else {
        setTestResult({ success: false, message: '连接失败' });
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message || '连接失败' });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    if (!name) {
      alert('请输入连接名称。');
      return;
    }
    if (type === 'sqlite' && !sqlitePath) {
      alert('请选择或新建一个 SQLite 数据库文件。');
      return;
    }
    if (type !== 'sqlite' && !host) {
      alert('请输入数据库主机地址。');
      return;
    }

    const savedConnection = {
      id: connection ? connection.id : Date.now().toString(),
      type,
      name,
      host,
      port,
      username,
      password,
      database,
      sqlitePath
    };
    onSave(savedConnection);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3 className="modal-title">{connection ? '编辑连接' : '新建连接'}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="form-group">
            <label>数据库类型</label>
            <select value={type} onChange={handleTypeChange}>
              <option value="mysql">MySQL</option>
              <option value="sqlite">SQLite</option>
              <option value="pg">PostgreSQL</option>
              <option value="mssql">SQL Server (MSSQL)</option>
            </select>
          </div>

          <div className="form-group">
            <label>连接名称</label>
            <input 
              type="text" 
              placeholder="例如: 本地MySQL数据库" 
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>

          {type === 'sqlite' ? (
            <div className="form-group">
              <label>SQLite 文件路径</label>
              <div className="file-select-field">
                <input 
                  type="text" 
                  placeholder="C:\\路径\\到\\数据库文件.db" 
                  value={sqlitePath} 
                  onChange={e => setSqlitePath(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={handleSelectSqliteFile} title="浏览文件">
                  <FolderOpen size={16} />
                </button>
                <button className="btn btn-secondary" onClick={handleCreateSqliteFile} title="新建文件">
                  <FilePlus size={16} />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group" style={{ flex: 3 }}>
                  <label>主机地址 (Host)</label>
                  <input 
                    type="text" 
                    placeholder="localhost 或 127.0.0.1" 
                    value={host} 
                    onChange={e => setHost(e.target.value)} 
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>端口 (Port)</label>
                  <input 
                    type="text" 
                    placeholder="3306" 
                    value={port} 
                    onChange={e => setPort(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>用户名 (Username)</label>
                  <input 
                    type="text" 
                    placeholder="root" 
                    value={username} 
                    onChange={e => setUsername(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label>密码 (Password)</label>
                  <input 
                    type="password" 
                    placeholder="连接密码 (支持中文)" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                  />
                </div>
              </div>

              <div className="form-group">
                <label>数据库名 (Database - 可选)</label>
                <input 
                  type="text" 
                  placeholder="请输入要连接的数据库名" 
                  value={database} 
                  onChange={e => setDatabase(e.target.value)} 
                />
              </div>
            </>
          )}

          {testResult && (
            <div className={`badge ${testResult.success ? 'badge-notnull' : 'btn-danger'}`} style={{ padding: '8px 12px', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
              {testResult.message}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={handleSave}>
            保存
          </button>
        </div>
      </div>
    </div>
  );
}
