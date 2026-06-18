import React, { useState, useRef, useCallback } from 'react';
import { ChevronsUpDown } from 'lucide-react';

/**
 * 可调整宽度的表格表头组件
 * 支持拖拽调整列宽度
 */
export default function ResizableTableHeader({
  columns,
  columnWidths,
  onColumnWidthChange,
  onSort,
  sortBy,
  sortOrder,
  defaultWidth = 120,
  minWidth = 60,
  maxWidth = 400,
}) {
  const [resizing, setResizing] = useState(null);
  const tableRef = useRef(null);

  const handleMouseDown = useCallback((e, col) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = columnWidths[col] || defaultWidth;

    setResizing(col);

    const handleMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + diff));
      onColumnWidthChange(col, newWidth);
    };

    const handleMouseUp = () => {
      setResizing(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths, defaultWidth, minWidth, maxWidth, onColumnWidthChange]);

  return (
    <thead>
      <tr>
        {columns.map((col) => {
          const width = columnWidths[col] || defaultWidth;
          const isSorted = sortBy === col;
          const isResizingThis = resizing === col;
          const hasSort = onSort !== undefined && onSort !== null;

          return (
            <th
              key={col}
              className={`sortable-header ${isResizingThis ? 'resizing' : ''} ${!hasSort ? 'no-sort' : ''}`}
              style={{ width: `${width}px`, minWidth: `${width}px` }}
              title={col}
            >
              <div
                className="header-content"
                onClick={() => hasSort && onSort(col)}
              >
                <span className="header-text">{col}</span>
                {hasSort && (
                  isSorted ? (
                    <span className="sort-indicator" style={{ color: 'var(--accent-color)', fontSize: '10px' }}>
                      {sortOrder === 'asc' ? '▲' : '▼'}
                    </span>
                  ) : (
                    <ChevronsUpDown size={11} style={{ color: 'var(--text-dark)' }} />
                  )
                )}
              </div>

              {/* 拖拽调整宽度的手柄 */}
              <div
                className={`resize-handle ${isResizingThis ? 'active' : ''}`}
                onMouseDown={(e) => handleMouseDown(e, col)}
              />
            </th>
          );
        })}
      </tr>
    </thead>
  );
}