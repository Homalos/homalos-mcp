# Windsurf集成指南

本指南说明如何在Windsurf IDE中集成并使用Homalos Futures MCP服务器。

## 前置要求

- Windsurf IDE已安装
- Node.js 18+ 已安装
- 项目已克隆到本地

## 步骤1: 启动MCP服务器

### 1.1 安装依赖

```bash
cd d:\Project\PycharmProjects\homalos-mcp
npm install
```

### 1.2 构建项目

```bash
npm run build
```

### 1.3 启动服务器

```bash
npm start
```

**输出示例**:
```
Futures MCP server running on stdio
WebSocket server running on ws://localhost:8080
```

> ⚠️ **重要**: 保持此终端窗口打开，MCP服务器需要持续运行

---

## 步骤2: 在Windsurf中配置MCP连接

### 2.1 打开Windsurf设置

1. 在Windsurf中打开设置（通常是 `Ctrl+,` 或 `Cmd+,`）
2. 搜索 "MCP" 或 "Model Context Protocol"
3. 找到 "MCP Servers" 配置项

### 2.2 添加MCP服务器

在MCP Servers配置中添加以下配置：

```json
{
  "mcpServers": {
    "homalos-futures": {
      "command": "node",
      "args": [
        "d:\\Project\\PycharmProjects\\homalos-mcp\\dist\\index.js"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

**配置说明**:
- `command`: 使用Node.js运行
- `args`: 指向编译后的MCP服务器文件
- `env`: 环境变量设置

### 2.3 重启Windsurf

保存配置后，重启Windsurf IDE使配置生效。

---

## 步骤3: 使用MCP工具

### 3.1 打开工具面板

在Windsurf中，通过以下方式访问MCP工具：

1. **侧边栏**: 查找 "Tools" 或 "MCP" 面板
2. **命令面板**: 按 `Ctrl+Shift+P`，搜索 "MCP" 相关命令
3. **AI对话**: 在AI对话中直接提及期货数据需求

### 3.2 可用工具列表

| 工具名 | 功能 | 参数 |
|--------|------|------|
| `get_futures_kline` | 获取K线数据 | symbol |
| `calculate_kd_indicator` | 计算KD指标 | symbol |
| `calculate_macd_indicator` | 计算MACD指标 | symbol |
| `query_kline_history` | 查询K线历史 | symbol, startDate, endDate |
| `query_kd_history` | 查询KD历史 | symbol, startDate, endDate |
| `query_macd_history` | 查询MACD历史 | symbol, startDate, endDate |
| `manage_cache` | 管理缓存 | action, symbol |
| `manage_database` | 管理数据库 | action, symbol |

### 3.3 在AI对话中使用

**示例1: 获取K线数据**

```
我需要获取MA2601的最新K线数据
```

Windsurf会自动调用 `get_futures_kline` 工具。

**示例2: 计算技术指标**

```
帮我计算MA2601的KD指标和MACD指标
```

Windsurf会调用 `calculate_kd_indicator` 和 `calculate_macd_indicator` 工具。

**示例3: 查询历史数据**

```
查询MA2601从2025-11-20到2025-11-26的K线历史数据
```

Windsurf会调用 `query_kline_history` 工具。

---

## 步骤4: WebSocket实时推送（可选）

如果需要实时数据推送，可以在Windsurf的扩展或脚本中连接WebSocket。

### 4.1 创建WebSocket客户端

在项目中创建 `windsurf-client.js`:

```javascript
import WebSocket from 'ws';

class WindsurfFuturesClient {
  constructor() {
    this.ws = null;
    this.subscriptions = new Set();
  }

  connect() {
    this.ws = new WebSocket('ws://localhost:8080');

    this.ws.on('open', () => {
      console.log('[Windsurf] 已连接到期货数据服务');
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[Windsurf] 消息解析错误:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('[Windsurf] WebSocket错误:', error);
    });

    this.ws.on('close', () => {
      console.log('[Windsurf] 连接已关闭');
    });
  }

  subscribe(symbol, dataType) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        symbol,
        dataType
      }));
      this.subscriptions.add(`${symbol}:${dataType}`);
      console.log(`[Windsurf] 已订阅 ${symbol} ${dataType} 数据`);
    }
  }

  unsubscribe(symbol, dataType) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'unsubscribe',
        symbol,
        dataType
      }));
      this.subscriptions.delete(`${symbol}:${dataType}`);
      console.log(`[Windsurf] 已取消订阅 ${symbol} ${dataType} 数据`);
    }
  }

  handleMessage(message) {
    if (message.type === 'data') {
      console.log(`[Windsurf] 收到${message.dataType}数据:`, {
        symbol: message.symbol,
        dataPoints: message.data?.kdValues?.length || 
                   message.data?.macdValues?.length ||
                   message.data?.tradingDays?.length || 0
      });
    } else if (message.type === 'error') {
      console.error(`[Windsurf] 错误:`, message.message);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default WindsurfFuturesClient;
```

### 4.2 在Windsurf中使用

```javascript
import WindsurfFuturesClient from './windsurf-client.js';

const client = new WindsurfFuturesClient();
client.connect();

// 订阅数据
client.subscribe('MA2601', 'kline');
client.subscribe('MA2601', 'kd');
client.subscribe('MA2601', 'macd');

// 10秒后断开连接
setTimeout(() => {
  client.disconnect();
}, 10000);
```

---

## 使用场景

### 场景1: 数据分析

```
我想分析MA2601在最近5个交易日的走势，
请获取K线数据、计算KD和MACD指标
```

**Windsurf会**:
1. 调用 `get_futures_kline` 获取K线数据
2. 调用 `calculate_kd_indicator` 计算KD指标
3. 调用 `calculate_macd_indicator` 计算MACD指标
4. 综合分析并提供建议

### 场景2: 历史数据查询

```
查询IF2512从2025-11-01到2025-11-26的所有历史K线数据
```

**Windsurf会**:
1. 调用 `query_kline_history` 获取历史数据
2. 返回指定日期范围内的所有K线数据
3. 支持进一步分析

### 场景3: 缓存管理

```
清除所有缓存的期货数据
```

**Windsurf会**:
1. 调用 `manage_cache` 工具
2. 执行 `clear` 操作
3. 返回清理结果

### 场景4: 数据库管理

```
获取数据库统计信息，告诉我存储了多少条数据
```

**Windsurf会**:
1. 调用 `manage_database` 工具
2. 执行 `stats` 操作
3. 返回数据库统计信息

---

## 故障排除

### 问题1: Windsurf无法连接到MCP服务器

**症状**: 工具列表为空或显示连接错误

**解决方案**:
1. 确保MCP服务器正在运行 (`npm start`)
2. 检查配置中的文件路径是否正确
3. 重启Windsurf IDE
4. 查看Windsurf的输出面板获取错误信息

### 问题2: 工具调用超时

**症状**: 调用工具时显示超时错误

**解决方案**:
1. 检查网络连接
2. 确保新浪财经API可访问
3. 检查MCP服务器日志
4. 尝试增加超时时间

### 问题3: 数据不更新

**症状**: 多次调用返回相同数据

**解决方案**:
1. 这是正常的缓存行为（30秒TTL）
2. 等待30秒后重试
3. 或使用 `manage_cache` 清除缓存

### 问题4: WebSocket连接失败

**症状**: WebSocket连接被拒绝

**解决方案**:
1. 确保MCP服务器正在运行
2. 检查端口8080是否被占用
3. 检查防火墙设置
4. 尝试手动连接: `ws://localhost:8080`

---

## 最佳实践

### 1. 合理使用缓存

- 同一个合约在30秒内的请求会使用缓存
- 避免频繁请求相同数据
- 需要最新数据时使用 `manage_cache` 清除缓存

### 2. 批量操作

- 一次性查询多个合约的数据
- 使用历史查询而不是多次调用实时接口

### 3. 错误处理

- 始终检查返回的错误信息
- 在脚本中添加重试逻辑
- 记录关键操作的日志

### 4. 性能优化

- 利用WebSocket实时推送而不是轮询
- 使用数据库查询历史数据
- 合理设置订阅的数据类型

---

## 高级配置

### 自定义MCP服务器路径

如果项目不在默认位置，修改配置:

```json
{
  "mcpServers": {
    "homalos-futures": {
      "command": "node",
      "args": [
        "/path/to/homalos-mcp/dist/index.js"
      ]
    }
  }
}
```

### 使用开发模式

在开发时，可以直接运行TypeScript:

```json
{
  "mcpServers": {
    "homalos-futures": {
      "command": "npx",
      "args": [
        "ts-node",
        "d:\\Project\\PycharmProjects\\homalos-mcp\\src\\index.ts"
      ]
    }
  }
}
```

### 环境变量配置

```json
{
  "mcpServers": {
    "homalos-futures": {
      "command": "node",
      "args": [
        "d:\\Project\\PycharmProjects\\homalos-mcp\\dist\\index.js"
      ],
      "env": {
        "NODE_ENV": "production",
        "DEBUG": "false",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

---

## 常见命令

### 启动服务器

```bash
npm start
```

### 开发模式

```bash
npm run dev
```

### 构建项目

```bash
npm run build
```

### 运行测试

```bash
node test-websocket.js
node test-macd.js
```

---

## 相关文档

- [README.md](README.md) - 项目主文档
- [USAGE.md](USAGE.md) - 详细使用指南
- [WEBSOCKET_GUIDE.md](WEBSOCKET_GUIDE.md) - WebSocket实时推送指南
- [MACD_IMPLEMENTATION.md](MACD_IMPLEMENTATION.md) - MACD指标实现
- [QUICK_START.md](QUICK_START.md) - 快速开始指南

---

## 支持

如有问题，请：

1. 查看错误日志
2. 检查文档
3. 查看示例代码
4. 运行测试脚本验证功能

---

**最后更新**: 2025-11-26  
**版本**: 1.0.0  
**状态**: ✅ 完成
