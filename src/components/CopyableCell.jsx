import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * 可复制的表格单元格组件
 * 鼠标悬停时显示复制按钮
 */
export default function CopyableCell({ value, column, className = '' }) {
  const [isHovered, setIsHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const displayValue = value === null || value === undefined
    ? 'NULL'
    : String(value);

  const isNull = value === null || value === undefined;

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(displayValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('复制失败:', err);
    }
  };

  return (
    <td
      className={`${className} ${isHovered ? 'cell-hover' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={displayValue}
    >
      <div className="cell-content-wrapper">
        {isNull ? (
          <span className="badge badge-null">NULL</span>
        ) : (
          <span className="cell-text">{displayValue}</span>
        )}

        {isHovered && (
          <button
            className={`copy-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? '已复制!' : '复制内容'}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        )}
      </div>
    </td>
  );
}