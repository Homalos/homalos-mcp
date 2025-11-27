# 期货K线MCP服务使用指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 构建项目

```bash
npm run build
```

### 3. 启动MCP服务器

```bash
npm start
```

服务器将在标准输入/输出上运行，等待MCP客户端连接。同时WebSocket服务器会在 `ws://localhost:8080` 启动。

## WebSocket实时推送

### 连接WebSocket服务器

```javascript
const ws = new WebSocket('ws://localhost:8080');

ws.onopen = () => {
  console.log('已连接到WebSocket服务器');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('收到数据:', message);
};

ws.onerror = (error) => {
  console.error('WebSocket错误:', error);
};

ws.onclose = () => {
  console.log('连接已关闭');
};
```

### 订阅K线数据

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  symbol: 'MA2601',
  dataType: 'kline'
}));
```

### 订阅KD指标数据

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  symbol: 'MA2601',
  dataType: 'kd'
}));
```

### 订阅MACD指标数据

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  symbol: 'MA2601',
  dataType: 'macd'
}));
```

### 取消订阅

```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  symbol: 'MA2601',
  dataType: 'kline'
}));
```

### 心跳检测

```javascript
ws.send(JSON.stringify({
  type: 'ping'
}));
```

### WebSocket消息格式

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
  "data": {
    "symbol": "MA2601",
    "tradingDays": [...]
  }
}
```

**错误消息**:
```json
{
  "type": "error",
  "message": "错误描述信息"
}
```

### 推送机制

- 推送间隔: 5秒
- 数据变化检测: 仅当数据发生变化时推送
- 多客户端支持: 支持多个客户端同时订阅同一合约
- 自动缓存: 使用内存缓存加速数据获取

## MCP工具调用

### 工具1: get_futures_kline

**功能**: 获取指定期货合约最近5个交易日的分钟级K线数据

**参数**:

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| symbol | string | 是 | 期货合约代码 | MA2601, IF2512, IC2512 |

**请求示例**:

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

### 工具2: calculate_kd_indicator

**功能**: 计算指定期货合约的KD指标（基于最近5个交易日的分钟级K线数据）

**参数说明**:
- N=21: 最高最低价的周期
- M1=13: K值的平滑周期
- M2=34: D值的平滑周期

**参数**:

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| symbol | string | 是 | 期货合约代码 | MA2601, IF2512, IC2512 |

**请求示例**:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "calculate_kd_indicator",
    "arguments": {
      "symbol": "MA2601"
    }
  }
}
```

### 工具3: manage_cache

**功能**: 管理期货数据缓存

**参数**:

| 参数名 | 类型 | 必需 | 说明 | 可选值 |
|--------|------|------|------|--------|
| action | string | 是 | 缓存操作 | clear, clear_symbol, stats |
| symbol | string | 否 | 期货合约代码（clear_symbol时必需） | MA2601, IF2512 |

**请求示例**:

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "manage_cache",
    "arguments": {
      "action": "stats"
    }
  }
}
```

**清除特定合约缓存**:

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "manage_cache",
    "arguments": {
      "action": "clear_symbol",
      "symbol": "MA2601"
    }
  }
}
```

**清除所有缓存**:

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "manage_cache",
    "arguments": {
      "action": "clear"
    }
  }
}
```

### 工具7: calculate_macd_indicator

**功能**: 计算指定期货合约的MACD指标（基于最近5个交易日的分钟级K线数据）

**参数说明**:
- fast=28: 快速EMA周期
- slow=177: 慢速EMA周期
- signal=9: Signal线EMA周期

**参数**:

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| symbol | string | 是 | 期货合约代码 | MA2601, IF2512, IC2512 |

**请求示例**:

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "calculate_macd_indicator",
    "arguments": {
      "symbol": "MA2601"
    }
  }
}
```

### 工具8: query_macd_history

**功能**: 查询MACD指标历史数据

**参数**:

| 参数名 | 类型 | 必需 | 说明 | 示例 |
|--------|------|------|------|------|
| symbol | string | 是 | 期货合约代码 | MA2601, IF2512 |
| startDate | string | 否 | 开始日期（YYYY-MM-DD格式） | 2025-11-20 |
| endDate | string | 否 | 结束日期（YYYY-MM-DD格式） | 2025-11-26 |

**请求示例**:

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "query_macd_history",
    "arguments": {
      "symbol": "MA2601",
      "startDate": "2025-11-20",
      "endDate": "2025-11-26"
    }
  }
}
```

### get_futures_kline 响应示例

```json
{
  "symbol": "MA2601",
  "tradingDays": [
    {
      "date": "2025-11-21",
      "klines": [
        {
          "time": "21:00",
          "open": 2009,
          "high": 2012,
          "low": 2016,
          "close": 2009,
          "volume": 34147,
          "openInterest": 1425409
        }
      ]
    }
  ]
}
```

### calculate_kd_indicator 响应示例

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
      "date": "2025-11-21",
      "time": "21:00",
      "k": 59.62,
      "d": 50.28
    },
    {
      "date": "2025-11-21",
      "time": "21:01",
      "k": 55.03,
      "d": 50.42
    }
  ]
}
```

### 响应数据格式说明

**get_futures_kline 返回**:

| 字段 | 说明 |
|------|------|
| symbol | 期货合约代码 |
| tradingDays | 交易日数组 |
| tradingDays[].date | 交易日期 (YYYY-MM-DD) |
| tradingDays[].klines | 该交易日的K线数组 |
| klines[].time | 交易时间 (HH:MM) |
| klines[].open | 开盘价 |
| klines[].high | 最高价 |
| klines[].low | 最低价 |
| klines[].close | 收盘价 |
| klines[].volume | 成交量 |
| klines[].openInterest | 持仓量 |

**calculate_kd_indicator 返回**:

| 字段 | 说明 |
|------|------|
| symbol | 期货合约代码 |
| parameters | KD指标参数 (N, M1, M2) |
| kdValues | KD值数组 |
| kdValues[].date | 交易日期 (YYYY-MM-DD) |
| kdValues[].time | 交易时间 (HH:MM) |
| kdValues[].k | K值 |
| kdValues[].d | D值 |

### calculate_macd_indicator 响应示例

```json
{
  "symbol": "MA2601",
  "parameters": {
    "fast": 28,
    "slow": 177,
    "signal": 9
  },
  "macdValues": [
    {
      "date": "2025-11-21",
      "time": "21:00",
      "macd": -0.1234,
      "signal": -0.0856,
      "histogram": -0.0378
    },
    {
      "date": "2025-11-21",
      "time": "21:01",
      "macd": -0.1156,
      "signal": -0.0921,
      "histogram": -0.0235
    }
  ]
}
```

**calculate_macd_indicator 返回**:

| 字段 | 说明 |
|------|------|
| symbol | 期货合约代码 |
| parameters | MACD指标参数 (fast, slow, signal) |
| macdValues | MACD值数组 |
| macdValues[].date | 交易日期 (YYYY-MM-DD) |
| macdValues[].time | 交易时间 (HH:MM) |
| macdValues[].macd | MACD线值 |
| macdValues[].signal | Signal线值 |
| macdValues[].histogram | Histogram（柱状图）值 |

## 常见期货合约代码

| 合约 | 说明 |
|------|------|
| MA | 豆粕期货 |
| IF | 沪深300指数期货 |
| IC | 中证500指数期货 |
| IH | 上证50指数期货 |
| T | 10年期国债期货 |
| TF | 5年期国债期货 |

合约代码后面通常跟随年月，如 MA2601 表示2026年1月交割的豆粕期货。

## 错误处理

如果请求出错，服务器会返回包含 `isError: true` 的响应：

```json
{
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Error: Failed to fetch kline data for INVALID: ..."
      }
    ],
    "isError": true
  }
}
```

常见错误：
- **参数缺失**: symbol 参数未提供
- **网络错误**: 无法连接到新浪财经API
- **数据解析错误**: API返回的数据格式异常

## 开发模式

使用TypeScript直接运行（无需构建）：

```bash
npm run dev
```

## 项目结构

```
src/
├── index.ts              # MCP服务器主文件，定义工具和请求处理
├── futures-client.ts     # 期货API客户端，处理API调用和数据解析
└── types.ts             # TypeScript类型定义

dist/                    # 编译后的JavaScript文件
```

## 技术细节

### 数据源
- API: 新浪财经期货API
- 端点: `https://stock2.finance.sina.com.cn/futures/api/jsonp.php`
- 格式: JSONP

### 数据处理流程
1. 构建API URL（包含合约代码）
2. 发送HTTPS GET请求
3. 解析JSONP响应（提取三维数组）
4. 格式化为统一的JSON结构
5. 返回给MCP客户端

### 交易日期说明
- 期货交易日与真实日期不同
- 交易日从前一天21:00开始，到当天15:00结束
- 例如：交易日2025-11-26的数据从2025-11-25 21:00开始到2025-11-26 15:00结束

## 许可证

ISC
