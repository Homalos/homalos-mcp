const { WebSocketServer: WSServer, WebSocket } = require('ws');
const { FuturesClient } = require('./futures-client');
const { FuturesResponse, KDResponse, MACDResponse } = require('./types');

interface Subscription {
  symbol: string;
  dataType: 'kline' | 'kd' | 'macd';
}

interface ClientData {
  ws: WebSocket;
  subscriptions: Set<string>; // 存储 "symbol:dataType" 格式的订阅
  lastKlineData: Map<string, FuturesResponse>; // 缓存最后一次的K线数据
  lastKDData: Map<string, KDResponse>; // 缓存最后一次的KD数据
  lastMACDData: Map<string, MACDResponse>; // 缓存最后一次的MACD数据
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping';
  symbol?: string;
  dataType?: 'kline' | 'kd' | 'macd';
}

interface DataMessage {
  type: 'data' | 'error' | 'pong';
  dataType?: 'kline' | 'kd' | 'macd';
  symbol?: string;
  data?: FuturesResponse | KDResponse | MACDResponse;
  message?: string;
}

export class WebSocketServer {
  private wss: WSServer;
  private clients: Map<WebSocket, ClientData> = new Map();
  private futuresClient: FuturesClient;
  private pushInterval: NodeJS.Timeout | null = null;
  private pushIntervalMs: number = 5000; // 5秒推送一次

  constructor(port: number, futuresClient: FuturesClient) {
    this.futuresClient = futuresClient;
    this.wss = new WSServer({ port });
    this.setupServer();
  }

  private setupServer(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      console.log('[WebSocket] 新客户端连接');

      const clientData: ClientData = {
        ws,
        subscriptions: new Set(),
        lastKlineData: new Map(),
        lastKDData: new Map(),
        lastMACDData: new Map(),
      };

      this.clients.set(ws, clientData);

      ws.on('message', (message: any) => {
        this.handleMessage(ws, message);
      });

      ws.on('close', () => {
        console.log('[WebSocket] 客户端断开连接');
        this.clients.delete(ws);
      });

      ws.on('error', (error: Error) => {
        console.error('[WebSocket] 错误:', error.message);
      });

      // 发送欢迎消息
      this.sendMessage(ws, {
        type: 'data',
        message: '连接成功，可以开始订阅数据',
      });
    });

    // 启动定时推送
    this.startPushLoop();

    console.log('[WebSocket] 服务器启动成功，监听端口 8080');
  }

  private handleMessage(ws: WebSocket, message: any): void {
    try {
      const msg = JSON.parse(message.toString()) as WebSocketMessage;

      if (msg.type === 'subscribe') {
        this.handleSubscribe(ws, msg);
      } else if (msg.type === 'unsubscribe') {
        this.handleUnsubscribe(ws, msg);
      } else if (msg.type === 'ping') {
        this.sendMessage(ws, { type: 'pong' });
      } else {
        this.sendMessage(ws, {
          type: 'error',
          message: `未知的消息类型: ${msg.type}`,
        });
      }
    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        message: `消息处理错误: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private handleSubscribe(ws: WebSocket, msg: WebSocketMessage): void {
    if (!msg.symbol || !msg.dataType) {
      this.sendMessage(ws, {
        type: 'error',
        message: '订阅失败: 缺少symbol或dataType参数',
      });
      return;
    }

    const clientData = this.clients.get(ws);
    if (!clientData) return;

    const subscriptionKey = `${msg.symbol}:${msg.dataType}`;
    clientData.subscriptions.add(subscriptionKey);

    console.log(`[WebSocket] 客户端订阅: ${subscriptionKey}`);

    this.sendMessage(ws, {
      type: 'data',
      message: `已订阅 ${msg.symbol} 的 ${msg.dataType} 数据`,
    });
  }

  private handleUnsubscribe(ws: WebSocket, msg: WebSocketMessage): void {
    if (!msg.symbol || !msg.dataType) {
      this.sendMessage(ws, {
        type: 'error',
        message: '取消订阅失败: 缺少symbol或dataType参数',
      });
      return;
    }

    const clientData = this.clients.get(ws);
    if (!clientData) return;

    const subscriptionKey = `${msg.symbol}:${msg.dataType}`;
    const deleted = clientData.subscriptions.delete(subscriptionKey);

    if (deleted) {
      console.log(`[WebSocket] 客户端取消订阅: ${subscriptionKey}`);
      this.sendMessage(ws, {
        type: 'data',
        message: `已取消订阅 ${msg.symbol} 的 ${msg.dataType} 数据`,
      });
    } else {
      this.sendMessage(ws, {
        type: 'error',
        message: `未找到订阅: ${subscriptionKey}`,
      });
    }
  }

  private startPushLoop(): void {
    this.pushInterval = setInterval(async () => {
      await this.pushDataToClients();
    }, this.pushIntervalMs);
  }

  private async pushDataToClients(): Promise<void> {
    for (const [ws, clientData] of this.clients.entries()) {
      if (ws.readyState !== 1) continue; // 1 = OPEN

      // 收集需要推送的数据
      const subscriptions = Array.from(clientData.subscriptions);

      for (const subscriptionKey of subscriptions) {
        const [symbol, dataType] = subscriptionKey.split(':');

        try {
          if (dataType === 'kline') {
            await this.pushKlineData(ws, clientData, symbol);
          } else if (dataType === 'kd') {
            await this.pushKDData(ws, clientData, symbol);
          } else if (dataType === 'macd') {
            await this.pushMACDData(ws, clientData, symbol);
          }
        } catch (error) {
          console.error(
            `[WebSocket] 推送数据失败 (${subscriptionKey}):`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }
    }
  }

  private async pushKlineData(
    ws: WebSocket,
    clientData: ClientData,
    symbol: string
  ): Promise<void> {
    try {
      const data = await this.futuresClient.fetchKlineData(symbol);

      // 检查数据是否发生变化
      const lastData = clientData.lastKlineData.get(symbol);
      if (lastData && JSON.stringify(lastData) === JSON.stringify(data)) {
        return; // 数据未变化，不推送
      }

      clientData.lastKlineData.set(symbol, data);

      this.sendMessage(ws, {
        type: 'data',
        dataType: 'kline',
        symbol,
        data,
      });
    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        message: `获取K线数据失败: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private async pushKDData(
    ws: WebSocket,
    clientData: ClientData,
    symbol: string
  ): Promise<void> {
    try {
      const data = await this.futuresClient.calculateKDIndicator(symbol);

      // 检查数据是否发生变化
      const lastData = clientData.lastKDData.get(symbol);
      if (lastData && JSON.stringify(lastData) === JSON.stringify(data)) {
        return; // 数据未变化，不推送
      }

      clientData.lastKDData.set(symbol, data);

      this.sendMessage(ws, {
        type: 'data',
        dataType: 'kd',
        symbol,
        data,
      });
    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        message: `获取KD数据失败: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private async pushMACDData(
    ws: WebSocket,
    clientData: ClientData,
    symbol: string
  ): Promise<void> {
    try {
      const data = await this.futuresClient.calculateMACDIndicator(symbol);

      // 检查数据是否发生变化
      const lastData = clientData.lastMACDData.get(symbol);
      if (lastData && JSON.stringify(lastData) === JSON.stringify(data)) {
        return; // 数据未变化，不推送
      }

      clientData.lastMACDData.set(symbol, data);

      this.sendMessage(ws, {
        type: 'data',
        dataType: 'macd',
        symbol,
        data,
      });
    } catch (error) {
      this.sendMessage(ws, {
        type: 'error',
        message: `获取MACD数据失败: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  private sendMessage(ws: WebSocket, message: DataMessage): void {
    if (ws.readyState === 1) { // 1 = OPEN
      ws.send(JSON.stringify(message));
    }
  }

  public stop(): void {
    if (this.pushInterval) {
      clearInterval(this.pushInterval);
    }
    this.wss.close(() => {
      console.log('[WebSocket] 服务器已关闭');
    });
  }

  public getStats(): {
    connectedClients: number;
    subscriptions: Array<{ symbol: string; dataType: string; clientCount: number }>;
  } {
    const subscriptionMap = new Map<
      string,
      number
    >();

    for (const clientData of this.clients.values()) {
      for (const sub of clientData.subscriptions) {
        subscriptionMap.set(sub, (subscriptionMap.get(sub) || 0) + 1);
      }
    }

    const subscriptions = Array.from(subscriptionMap.entries()).map(
      ([key, count]) => {
        const [symbol, dataType] = key.split(':');
        return { symbol, dataType, clientCount: count };
      }
    );

    return {
      connectedClients: this.clients.size,
      subscriptions,
    };
  }
}

module.exports = { WebSocketServer };
