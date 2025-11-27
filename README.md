# Homalos Futures MCP Server

一个完整的期货数据分析MCP服务，集成了K线数据获取、技术指标计算、实时数据推送、数据持久化等功能。

## 功能特性

### 核心功能
- **实时期货数据**：从新浪财经API获取期货K线数据
- **标准化格式**：将原始JSONP数据转换为统一的JSON格式
- **灵活的合约参数**：支持任意期货合约代码（如MA2601、IF2512等）
- **完整的K线信息**：包含时间、价格、成交量、持仓量等数据
- **KD指标计算**：基于最近5个交易日的分钟级K线数据计算KD指标（N=21, M1=13, M2=34）

### 高级功能
- **智能缓存机制**：30秒TTL、最多100个合约、自动过期清理、手动管理接口
- **数据持久化**：SQLite数据库存储K线和KD指标数据，支持历史查询
- **WebSocket实时推送**：独立服务器（端口8080），支持K线和KD指标实时推送
- **多客户端支持**：支持无限数量的并发WebSocket连接
- **多工具支持**：提供6个MCP工具，支持数据获取、计算、查询和管理

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 使用

### 启动MCP服务器

```bash
npm start
```

或使用TypeScript直接运行（开发模式）：

```bash
npm run dev
```

启动后会同时运行：
- **MCP服务器**: 标准输入/输出（用于MCP客户端）
- **WebSocket服务器**: `ws://localhost:8080`（用于实时推送）

## WebSocket实时推送

### 快速示例

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  // 订阅K线数据
  ws.send(JSON.stringify({
    type: 'subscribe',
    symbol: 'MA2601',
    dataType: 'kline'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('收到数据:', message);
};
```

### 消息格式

**订阅请求**:
```json
{
  "type": "subscribe",
  "symbol": "MA2601",
  "dataType": "kline"
}
```

**数据推送**:
```json
{
  "type": "data",
  "dataType": "kline",
  "symbol": "MA2601",
  "data": { ... }
}
```

详见 [WEBSOCKET_GUIDE.md](WEBSOCKET_GUIDE.md)

## 数据持久化

所有K线和KD指标数据自动保存到SQLite数据库（`futures-data.db`），支持：
- 历史数据查询
- 日期范围查询
- 数据统计

使用MCP工具 `query_kline_history` 和 `query_kd_history` 查询历史数据。

### MCP工具定义

#### `get_futures_kline`

获取期货K线数据

**参数：**
- `symbol` (string, required): 期货合约代码，例如 `MA2601`、`IF2512`

**返回格式：**

```json
{
  "symbol": "MA2601",
  "tradingDays": [
    {
      "date": "2025-11-20",
      "klines": [
        {
          "time": "21:00",
          "open": 2008.0,
          "high": 2009.0,
          "low": 2013.0,
          "close": 2008.0,
          "volume": 26558,
          "openInterest": 1447290
        }
      ]
    }
  ]
}
```

#### `calculate_kd_indicator`

计算期货合约的KD指标

**参数：**
- `symbol` (string, required): 期货合约代码，例如 `MA2601`、`IF2512`

**指标参数：**
- N=21: 最高最低价的周期
- M1=13: K值的平滑周期
- M2=34: D值的平滑周期

**返回格式：**

```json
{
  "symbol": "MA2601",
  "parameters": {
    "n": 21,
    "m1": 13,
    "m2": 34
  },
  "kdValues": [
    {
      "date": "2025-11-20",
      "time": "21:00",
      "k": 59.62,
      "d": 50.28
    },
    {
      "date": "2025-11-20",
      "time": "21:01",
      "k": 55.03,
      "d": 50.42
    }
  ]
}
```

#### `manage_cache`

管理期货数据缓存

**参数：**
- `action` (string, required): 缓存操作，可选值: `clear`、`clear_symbol`、`stats`
- `symbol` (string, optional): 期货合约代码（`clear_symbol` 操作时必需）

**操作说明：**
- `stats`: 获取缓存统计信息
- `clear`: 清除所有缓存
- `clear_symbol`: 清除指定合约的缓存

**缓存配置：**
- TTL: 30秒
- 最大容量: 100个合约
- 自动清理: 过期项自动清理

**返回格式：**

```json
{
  "success": true,
  "cache": {
    "size": 1,
    "maxSize": 100,
    "entries": [
      {
        "key": "MA2601",
        "age": 5000,
        "ttl": 30000
      }
    ]
  }
}
```

#### `query_kline_history`

查询K线历史数据

**参数：**
- `symbol` (string, required): 期货合约代码
- `startDate` (string, optional): 开始日期（YYYY-MM-DD格式）
- `endDate` (string, optional): 结束日期（YYYY-MM-DD格式）

**返回格式：**

```json
{
  "symbol": "MA2601",
  "startDate": "2025-11-20",
  "endDate": "2025-11-26",
  "count": 1480,
  "data": [...]
}
```

#### `query_kd_history`

查询KD指标历史数据

**参数：**
- `symbol` (string, required): 期货合约代码
- `startDate` (string, optional): 开始日期（YYYY-MM-DD格式）
- `endDate` (string, optional): 结束日期（YYYY-MM-DD格式）

**返回格式：**

```json
{
  "symbol": "MA2601",
  "startDate": "2025-11-20",
  "endDate": "2025-11-26",
  "count": 1480,
  "data": [...]
}
```

#### `manage_database`

管理数据库

**参数：**
- `action` (string, required): 数据库操作，可选值: `stats`、`clear`、`clear_symbol`
- `symbol` (string, optional): 期货合约代码（`clear_symbol` 操作时必需）

**操作说明：**
- `stats`: 获取数据库统计信息
- `clear`: 清除所有数据
- `clear_symbol`: 清除指定合约的数据

**返回格式：**

```json
{
  "success": true,
  "database": {
    "klineCount": 1480,
    "kdCount": 1480,
    "symbols": ["MA2601"],
    "dbPath": "futures-data.db"
  }
}
```

### 示例调用

使用MCP客户端调用：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_futures_kline",
    "arguments": {
      "symbol": "MA2601"
    }
  }
}
```

## 数据说明

### 交易日期

- 期货交易日与真实日期不同
- 交易日从前一天21:00开始，到当天15:00结束
- 例如：交易日2025-11-26的数据从2025-11-25 21:00开始到2025-11-26 15:00结束

### K线数据字段

| 字段 | 说明 | 类型 |
|------|------|------|
| time | 交易时间（HH:MM格式） | string |
| open | 开盘价 | number |
| high | 最高价 | number |
| low | 最低价 | number |
| close | 收盘价 | number |
| volume | 成交量 | number |
| openInterest | 持仓量 | number |

## 项目结构

```
src/
├── index.ts              # MCP服务器主文件
├── websocket-server.ts   # WebSocket服务器 ✨ 新增
├── futures-client.ts     # 期货API客户端
├── database.ts           # 数据库管理器
├── cache-manager.ts      # 缓存管理器
└── types.ts             # TypeScript类型定义

dist/                    # 编译后的JavaScript文件
futures-data.db          # SQLite数据库（运行时生成）
```

## 技术栈

- **Node.js**: 运行时环境
- **TypeScript**: 编程语言
- **MCP SDK**: Model Context Protocol实现
- **WebSocket (ws)**: 实时数据推送
- **SQLite (better-sqlite3)**: 数据持久化
- **HTTPS**: 与新浪财经API通信

## API数据源

数据来自新浪财经期货API：
```
https://stock2.finance.sina.com.cn/futures/api/jsonp.php
```

## 错误处理

服务器会返回详细的错误信息，包括：
- 网络连接错误
- API响应错误
- 数据解析错误
- 参数验证错误

## 文档

- [Windsurf集成指南](WINDSURF_INTEGRATION.md) - ⭐ **在Windsurf IDE中使用本服务**
- [快速开始指南](QUICK_START.md) - 5分钟快速上手
- [详细使用指南](USAGE.md) - 完整的功能说明

## 测试

运行WebSocket测试客户端：

```bash
node test-websocket.js
```

## 项目状态

✅ **完成** - 所有功能已实现并通过验证

### 功能清单
- ✅ K线数据获取
- ✅ KD指标计算
- ✅ 缓存管理
- ✅ 数据持久化
- ✅ WebSocket实时推送
- ✅ 多客户端支持
- ✅ 完整文档

## 许可证

ISC
