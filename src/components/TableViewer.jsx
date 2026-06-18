import React, { useState, useEffect } from 'react';
import {
  Play, RefreshCw, Filter, Download, Upload, Plus, Trash,
  ChevronLeft, ChevronRight, ChevronDown, ChevronsUpDown
} from 'lucide-react';
import ResizableTableHeader from './ResizableTableHeader';
import CopyableCell from './CopyableCell';

export default function TableViewer({ tableName, onOpenQuery }) {
  const [activeTab, setActiveTab] = useState('data'); // 'data' or 'schema'
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [columns, setColumns] = useState([]);
  const [schema, setSchema] = useState([]);
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  
  // Sorting State
  const [sortBy, setSortBy] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc'
  
  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState([]); // Array of { column, operator, value }

  // Column Width State
  const [columnWidths, setColumnWidths] = useState({});

  const handleColumnWidthChange = (col, width) => {
    setColumnWidths(prev => ({
      ...prev,
      [col]: width
    }));
  };

  useEffect(() => {
    // Reset state on table change
    setPage(1);
    setSortBy(null);
    setSortOrder('asc');
    setFilters([]);
    setShowFilters(false);
    setColumnWidths({}); // Reset column widths when table changes
    fetchSchemaAndData();
  }, [tableName]);

  useEffect(() => {
    fetchTableData();
  }, [page, pageSize, sortBy, sortOrder]);

  const fetchSchemaAndData = async () => {
    setLoading(true);
    try {
      const sch = await window.electronAPI.getTableSchema(tableName);
      setSchema(sch);
      
      const cols = sch.map(s => s.column);
      setColumns(cols);

      await fetchTableData();
    } catch (err) {
      console.error(err);
      alert('加载架构失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTableData = async () => {
    if (!tableName) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.getTableData({
        tableName,
        page,
        pageSize,
        sortBy,
        sortOrder,
        filters
      });
      setRows(result.rows);
      setTotal(result.total);
    } catch (err) {
      console.error(err);
      alert('加载表数据失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const handleAddFilter = () => {
    if (columns.length > 0) {
      setFilters([...filters, { column: columns[0], operator: '=', value: '' }]);
    }
  };

  const handleRemoveFilter = (index) => {
    const nextFilters = filters.filter((_, i) => i !== index);
    setFilters(nextFilters);
  };

  const handleFilterChange = (index, field, val) => {
    const nextFilters = filters.map((f, i) => {
      if (i === index) {
        return { ...f, [field]: val };
      }
      return f;
    });
    setFilters(nextFilters);
  };

  const handleApplyFilters = () => {
    setPage(1);
    fetchTableData();
  };

  const handleClearFilters = () => {
    setFilters([]);
    setPage(1);
    // Directly fetch table data as state update will be async
    setTimeout(() => {
      fetchTableData();
    }, 0);
  };

  const handleImportCSV = async () => {
    try {
      const filePath = await window.electronAPI.showOpenImportDialog({ format: 'csv' });
      if (!filePath) return;
      
      setLoading(true);
      const res = await window.electronAPI.importTableData({ tableName, filePath });
      if (res.success) {
        alert(`成功导入 ${res.count} 条记录。`);
        fetchTableData();
      }
    } catch (err) {
      console.error(err);
      alert('导入失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const filePath = await window.electronAPI.showSaveExportDialog({ tableName, format });
      if (!filePath) return;
      
      setLoading(true);
      const res = await window.electronAPI.exportTableData({ tableName, filePath, format });
      if (res.success) {
        alert(`成功导出 ${res.count} 条数据到文件。`);
      }
    } catch (err) {
      console.error(err);
      alert('导出失败: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="table-viewer">
      {/* Top Menu / Tabs */}
      <div className="viewer-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="tab-group">
            <button 
              className={`tab-btn ${activeTab === 'data' ? 'active' : ''}`}
              onClick={() => setActiveTab('data')}
            >
              表数据
            </button>
            <button 
              className={`tab-btn ${activeTab === 'schema' ? 'active' : ''}`}
              onClick={() => setActiveTab('schema')}
            >
              表结构
            </button>
          </div>
          
          <button 
            className="btn btn-secondary btn-sm text-accent" 
            onClick={() => onOpenQuery(`SELECT * FROM \`${tableName}\` LIMIT 100;`)}
            title="在 SQL console 中打开本表查询"
          >
            <Play size={12} />
            在 SQL 查询中打开
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary btn-sm" onClick={fetchSchemaAndData} title="刷新表格数据">
            <RefreshCw size={13} />
            刷新
          </button>
          <button 
            className={`btn btn-secondary btn-sm ${showFilters ? 'btn-active' : ''}`} 
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={13} />
            筛选条件 {filters.length > 0 && `(${filters.length})`}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handleImportCSV} title="将 CSV 数据导入到当前数据表">
            <Upload size={13} />
            导入 CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('csv')} title="导出表数据为 CSV 文件">
            <Download size={13} />
            导出 CSV
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => handleExport('json')} title="导出表数据为 JSON 文件">
            <Download size={13} />
            导出 JSON
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="filter-panel">
          <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-light)', marginBottom: '12px' }}>
            数据过滤查询
          </div>
          {filters.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text-dark)', marginBottom: '12px' }}>
              暂未添加过滤条件。点击下方按钮添加条件开始筛选。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
              {filters.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <select 
                    value={f.column} 
                    onChange={e => handleFilterChange(idx, 'column', e.target.value)}
                    style={{ flex: 2, height: '34px', fontSize: '13px' }}
                  >
                    {columns.map(col => (
                      <option key={col} value={col}>{col}</option>
                    ))}
                  </select>
                  
                  <select 
                    value={f.operator} 
                    onChange={e => handleFilterChange(idx, 'operator', e.target.value)}
                    style={{ flex: 1, height: '34px', fontSize: '13px', minWidth: '80px' }}
                  >
                    <option value="=">=</option>
                    <option value="!=">&lt;&gt;</option>
                    <option value=">">&gt;</option>
                    <option value="<">&lt;</option>
                    <option value=">=">&gt;=</option>
                    <option value="<=">&lt;=</option>
                    <option value="like">包含 (like)</option>
                  </select>
 
                  <input 
                    type="text" 
                    placeholder="值..." 
                    value={f.value} 
                    onChange={e => handleFilterChange(idx, 'value', e.target.value)}
                    style={{ flex: 3, height: '34px', fontSize: '13px', padding: '0 10px' }}
                  />
 
                  <button className="icon-btn delete" onClick={() => handleRemoveFilter(idx)} title="删除条件">
                    <Trash size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleAddFilter}>
              <Plus size={12} />
              添加过滤条件
            </button>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
                清空
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleApplyFilters}>
                应用过滤
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="viewer-grid-container">
        {activeTab === 'data' ? (
          <>
            {loading && rows.length === 0 ? (
              <div className="loading-state">
                <RefreshCw size={24} className="spin text-accent" />
                <span>正在加载表数据...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="loading-state">
                <span style={{ fontSize: '15px', fontWeight: 600 }}>未找到数据</span>
                <span style={{ color: 'var(--text-dark)', fontSize: '12px', marginTop: '4px' }}>
                  当前数据表在对应筛选条件下无任何记录。
                </span>
              </div>
            ) : (
              <div className="table-wrapper">
                <table>
                  <ResizableTableHeader
                    columns={columns}
                    columnWidths={columnWidths}
                    onColumnWidthChange={handleColumnWidthChange}
                    onSort={handleSort}
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                  />
                  <tbody>
                    {rows.map((row, idx) => (
                      <tr key={idx}>
                        {columns.map(col => (
                          <CopyableCell
                            key={col}
                            value={row[col]}
                            column={col}
                          />
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          /* Schema Tab */
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>字段名称 (Field)</th>
                  <th>数据类型 (Type)</th>
                  <th>允许为空 (Nullable)</th>
                  <th>主键 (Key)</th>
                  <th>默认值 (Default)</th>
                </tr>
              </thead>
              <tbody>
                {schema.map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{s.column}</td>
                    <td><span className="badge badge-notnull" style={{ fontFamily: 'monospace' }}>{s.type}</span></td>
                    <td>
                      {s.nullable === 'YES' || s.nullable === 'yes' || s.nullable === true ? (
                        <span className="badge badge-null">YES</span>
                      ) : (
                        <span className="badge badge-notnull">NO</span>
                      )}
                    </td>
                    <td>
                      {s.key === 'PRI' || s.key === 'pri' || s.key === true ? (
                        <span className="badge badge-pk">PRI</span>
                      ) : (
                        <span style={{ color: 'var(--text-dark)' }}>-</span>
                      )}
                    </td>
                    <td>
                      {s.default === null || s.default === undefined ? (
                        <span className="badge badge-null">NULL</span>
                      ) : (
                        String(s.default)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination Footer (Only for Data Tab) */}
      {activeTab === 'data' && rows.length > 0 && (
        <div className="viewer-footer">
          <div style={{ color: 'var(--text-dark)', fontSize: '12px' }}>
            显示第 {Math.min(total, (page - 1) * pageSize + 1)} 到 {Math.min(total, page * pageSize)} 条，共 {total} 条记录
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span>每页显示</span>
              <select 
                value={pageSize} 
                onChange={e => { setPageSize(parseInt(e.target.value)); setPage(1); }}
                style={{ height: '24px', padding: '0 4px', fontSize: '12px' }}
              >
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
              <span>条</span>
            </div>

            <div className="pagination">
              <button 
                className="icon-btn" 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft size={16} />
              </button>
              
              <span style={{ fontSize: '12px', color: 'var(--text-light)' }}>
                第 {page} 页 / 共 {totalPages} 页
              </span>

              <button 
                className="icon-btn" 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
