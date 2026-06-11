const mysql = require('mysql2/promise');
const { Client } = require('pg');
const initSqlJs = require('sql.js');
const { Connection: TediousConnection, Request: TediousRequest, TYPES } = require('tedious');
const fs = require('fs');

// Simple CSV Parser Helper
function parseCSV(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',') {
      if (inQuotes) {
        row[row.length - 1] += c;
      } else {
        row.push("");
      }
    } else if (c === '\r' || c === '\n') {
      if (inQuotes) {
        row[row.length - 1] += c;
      } else {
        if (c === '\r' && next === '\n') i++;
        lines.push(row);
        row = [""];
      }
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== "") {
    lines.push(row);
  }
  return lines;
}

// Simple CSV Generator Helper
function generateCSV(headers, rows) {
  const escapeField = (val) => {
    if (val === null || val === undefined) return '';
    let str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const headerLine = headers.map(escapeField).join(',');
  const rowLines = rows.map(row => {
    return headers.map(h => escapeField(row[h])).join(',');
  });
  return [headerLine, ...rowLines].join('\n');
}

// Active connection pool/instances cache
let activeConnection = null;
let activeDbType = null;
let activeDbConfig = null;

// Wrap SQL Server connection in a promise-based helper
class TediousWrapper {
  constructor(config) {
    this.config = config;
    this.connection = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connection = new TediousConnection(this.config);
      this.connection.on('connect', (err) => {
        if (err) reject(err);
        else resolve(this);
      });
      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('Tedious error:', err);
      });
    });
  }

  query(sql) {
    return new Promise((resolve, reject) => {
      const request = new TediousRequest(sql, (err, rowCount, rows) => {
        if (err) {
          reject(err);
        } else {
          // Format rows into key-value pairs
          const formattedRows = rows.map(row => {
            const r = {};
            row.forEach(col => {
              r[col.metadata.colName] = col.value;
            });
            return r;
          });
          resolve({ rows: formattedRows, rowCount });
        }
      });
      this.connection.execSql(request);
    });
  }

  close() {
    if (this.connection) {
      this.connection.close();
    }
  }
}

// SQLite promise helper wrapper
class SQLiteWrapper {
  constructor(filePath) {
    this.filePath = filePath;
    this.db = null;
  }

  async connect() {
    const init = await initSqlJs();
    if (fs.existsSync(this.filePath) && fs.statSync(this.filePath).size > 0) {
      const filebuffer = fs.readFileSync(this.filePath);
      this.db = new init.Database(filebuffer);
    } else {
      // Create empty db
      this.db = new init.Database();
      this.save();
    }
    return this;
  }

  save() {
    if (this.db) {
      const data = this.db.export();
      fs.writeFileSync(this.filePath, Buffer.from(data));
    }
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const res = this.db.exec(sql, params);
        if (res.length === 0) {
          return resolve({ rows: [] });
        }
        const columns = res[0].columns;
        const rows = res[0].values.map(valArr => {
          const r = {};
          columns.forEach((col, idx) => {
            r[col] = valArr[idx];
          });
          return r;
        });
        resolve({ rows });
      } catch (err) {
        reject(err);
      }
    });
  }

  run(sql, params = [], autoSave = true) {
    return new Promise((resolve, reject) => {
      try {
        this.db.run(sql, params);
        if (autoSave) {
          this.save();
        }
        const changes = this.db.getRowsModified();
        resolve({ changes });
      } catch (err) {
        reject(err);
      }
    });
  }

  close() {
    if (this.db) {
      this.save(); // ensure final save
      this.db.close();
      this.db = null;
    }
    return Promise.resolve();
  }
}

async function closeActiveConnection() {
  if (!activeConnection) return;
  try {
    if (activeDbType === 'mysql') {
      await activeConnection.end();
    } else if (activeDbType === 'pg') {
      await activeConnection.end();
    } else if (activeDbType === 'mssql') {
      activeConnection.close();
    } else if (activeDbType === 'sqlite') {
      await activeConnection.close();
    }
  } catch (err) {
    console.error('Error closing database connection:', err);
  }
  activeConnection = null;
  activeDbType = null;
  activeDbConfig = null;
}

// Exported Service Methods
const DbService = {
  async connect(config) {
    await closeActiveConnection();
    const { type, host, port, username, password, database, sqlitePath } = config;

    const withTimeout = (promise, ms, errorMsg) => {
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(errorMsg)), ms);
      });
      return Promise.race([
        promise.then(res => {
          clearTimeout(timeoutId);
          return res;
        }),
        timeoutPromise
      ]);
    };
    
    try {
      if (type === 'mysql') {
        const connPromise = mysql.createConnection({
          host,
          port: parseInt(port) || 3306,
          user: username,
          password: password,
          database: database || undefined,
          charset: 'utf8mb4',
          connectTimeout: 5000
        });
        const conn = await withTimeout(connPromise, 6000, '连接 MySQL 超时，请检查网络、主机和端口。');
        activeConnection = conn;
        activeDbType = 'mysql';
        activeDbConfig = config;
        return { success: true, message: '连接 MySQL 成功。' };
      } else if (type === 'pg') {
        const client = new Client({
          host,
          port: parseInt(port) || 5432,
          user: username,
          password: password,
          database: database || 'postgres',
          connectionTimeoutMillis: 5000
        });
        await withTimeout(client.connect(), 6000, '连接 PostgreSQL 超时，请检查网络、主机和端口。');
        activeConnection = client;
        activeDbType = 'pg';
        activeDbConfig = config;
        return { success: true, message: '连接 PostgreSQL 成功。' };
      } else if (type === 'mssql') {
        const tediousConfig = {
          server: host,
          authentication: {
            type: 'default',
            options: { userName: username, password: password }
          },
          options: {
            port: parseInt(port) || 1433,
            database: database || undefined,
            encrypt: false,
            trustServerCertificate: true,
            rowCollectionOnRequestCompletion: true,
            connectTimeout: 5000,
            requestTimeout: 15000
          }
        };
        const wrapper = new TediousWrapper(tediousConfig);
        await withTimeout(wrapper.connect(), 6000, '连接 SQL Server 超时，请检查网络、主机和端口。');
        activeConnection = wrapper;
        activeDbType = 'mssql';
        activeDbConfig = config;
        return { success: true, message: '连接 SQL Server 成功。' };
      } else if (type === 'sqlite') {
        if (!sqlitePath) {
          throw new Error('SQLite 数据库文件路径不能为空。');
        }
        const wrapper = new SQLiteWrapper(sqlitePath);
        await wrapper.connect();
        activeConnection = wrapper;
        activeDbType = 'sqlite';
        activeDbConfig = config;
        return { success: true, message: '连接 SQLite 成功。' };
      } else {
        throw new Error(`不支持的数据库类型: ${type}`);
      }
    } catch (error) {
      console.error('Connection error:', error);
      throw new Error(error.message || '连接数据库失败');
    }
  },

  async getDatabases() {
    if (!activeConnection) throw new Error('No active database connection.');
    
    if (activeDbType === 'mysql') {
      const [rows] = await activeConnection.query('SHOW DATABASES');
      return rows.map(r => r.Database || r.database);
    } else if (activeDbType === 'pg') {
      const res = await activeConnection.query("SELECT datname FROM pg_database WHERE datistemplate = false;");
      return res.rows.map(r => r.datname);
    } else if (activeDbType === 'mssql') {
      const res = await activeConnection.query("SELECT name FROM sys.databases;");
      return res.rows.map(r => r.name);
    } else if (activeDbType === 'sqlite') {
      return ['main'];
    }
    return [];
  },

  async selectDatabase(dbName) {
    if (!activeConnection) throw new Error('No active database connection.');
    
    if (activeDbType === 'mysql') {
      await activeConnection.query(`USE \`${dbName}\``);
      activeDbConfig.database = dbName;
    } else if (activeDbType === 'pg') {
      // Postgres client does not support USE database, we must reconnect
      const newConfig = { ...activeDbConfig, database: dbName };
      await this.connect(newConfig);
    } else if (activeDbType === 'mssql') {
      await activeConnection.query(`USE [${dbName}]`);
      activeDbConfig.database = dbName;
    } else if (activeDbType === 'sqlite') {
      // SQLite has no databases to select
    }
    return { success: true };
  },

  async getTables() {
    if (!activeConnection) throw new Error('No active database connection.');
    
    if (activeDbType === 'mysql') {
      const [rows] = await activeConnection.query('SHOW TABLES');
      return rows.map(r => Object.values(r)[0]);
    } else if (activeDbType === 'pg') {
      const res = await activeConnection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';"
      );
      return res.rows.map(r => r.table_name);
    } else if (activeDbType === 'mssql') {
      const res = await activeConnection.query(
        "SELECT table_name FROM information_schema.tables WHERE table_type = 'BASE TABLE';"
      );
      return res.rows.map(r => r.table_name);
    } else if (activeDbType === 'sqlite') {
      const res = await activeConnection.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
      );
      return res.rows.map(r => r.name);
    }
    return [];
  },

  async getTableSchema(tableName) {
    if (!activeConnection) throw new Error('No active database connection.');
    
    if (activeDbType === 'mysql') {
      const [rows] = await activeConnection.query(`DESCRIBE \`${tableName}\``);
      return rows.map(r => ({
        column: r.Field,
        type: r.Type,
        nullable: r.Null,
        key: r.Key,
        default: r.Default
      }));
    } else if (activeDbType === 'pg') {
      const query = `
        SELECT column_name, data_type, is_nullable, column_default,
               (SELECT count(*) FROM information_schema.table_constraints tc 
                JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name 
                WHERE tc.table_name = c.table_name AND kcu.column_name = c.column_name AND tc.constraint_type = 'PRIMARY KEY') as is_pk
        FROM information_schema.columns c
        WHERE table_schema = 'public' AND table_name = $1;
      `;
      const res = await activeConnection.query(query, [tableName]);
      return res.rows.map(r => ({
        column: r.column_name,
        type: r.data_type,
        nullable: r.is_nullable,
        key: parseInt(r.is_pk) > 0 ? 'PRI' : '',
        default: r.column_default
      }));
    } else if (activeDbType === 'mssql') {
      const query = `
        SELECT c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE, c.COLUMN_DEFAULT,
               (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
                WHERE tc.TABLE_NAME = c.TABLE_NAME AND kcu.COLUMN_NAME = c.COLUMN_NAME AND tc.CONSTRAINT_TYPE = 'PRIMARY KEY') as is_pk
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_NAME = '${tableName}';
      `;
      const res = await activeConnection.query(query);
      return res.rows.map(r => ({
        column: r.COLUMN_NAME,
        type: r.DATA_TYPE,
        nullable: r.IS_NULLABLE,
        key: r.is_pk > 0 ? 'PRI' : '',
        default: r.COLUMN_DEFAULT
      }));
    } else if (activeDbType === 'sqlite') {
      const rows = await activeConnection.query(`PRAGMA table_info(\`${tableName}\`);`);
      return rows.rows.map(r => ({
        column: r.name,
        type: r.type,
        nullable: r.notnull ? 'NO' : 'YES',
        key: r.pk ? 'PRI' : '',
        default: r.dflt_value
      }));
    }
    return [];
  },

  async getTableData({ tableName, page = 1, pageSize = 50, sortBy, sortOrder, filters = [] }) {
    if (!activeConnection) throw new Error('No active database connection.');
    
    const offset = (page - 1) * pageSize;
    
    // Construct filter SQL clause
    let whereClause = '';
    const params = [];
    
    if (filters && filters.length > 0) {
      const clauses = filters.map(f => {
        let op = f.operator;
        let val = f.value;
        let col = f.column;
        
        // Escape identifiers based on database type
        let colName = col;
        if (activeDbType === 'mysql' || activeDbType === 'sqlite') {
          colName = `\`${col}\``;
        } else if (activeDbType === 'pg') {
          colName = `"${col}"`;
        } else if (activeDbType === 'mssql') {
          colName = `[${col}]`;
        }

        if (op === 'like') {
          val = `%${val}%`;
        }
        
        if (activeDbType === 'pg') {
          params.push(val);
          return `${colName} ${op === 'like' ? 'ILIKE' : op} $${params.length}`;
        } else if (activeDbType === 'mssql') {
          // SQL server tedious query parses parameters differently, we'll embed safely or use standard SQL
          // For simple UI filters, we will clean and safely format the values directly for MSSQL
          const escapedVal = String(val).replace(/'/g, "''");
          return `${colName} ${op === 'like' ? 'LIKE' : op} N'${escapedVal}'`;
        } else {
          // MySQL / SQLite
          params.push(val);
          return `${colName} ${op === 'like' ? 'LIKE' : op} ?`;
        }
      });
      whereClause = ' WHERE ' + clauses.join(' AND ');
    }

    // Sort order
    let sortClause = '';
    if (sortBy) {
      let colName = sortBy;
      if (activeDbType === 'mysql' || activeDbType === 'sqlite') {
        colName = `\`${sortBy}\``;
      } else if (activeDbType === 'pg') {
        colName = `"${sortBy}"`;
      } else if (activeDbType === 'mssql') {
        colName = `[${sortBy}]`;
      }
      sortClause = ` ORDER BY ${colName} ${sortOrder === 'desc' ? 'DESC' : 'ASC'}`;
    }

    let querySql = '';
    let countSql = '';
    
    if (activeDbType === 'mysql') {
      const tableEscaped = `\`${tableName}\``;
      querySql = `SELECT * FROM ${tableEscaped}${whereClause}${sortClause} LIMIT ${pageSize} OFFSET ${offset}`;
      countSql = `SELECT COUNT(*) as total FROM ${tableEscaped}${whereClause}`;
      
      const [[countRes]] = await activeConnection.query(countSql, params);
      const [rows] = await activeConnection.query(querySql, params);
      return { rows, total: countRes.total };
    } 
    else if (activeDbType === 'pg') {
      const tableEscaped = `"${tableName}"`;
      querySql = `SELECT * FROM ${tableEscaped}${whereClause}${sortClause} LIMIT ${pageSize} OFFSET ${offset}`;
      countSql = `SELECT COUNT(*) as total FROM ${tableEscaped}${whereClause}`;
      
      const countRes = await activeConnection.query(countSql, params);
      const rowsRes = await activeConnection.query(querySql, params);
      return { rows: rowsRes.rows, total: parseInt(countRes.rows[0].total) };
    } 
    else if (activeDbType === 'mssql') {
      const tableEscaped = `[${tableName}]`;
      // MSSQL requires ORDER BY for OFFSET/FETCH. If none exists, we sort by select null
      const order = sortClause || ' ORDER BY (SELECT NULL)';
      querySql = `SELECT * FROM ${tableEscaped}${whereClause}${order} OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY`;
      countSql = `SELECT COUNT(*) as total FROM ${tableEscaped}${whereClause}`;
      
      const countRes = await activeConnection.query(countSql);
      const rowsRes = await activeConnection.query(querySql);
      return { rows: rowsRes.rows, total: countRes.rows[0].total };
    } 
    else if (activeDbType === 'sqlite') {
      const tableEscaped = `\`${tableName}\``;
      querySql = `SELECT * FROM ${tableEscaped}${whereClause}${sortClause} LIMIT ${pageSize} OFFSET ${offset}`;
      countSql = `SELECT COUNT(*) as total FROM ${tableEscaped}${whereClause}`;
      
      const countRes = await activeConnection.query(countSql, params);
      const rowsRes = await activeConnection.query(querySql, params);
      return { rows: rowsRes.rows, total: countRes.rows[0].total };
    }
    return { rows: [], total: 0 };
  },

  async executeQuery(sql) {
    if (!activeConnection) throw new Error('No active database connection.');
    
    const startTime = Date.now();
    try {
      if (activeDbType === 'mysql') {
        const [rows, fields] = await activeConnection.query(sql);
        const duration = Date.now() - startTime;
        
        if (Array.isArray(rows)) {
          return {
            success: true,
            rows,
            columns: fields ? fields.map(f => f.name) : (rows.length > 0 ? Object.keys(rows[0]) : []),
            duration,
            affectedRows: 0
          };
        } else {
          return {
            success: true,
            rows: [],
            columns: [],
            duration,
            affectedRows: rows.affectedRows || 0
          };
        }
      } 
      else if (activeDbType === 'pg') {
        const res = await activeConnection.query(sql);
        const duration = Date.now() - startTime;
        
        if (Array.isArray(res)) {
          // Multi statement query execution
          const lastResult = res[res.length - 1];
          return {
            success: true,
            rows: lastResult.rows || [],
            columns: lastResult.fields ? lastResult.fields.map(f => f.name) : [],
            duration,
            affectedRows: lastResult.rowCount || 0
          };
        } else {
          return {
            success: true,
            rows: res.rows || [],
            columns: res.fields ? res.fields.map(f => f.name) : [],
            duration,
            affectedRows: res.rowCount || 0
          };
        }
      } 
      else if (activeDbType === 'mssql') {
        const res = await activeConnection.query(sql);
        const duration = Date.now() - startTime;
        return {
          success: true,
          rows: res.rows || [],
          columns: res.rows.length > 0 ? Object.keys(res.rows[0]) : [],
          duration,
          affectedRows: res.rowCount || 0
        };
      } 
      else if (activeDbType === 'sqlite') {
        // Run can change state or select
        const cleanSql = sql.trim().toLowerCase();
        const duration = Date.now() - startTime;
        
        if (cleanSql.startsWith('select') || cleanSql.startsWith('pragma') || cleanSql.startsWith('show') || cleanSql.startsWith('explain')) {
          const rowsRes = await activeConnection.query(sql);
          return {
            success: true,
            rows: rowsRes.rows,
            columns: rowsRes.rows.length > 0 ? Object.keys(rowsRes.rows[0]) : [],
            duration,
            affectedRows: 0
          };
        } else {
          const runRes = await activeConnection.run(sql);
          return {
            success: true,
            rows: [],
            columns: [],
            duration,
            affectedRows: runRes.changes || 0
          };
        }
      }
    } catch (err) {
      console.error('Execute query error:', err);
      return {
        success: false,
        error: err.message || 'Unknown database execution error',
        duration: Date.now() - startTime
      };
    }
  },

  async exportTable({ tableName, filePath, format }) {
    if (!activeConnection) throw new Error('No active database connection.');
    
    // Fetch all data in the table for export
    let rows = [];
    if (activeDbType === 'mysql') {
      const [r] = await activeConnection.query(`SELECT * FROM \`${tableName}\``);
      rows = r;
    } else if (activeDbType === 'pg') {
      const r = await activeConnection.query(`SELECT * FROM "${tableName}"`);
      rows = r.rows;
    } else if (activeDbType === 'mssql') {
      const r = await activeConnection.query(`SELECT * FROM [${tableName}]`);
      rows = r.rows;
    } else if (activeDbType === 'sqlite') {
      const r = await activeConnection.query(`SELECT * FROM \`${tableName}\``);
      rows = r.rows;
    }

    if (format === 'csv') {
      if (rows.length === 0) {
        fs.writeFileSync(filePath, '');
        return { success: true, count: 0 };
      }
      const headers = Object.keys(rows[0]);
      const csvStr = generateCSV(headers, rows);
      fs.writeFileSync(filePath, csvStr, 'utf-8');
      return { success: true, count: rows.length };
    } else if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
      return { success: true, count: rows.length };
    }
    throw new Error(`Unsupported export format: ${format}`);
  },

  async exportQueryResult({ rows, filePath, format }) {
    if (!rows || rows.length === 0) {
      fs.writeFileSync(filePath, '');
      return { success: true, count: 0 };
    }

    if (format === 'csv') {
      const headers = Object.keys(rows[0]);
      const csvStr = generateCSV(headers, rows);
      fs.writeFileSync(filePath, csvStr, 'utf-8');
      return { success: true, count: rows.length };
    } else if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf-8');
      return { success: true, count: rows.length };
    }
    throw new Error(`Unsupported export format: ${format}`);
  },

  async importTableCSV({ tableName, filePath }) {
    if (!activeConnection) throw new Error('No active database connection.');
    
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseCSV(content);
    if (parsed.length === 0) throw new Error('CSV file is empty.');
    
    const headers = parsed[0];
    const rows = parsed.slice(1).filter(r => r.length === headers.length || (r.length === 1 && r[0] === '')); // filter empty rows

    if (rows.length === 0) return { success: true, count: 0 };

    let successCount = 0;
    
    // Perform import inside database transactions/batches if possible
    if (activeDbType === 'mysql') {
      const conn = activeConnection;
      await conn.query('START TRANSACTION');
      try {
        const columnsStr = headers.map(h => `\`${h}\``).join(',');
        const placeholders = headers.map(() => '?').join(',');
        const sql = `INSERT INTO \`${tableName}\` (${columnsStr}) VALUES (${placeholders})`;
        
        for (const row of rows) {
          if (row.length === headers.length) {
            await conn.query(sql, row.map(v => v === '' ? null : v));
            successCount++;
          }
        }
        await conn.query('COMMIT');
      } catch (err) {
        await conn.query('ROLLBACK');
        throw err;
      }
    } 
    else if (activeDbType === 'pg') {
      const client = activeConnection;
      await client.query('BEGIN');
      try {
        const columnsStr = headers.map(h => `"${h}"`).join(',');
        const sqlTemplate = `INSERT INTO "${tableName}" (${columnsStr}) VALUES `;
        
        for (const row of rows) {
          if (row.length === headers.length) {
            const values = row.map((v, idx) => `$${idx + 1}`).join(',');
            await client.query(`${sqlTemplate}(${values})`, row.map(v => v === '' ? null : v));
            successCount++;
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    } 
    else if (activeDbType === 'mssql') {
      const conn = activeConnection;
      // SQL Server batch inserts
      await conn.query('BEGIN TRANSACTION');
      try {
        const columnsStr = headers.map(h => `[${h}]`).join(',');
        for (const row of rows) {
          if (row.length === headers.length) {
            const valuesStr = row.map(v => {
              if (v === '') return 'NULL';
              return `N'${String(v).replace(/'/g, "''")}'`;
            }).join(',');
            const sql = `INSERT INTO [${tableName}] (${columnsStr}) VALUES (${valuesStr})`;
            await conn.query(sql);
            successCount++;
          }
        }
        await conn.query('COMMIT TRANSACTION');
      } catch (err) {
        await conn.query('ROLLBACK TRANSACTION');
        throw err;
      }
    } 
    else if (activeDbType === 'sqlite') {
      const conn = activeConnection;
      await conn.run('BEGIN TRANSACTION', [], false);
      try {
        const columnsStr = headers.map(h => `\`${h}\``).join(',');
        const placeholders = headers.map(() => '?').join(',');
        const sql = `INSERT INTO \`${tableName}\` (${columnsStr}) VALUES (${placeholders})`;
        
        for (const row of rows) {
          if (row.length === headers.length) {
            await conn.run(sql, row.map(v => v === '' ? null : v), false);
            successCount++;
          }
        }
        await conn.run('COMMIT', [], true);
      } catch (err) {
        await conn.run('ROLLBACK', [], false);
        throw err;
      }
    }
    
    return { success: true, count: successCount };
  },

  async importSqlFile({ filePath }) {
    if (!activeConnection) throw new Error('No active database connection.');
    
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Split SQL by semicolon, handling comments and empty lines
    // A simple parser to split by semicolon, ignoring semicolons inside strings
    const queries = [];
    let currentQuery = '';
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      // Handle comments
      if (!inString && char === '-' && nextChar === '-') {
        // Skip comment line
        while (i < content.length && content[i] !== '\n') {
          i++;
        }
        continue;
      }
      if (!inString && char === '/' && nextChar === '*') {
        // Skip block comment
        i += 2;
        while (i < content.length && !(content[i] === '*' && content[i + 1] === '/')) {
          i++;
        }
        i++; // skip /
        continue;
      }

      // Handle strings
      if ((char === "'" || char === '"' || char === '`') && (i === 0 || content[i - 1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      if (char === ';' && !inString) {
        if (currentQuery.trim() !== '') {
          queries.push(currentQuery.trim());
        }
        currentQuery = '';
      } else {
        currentQuery += char;
      }
    }
    if (currentQuery.trim() !== '') {
      queries.push(currentQuery.trim());
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Execute query list
    for (const q of queries) {
      try {
        await this.executeQuery(q);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({ query: q.substring(0, 100) + '...', error: err.message });
      }
    }
    
    if (activeDbType === 'sqlite' && activeConnection) {
      activeConnection.save();
    }

    return { success: true, total: queries.length, successCount, errorCount, errors };
  },

  async disconnect() {
    await closeActiveConnection();
    return { success: true };
  }
};

module.exports = DbService;
