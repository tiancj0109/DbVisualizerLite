const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSavedConnections: () => ipcRenderer.invoke('get-saved-connections'),
  saveConnectionsList: (list) => ipcRenderer.invoke('save-connections-list', list),
  connectDatabase: (config) => ipcRenderer.invoke('connect-database', config),
  disconnectDatabase: () => ipcRenderer.invoke('disconnect-database'),
  getDatabasesList: () => ipcRenderer.invoke('get-databases-list'),
  selectDatabase: (dbName) => ipcRenderer.invoke('select-database', dbName),
  getTablesList: () => ipcRenderer.invoke('get-tables-list'),
  getTableSchema: (tableName) => ipcRenderer.invoke('get-table-schema', tableName),
  getTableData: (params) => ipcRenderer.invoke('get-table-data', params),
  executeRawQuery: (sql) => ipcRenderer.invoke('execute-raw-query', sql),

  // Dialogs
  showOpenSqliteDialog: () => ipcRenderer.invoke('show-open-sqlite-dialog'),
  showSaveSqliteDialog: () => ipcRenderer.invoke('show-save-sqlite-dialog'),
  showSaveExportDialog: (params) => ipcRenderer.invoke('show-save-export-dialog', params),
  showOpenImportDialog: (params) => ipcRenderer.invoke('show-open-import-dialog', params),

  // Imports/Exports
  exportTableData: (params) => ipcRenderer.invoke('export-table-data', params),
  exportQueryData: (params) => ipcRenderer.invoke('export-query-data', params),
  importTableData: (params) => ipcRenderer.invoke('import-table-data', params),
  importSqlFile: (params) => ipcRenderer.invoke('import-sql-file', params),

  // Connection status listener
  onConnectionLost: (callback) => {
    ipcRenderer.on('connection-lost', () => callback());
    return () => ipcRenderer.removeListener('connection-lost', callback);
  },
  onConnectionRestored: (callback) => {
    ipcRenderer.on('connection-restored', () => callback());
    return () => ipcRenderer.removeListener('connection-restored', callback);
  }
});
