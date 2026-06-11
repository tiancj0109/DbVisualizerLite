import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DbExplorer from './components/DbExplorer';
import ConnectionModal from './components/ConnectionModal';
import TableViewer from './components/TableViewer';
import SqlEditor from './components/SqlEditor';
import { Database, Terminal, X, Plus, Play, HelpCircle, ShieldCheck } from 'lucide-react';

export default function App() {
  const [connections, setConnections] = useState([]);
  const [activeConnection, setActiveConnection] = useState(null);
  const [databases, setDatabases] = useState([]);
  const [activeDb, setActiveDb] = useState('');
  const [tables, setTables] = useState([]);
  const [activeTable, setActiveTable] = useState('');
  
  // Tab Management
  const [tabs, setTabs] = useState([]); // Array of { id, title, type, tableName, initialQuery }
  const [activeTabId, setActiveTabId] = useState('');

  // Modals & Forms
  const [showModal, setShowModal] = useState(false);
  const [editingConnection, setEditingConnection] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const list = await window.electronAPI.getSavedConnections();
      setConnections(list || []);
    } catch (err) {
      console.error('加载连接列表失败:', err);
    }
  };

  const handleSaveConnection = async (savedConn) => {
    let nextConnections = [...connections];
    const index = connections.findIndex(c => c.id === savedConn.id);
    if (index >= 0) {
      nextConnections[index] = savedConn;
    } else {
      nextConnections.push(savedConn);
    }
    
    try {
      await window.electronAPI.saveConnectionsList(nextConnections);
      setConnections(nextConnections);
      setShowModal(false);
      setEditingConnection(null);
    } catch (err) {
      alert('保存数据库连接配置失败: ' + err.message);
    }
  };

  const handleDeleteConnection = async (id) => {
    if (!confirm('您确定要删除此数据库连接配置吗？')) {
      return;
    }
    const nextConnections = connections.filter(c => c.id !== id);
    try {
      await window.electronAPI.saveConnectionsList(nextConnections);
      setConnections(nextConnections);
      if (activeConnection && activeConnection.id === id) {
        // 断开当前的活动连接
        await window.electronAPI.disconnectDatabase();
        setActiveConnection(null);
        setDatabases([]);
        setActiveDb('');
        setTables([]);
        setActiveTable('');
        setTabs([]);
        setActiveTabId('');
      }
    } catch (err) {
      alert('删除连接配置失败: ' + err.message);
    }
  };

  const handleSelectConnection = async (conn) => {
    if (activeConnection && activeConnection.id === conn.id) {
      return;
    }
    
    setConnecting(true);
    setErrorMessage('');
    setTables([]);
    setDatabases([]);
    setActiveDb('');
    setActiveTable('');
    setTabs([]);
    setActiveTabId('');

    try {
      const res = await window.electronAPI.connectDatabase(conn);
      if (res && res.success) {
        setActiveConnection(conn);
        
        // 加载数据库/模式列表
        const dbs = await window.electronAPI.getDatabasesList();
        setDatabases(dbs || []);
        
        if (conn.type === 'sqlite') {
          setActiveDb('main');
          const tList = await window.electronAPI.getTablesList();
          setTables(tList || []);
          
          // 打开默认的 SQL 编辑页
          openQueryTab('SQL 查询', 'SELECT * FROM sqlite_master;');
        } else {
          // 如果有默认数据库，尝试连接
          if (conn.database && dbs.includes(conn.database)) {
            await handleSelectDatabase(conn.database);
          } else if (dbs.length > 0) {
            await handleSelectDatabase(dbs[0]);
          }
          openQueryTab('SQL 查询', '');
        }
      }
    } catch (err) {
      setErrorMessage(err.message || '连接数据库失败，请检查配置。');
    } finally {
      setConnecting(false);
    }
  };

  const handleSelectDatabase = async (dbName) => {
    try {
      setActiveDb(dbName);
      setTables([]);
      setActiveTable('');
      
      await window.electronAPI.selectDatabase(dbName);
      const tList = await window.electronAPI.getTablesList();
      setTables(tList || []);
    } catch (err) {
      console.error(err);
      alert('切换数据库失败: ' + err.message);
    }
  };

  const handleSelectTable = (tableName) => {
    setActiveTable(tableName);
    
    // 打开新的表数据浏览页标签
    const tabId = `table_${tableName}`;
    const exists = tabs.find(t => t.id === tabId);
    if (!exists) {
      const newTab = {
        id: tabId,
        title: tableName,
        type: 'table',
        tableName: tableName
      };
      setTabs([...tabs, newTab]);
    }
    setActiveTabId(tabId);
  };

  const handleRefreshSchema = async () => {
    if (!activeConnection) return;
    try {
      if (activeConnection.type !== 'sqlite' && activeDb) {
        await window.electronAPI.selectDatabase(activeDb);
      }
      const tList = await window.electronAPI.getTablesList();
      setTables(tList || []);
    } catch (err) {
      console.error('刷新架构失败:', err);
    }
  };

  // 标签页打开逻辑
  const openQueryTab = (title = 'SQL 查询', initialQuery = '') => {
    const tabId = `query_${Date.now()}`;
    const newTab = {
      id: tabId,
      title: title,
      type: 'query',
      initialQuery: initialQuery
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(tabId);
  };

  const handleCloseTab = (tabId, e) => {
    e.stopPropagation();
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const nextTabs = tabs.filter(t => t.id !== tabId);
    setTabs(nextTabs);
    
    if (activeTabId === tabId) {
      if (nextTabs.length > 0) {
        const nextActiveIndex = Math.min(tabIndex, nextTabs.length - 1);
        setActiveTabId(nextTabs[nextActiveIndex].id);
      } else {
        setActiveTabId('');
      }
    }
  };

  // 通过特定 SQL 文本打开新 SQL 标签页
  const handleOpenQueryWithSql = (sqlText) => {
    openQueryTab('SQL 查询', sqlText);
  };

  return (
    <div className="app-container">
      {/* 1. 左侧侧边栏 - 连接管理器 */}
      <Sidebar 
        connections={connections}
        activeConnection={activeConnection}
        onSelectConnection={handleSelectConnection}
        onAddConnection={() => {
          setEditingConnection(null);
          setShowModal(true);
        }}
        onEditConnection={(conn) => {
          setEditingConnection(conn);
          setShowModal(true);
        }}
        onDeleteConnection={handleDeleteConnection}
      />

      {/* 2. 中间面板 - 数据架构管理器 (已连接时显示) */}
      {activeConnection ? (
        <DbExplorer 
          connection={activeConnection}
          databases={databases}
          activeDb={activeDb}
          tables={tables}
          activeTable={activeTable}
          onSelectDatabase={handleSelectDatabase}
          onSelectTable={handleSelectTable}
          onRefresh={handleRefreshSchema}
        />
      ) : (
        <div className="db-explorer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dark)' }}>
          <span style={{ fontSize: '12px' }}>未连接</span>
        </div>
      )}

      {/* 3. 右侧主工作区 */}
      <div className="main-workspace">
        {activeConnection ? (
          <>
            {/* 工作区标签页栏 */}
            <div className="workspace-tabs">
              {tabs.map(tab => {
                const isActive = activeTabId === tab.id;
                return (
                  <div 
                    key={tab.id}
                    className={`workspace-tab ${isActive ? 'active' : ''}`}
                    onClick={() => setActiveTabId(tab.id)}
                  >
                    {tab.type === 'query' ? <Terminal size={12} /> : <Database size={12} />}
                    <span>{tab.title}</span>
                    <button className="icon-btn" style={{ padding: '2px' }} onClick={(e) => handleCloseTab(tab.id, e)}>
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
              <button 
                className="icon-btn" 
                style={{ padding: '6px 12px', color: 'var(--text-muted)', borderTopLeftRadius: '6px', borderTopRightRadius: '6px', cursor: 'pointer' }}
                onClick={() => openQueryTab('SQL 查询', '')}
                title="新建 SQL 查询"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* 标签页内容显示 */}
            <div className="workspace-content">
              {tabs.length === 0 ? (
                <div className="empty-state">
                  <Terminal size={36} style={{ color: 'var(--text-dark)' }} />
                  <span className="empty-state-title">工作区为空</span>
                  <span>点击左侧列表中的表名称，或者点击标签栏的“+”按钮打开 SQL 编辑器。</span>
                </div>
              ) : (
                tabs.map(tab => {
                  const isVisible = activeTabId === tab.id;
                  if (!isVisible) return null;
                  
                  if (tab.type === 'table') {
                    return (
                      <TableViewer 
                        key={tab.id} 
                        tableName={tab.tableName} 
                        onOpenQuery={handleOpenQueryWithSql}
                      />
                    );
                  } else if (tab.type === 'query') {
                    return (
                      <SqlEditor 
                        key={tab.id} 
                        initialQuery={tab.initialQuery} 
                      />
                    );
                  }
                  return null;
                })
              )}
            </div>
          </>
        ) : (
          /* 空白连接状态提示 */
          <div className="empty-state">
            {connecting ? (
              <>
                <div style={{ animation: 'spin 1s linear infinite', border: '3px solid var(--border-light)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', width: '40px', height: '40px' }} />
                <span className="empty-state-title" style={{ marginTop: '10px' }}>正在连接数据库...</span>
                <span>正在建立安全的数据库通道，请稍候。</span>
              </>
            ) : (
              <>
                <Database size={48} style={{ color: 'var(--text-dark)' }} />
                <span className="empty-state-title">暂无活动连接</span>
                <span style={{ fontSize: '13px', maxWidth: '400px', textAlign: 'center' }}>
                  请在左侧列表中双击以开启已保存的数据库连接，或点击左下角的“新建连接”按钮配置新的数据库。
                </span>
                
                {errorMessage && (
                  <div className="badge btn-danger" style={{ padding: '8px 16px', marginTop: '16px', maxWidth: '400px', whiteSpace: 'pre-wrap' }}>
                    {errorMessage}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* 4. 新增/编辑连接弹窗 */}
      {showModal && (
        <ConnectionModal 
          connection={editingConnection}
          onSave={handleSaveConnection}
          onClose={() => {
            setShowModal(false);
            setEditingConnection(null);
          }}
        />
      )}
    </div>
  );
}
