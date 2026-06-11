# DbVisualizerLite

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/tiancj0109/DbVisualizerLite)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%207%2F10%2F11-lightgrey.svg)](https://github.com/tiancj0109/DbVisualizerLite)
[![Electron](https://img.shields.io/badge/Electron-22.3.27-9FEAF9.svg)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB.svg)](https://reactjs.org/)

**一款专为 Windows 平台设计的轻量级、跨数据库可视化管理工具。**

---

## 项目概述

DbVisualizerLite 是基于 Electron 与 React 构建的现代化桌面应用程序，旨在为开发者和数据库管理员提供高效、直观的多数据库管理体验。通过统一的用户界面，用户可以无缝连接并管理 MySQL、PostgreSQL、SQLite 及 Microsoft SQL Server 数据库实例。

### 核心优势

- **统一接口** — 单一应用程序管理多种数据库系统，无需安装多个专用客户端
- **轻量架构** — 基于 Vite 构建，启动迅速，资源占用低
- **原生体验** — Electron 框架确保与 Windows 系统的深度集成
- **现代设计** — React 组件化架构，界面清晰，交互流畅

---

## 功能矩阵

| 功能模块 | 描述 |
|----------|------|
| **连接管理** | 支持多数据库类型连接配置，参数化管理连接凭据 |
| **数据库浏览** | 层级展示数据库结构，表、字段、索引一目了然 |
| **SQL 编辑器** | 独立查询编辑区，支持复杂 SQL 语句执行与结果即时反馈 |
| **数据可视化** | 表格化展示查询结果，支持大规模数据浏览 |
| **便携部署** | 提供安装版与便携版两种分发形式，满足不同使用场景 |

---

## 支持的数据库引擎

| 引擎 | 驱动 | 版本支持 | 默认端口 |
|------|------|----------|----------|
| **MySQL** | `mysql2` | 5.7+ / 8.0+ | 3306 |
| **PostgreSQL** | `pg` | 12+ | 5432 |
| **SQLite** | `sql.js` | 3.x | — |
| **Microsoft SQL Server** | `tedious` | 2012+ | 1433 |

---

## 系统要求

| 项目 | 要求 |
|------|------|
| **操作系统** | Microsoft Windows 7, 10, 11 |
| **架构** | x64 (64-bit) |
| **运行时** | 无需预安装，打包版本自带运行环境 |

---

## 安装指南

### 方式一：使用预构建版本

从 [Releases](https://github.com/tiancj0109/DbVisualizerLite/releases) 页面下载最新版本：

- `DbVisualizerLite-Setup-{version}.exe` — 安装版，支持自定义安装路径
- `DbVisualizerLite-{version}-Portable.exe` — 便携版，无需安装

### 方式二：从源码构建

```bash
# 克隆仓库
git clone https://github.com/tiancj0109/DbVisualizerLite.git

# 进入项目目录
cd DbVisualizerLite

# 安装依赖
npm install

# 开发模式运行
npm run dev         # 启动 Vite 开发服务器
npm run electron:dev # 启动 Electron 应用

# 构建生产版本
npm run package
```

构建产物将生成于 `dist-electron/` 目录。

---

## 项目架构

```
DbVisualizerLite/
├── main.js                    # Electron 主进程入口
├── preload.js                 # 渲染进程与主进程通信桥接
├── dbService.js               # 数据库操作抽象层
├── src/                       # React 前端源码
│   ├── App.jsx                # 应用根组件
│   ├── main.jsx               # React 入口
│   ├── index.css              # 全局样式
│   └── components/            # 功能组件
│       ├── ConnectionModal.jsx    # 数据库连接配置界面
│       ├── DbExplorer.jsx         # 数据库结构浏览器
│       ├── Sidebar.jsx            # 导航侧边栏
│       ├── SqlEditor.jsx          # SQL 语句编辑器
│       └── TableViewer.jsx        # 查询结果表格展示
├── index.html                 # HTML 入口模板
├── vite.config.js             # Vite 构建配置
└── package.json               # 项目元数据与依赖声明
```

---

## 技术栈详述

### 前端框架

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3.1 | UI 组件化架构 |
| Vite | 5.4.2 | 构建工具链 |
| Lucide React | 0.436.0 | 图标系统 |

### 桌面框架

| 技术 | 版本 | 用途 |
|------|------|------|
| Electron | 22.3.27 | 桌面应用容器 |
| Electron Builder | 24.13.3 | 应用打包分发 |

### 数据库驱动

| 驱动 | 版本 | 适用数据库 |
|------|------|------------|
| mysql2 | 3.11.0 | MySQL |
| pg | 8.12.0 | PostgreSQL |
| sql.js | 1.14.1 | SQLite (纯 JavaScript 实现) |
| tedious | 18.4.0 | Microsoft SQL Server |

---

## 开发路线

- [ ] 多连接会话管理
- [ ] SQL 语法高亮与自动补全
- [ ] 查询历史记录
- [ ] 数据导出功能 (CSV, JSON, SQL)
- [ ] 表结构可视化编辑
- [ ] 深色模式支持
- [ ] 国际化 (i18n)

---

## 贡献指南

欢迎参与项目开发。请遵循以下流程：

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'feat: add amazing feature'`)
4. 推送分支 (`git push origin feature/amazing-feature`)
5. 提交 Pull Request

---

## 许可证

本项目基于 [MIT License](LICENSE) 开源发布。

---

## 作者

**tiancj0109**

- GitHub: [@tiancj0109](https://github.com/tiancj0109)

---

*如有问题或建议，请通过 [Issues](https://github.com/tiancj0109/DbVisualizerLite/issues) 反馈。*