const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const DbService = require('./dbService');

let mainWindow = null;
const CONNECTIONS_FILE = path.join(app.getPath('userData'), 'connections.json');

// Obfuscate password helper
function encodePassword(pw) {
  if (!pw) return '';
  return Buffer.from(pw, 'utf-8').toString('base64');
}

function decodePassword(encoded) {
  if (!encoded) return '';
  try {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  } catch (e) {
    return '';
  }
}

function loadSavedConnections() {
  if (!fs.existsSync(CONNECTIONS_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(CONNECTIONS_FILE, 'utf-8'));
    return data.map(conn => ({
      ...conn,
      password: decodePassword(conn.password)
    }));
  } catch (err) {
    console.error('Error loading connections:', err);
    return [];
  }
}

function saveConnections(connections) {
  try {
    const data = connections.map(conn => ({
      ...conn,
      password: encodePassword(conn.password)
    }));
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving connections:', err);
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: true,
    show: false,
    backgroundColor: '#121214',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false // needed for native bindings if any
    }
  });

  // Load app (dev or production)
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('get-saved-connections', () => {
  return loadSavedConnections();
});

ipcMain.handle('save-connections-list', (event, list) => {
  return saveConnections(list);
});

ipcMain.handle('connect-database', async (event, config) => {
  return await DbService.connect(config);
});

ipcMain.handle('disconnect-database', async () => {
  return await DbService.disconnect();
});

ipcMain.handle('get-databases-list', async () => {
  return await DbService.getDatabases();
});

ipcMain.handle('select-database', async (event, dbName) => {
  return await DbService.selectDatabase(dbName);
});

ipcMain.handle('get-tables-list', async () => {
  return await DbService.getTables();
});

ipcMain.handle('get-table-schema', async (event, tableName) => {
  return await DbService.getTableSchema(tableName);
});

ipcMain.handle('get-table-data', async (event, params) => {
  return await DbService.getTableData(params);
});

ipcMain.handle('execute-raw-query', async (event, sql) => {
  return await DbService.executeQuery(sql);
});

// SQLite File Selection dialog
ipcMain.handle('show-open-sqlite-dialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select SQLite Database File',
    properties: ['openFile'],
    filters: [
      { name: 'SQLite Databases', extensions: ['db', 'sqlite', 'sqlite3', 'db3'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

// SQLite New File dialog
ipcMain.handle('show-save-sqlite-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Create New SQLite Database File',
    defaultPath: 'new_database.db',
    filters: [
      { name: 'SQLite Databases', extensions: ['db', 'sqlite', 'sqlite3', 'db3'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  // Create an empty file
  try {
    fs.writeFileSync(result.filePath, '');
    return result.filePath;
  } catch (err) {
    console.error('Failed to create empty SQLite file:', err);
    throw new Error('Failed to create file: ' + err.message);
  }
});

// Export dialog
ipcMain.handle('show-save-export-dialog', async (event, { tableName, format }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: `Export ${tableName || 'Query Results'}`,
    defaultPath: `${tableName || 'query_results'}.${format}`,
    filters: [
      { name: format === 'csv' ? 'CSV Files' : 'JSON Files', extensions: [format] }
    ]
  });
  if (result.canceled || !result.filePath) {
    return null;
  }
  return result.filePath;
});

// Import dialog
ipcMain.handle('show-open-import-dialog', async (event, { format }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: `Select file to import (${format.toUpperCase()})`,
    properties: ['openFile'],
    filters: [
      { name: format === 'csv' ? 'CSV Files' : 'SQL Files', extensions: [format] }
    ]
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('export-table-data', async (event, { tableName, filePath, format }) => {
  return await DbService.exportTable({ tableName, filePath, format });
});

ipcMain.handle('export-query-data', async (event, { rows, filePath, format }) => {
  return await DbService.exportQueryResult({ rows, filePath, format });
});

ipcMain.handle('import-table-data', async (event, { tableName, filePath }) => {
  return await DbService.importTableCSV({ tableName, filePath });
});

ipcMain.handle('import-sql-file', async (event, { filePath }) => {
  return await DbService.importSqlFile({ filePath });
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
