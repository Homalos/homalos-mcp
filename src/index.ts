const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  TextContent,
  Tool,
} = require('@modelcontextprotocol/sdk/types.js');
const { FuturesClient } = require('./futures-client');
const { WebSocketServer } = require('./websocket-server');

const client = new FuturesClient();

interface GetFuturesKlineInput {
  symbol: string;
}

interface CalculateKDIndicatorInput {
  symbol: string;
}

interface ManageCacheInput {
  action: 'clear' | 'clear_symbol' | 'stats';
  symbol?: string;
}

interface QueryHistoryInput {
  symbol: string;
  startDate?: string;
  endDate?: string;
}

interface ManageDatabaseInput {
  action: 'stats' | 'clear' | 'clear_symbol';
  symbol?: string;
}

interface CalculateMACDIndicatorInput {
  symbol: string;
}

interface QueryMACDHistoryInput {
  symbol: string;
  startDate?: string;
  endDate?: string;
}

// 定义工具
const tools: Tool[] = [
  {
    name: 'get_futures_kline',
    description: 'Get the latest 5 trading days minute-level K-line data for a futures contract. Returns formatted K-line data with time, price, volume, and open interest information.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Futures contract code (e.g., MA2601, IF2512)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'calculate_kd_indicator',
    description: 'Calculate KD indicator for a futures contract based on the latest 5 trading days minute-level K-line data. Parameters: N=21, M1=13, M2=34. Returns KD values with date and time for each minute.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Futures contract code (e.g., MA2601, IF2512)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'manage_cache',
    description: 'Manage the futures data cache. Actions: clear (clear all cache), clear_symbol (clear cache for specific symbol), stats (get cache statistics).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'Cache action: clear, clear_symbol, or stats',
          enum: ['clear', 'clear_symbol', 'stats'],
        },
        symbol: {
          type: 'string',
          description: 'Futures contract code (required for clear_symbol action)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'query_kline_history',
    description: 'Query historical K-line data from the database. Returns K-line data for a specific symbol and optional date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Futures contract code (e.g., MA2601, IF2512)',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (optional)',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (optional)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'query_kd_history',
    description: 'Query historical KD indicator data from the database. Returns KD values for a specific symbol and optional date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Futures contract code (e.g., MA2601, IF2512)',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (optional)',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (optional)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'manage_database',
    description: 'Manage the futures data database. Actions: stats (get database statistics), clear (clear all data), clear_symbol (clear data for specific symbol).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        action: {
          type: 'string',
          description: 'Database action: stats, clear, or clear_symbol',
          enum: ['stats', 'clear', 'clear_symbol'],
        },
        symbol: {
          type: 'string',
          description: 'Futures contract code (required for clear_symbol action)',
        },
      },
      required: ['action'],
    },
  },
  {
    name: 'calculate_macd_indicator',
    description: 'Calculate MACD indicator for a futures contract based on the latest 5 trading days minute-level K-line data. Parameters: fast=28, slow=177, signal=9. Returns MACD, Signal, and Histogram values for each minute.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Futures contract code (e.g., MA2601, IF2512)',
        },
      },
      required: ['symbol'],
    },
  },
  {
    name: 'query_macd_history',
    description: 'Query historical MACD indicator data from the database. Returns MACD values for a specific symbol and optional date range.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        symbol: {
          type: 'string',
          description: 'Futures contract code (e.g., MA2601, IF2512)',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (optional)',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (optional)',
        },
      },
      required: ['symbol'],
    },
  },
];

async function processToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  if (name === 'get_futures_kline') {
    const input = args as unknown as GetFuturesKlineInput;

    if (!input.symbol || typeof input.symbol !== 'string') {
      throw new Error('symbol parameter is required and must be a string');
    }

    const result = await client.fetchKlineData(input.symbol);
    return JSON.stringify(result, null, 2);
  }

  if (name === 'calculate_kd_indicator') {
    const input = args as unknown as CalculateKDIndicatorInput;

    if (!input.symbol || typeof input.symbol !== 'string') {
      throw new Error('symbol parameter is required and must be a string');
    }

    const result = await client.calculateKDIndicator(input.symbol);
    return JSON.stringify(result, null, 2);
  }

  if (name === 'manage_cache') {
    const input = args as unknown as ManageCacheInput;

    if (!input.action || typeof input.action !== 'string') {
      throw new Error('action parameter is required and must be a string');
    }

    if (input.action === 'clear') {
      client.clearCache();
      return JSON.stringify({
        success: true,
        message: 'All cache cleared'
      }, null, 2);
    }

    if (input.action === 'clear_symbol') {
      if (!input.symbol || typeof input.symbol !== 'string') {
        throw new Error('symbol parameter is required for clear_symbol action');
      }
      const deleted = client.clearCacheForSymbol(input.symbol);
      return JSON.stringify({
        success: true,
        message: deleted ? `Cache cleared for ${input.symbol}` : `No cache found for ${input.symbol}`
      }, null, 2);
    }

    if (input.action === 'stats') {
      const stats = client.getCacheStats();
      return JSON.stringify({
        success: true,
        cache: stats
      }, null, 2);
    }

    throw new Error(`Unknown action: ${input.action}`);
  }

  if (name === 'query_kline_history') {
    const input = args as unknown as QueryHistoryInput;

    if (!input.symbol || typeof input.symbol !== 'string') {
      throw new Error('symbol parameter is required');
    }

    const result = client.queryKlineHistory(input.symbol, input.startDate, input.endDate);
    return JSON.stringify({
      symbol: input.symbol,
      startDate: input.startDate,
      endDate: input.endDate,
      count: result.length,
      data: result
    }, null, 2);
  }

  if (name === 'query_kd_history') {
    const input = args as unknown as QueryHistoryInput;

    if (!input.symbol || typeof input.symbol !== 'string') {
      throw new Error('symbol parameter is required');
    }

    const result = client.queryKDHistory(input.symbol, input.startDate, input.endDate);
    return JSON.stringify({
      symbol: input.symbol,
      startDate: input.startDate,
      endDate: input.endDate,
      count: result.length,
      data: result
    }, null, 2);
  }

  if (name === 'manage_database') {
    const input = args as unknown as ManageDatabaseInput;

    if (!input.action || typeof input.action !== 'string') {
      throw new Error('action parameter is required');
    }

    if (input.action === 'stats') {
      const stats = client.getDatabaseStats();
      return JSON.stringify({
        success: true,
        database: stats
      }, null, 2);
    }

    if (input.action === 'clear') {
      client.clearDatabaseData();
      return JSON.stringify({
        success: true,
        message: 'All database data cleared'
      }, null, 2);
    }

    if (input.action === 'clear_symbol') {
      if (!input.symbol || typeof input.symbol !== 'string') {
        throw new Error('symbol parameter is required for clear_symbol action');
      }
      client.clearDatabaseSymbolData(input.symbol);
      return JSON.stringify({
        success: true,
        message: `Database data cleared for ${input.symbol}`
      }, null, 2);
    }

    throw new Error(`Unknown action: ${input.action}`);
  }

  if (name === 'calculate_macd_indicator') {
    const input = args as unknown as CalculateMACDIndicatorInput;

    if (!input.symbol || typeof input.symbol !== 'string') {
      throw new Error('symbol parameter is required and must be a string');
    }

    const result = await client.calculateMACDIndicator(input.symbol);
    return JSON.stringify(result, null, 2);
  }

  if (name === 'query_macd_history') {
    const input = args as unknown as QueryMACDHistoryInput;

    if (!input.symbol || typeof input.symbol !== 'string') {
      throw new Error('symbol parameter is required');
    }

    const result = client.queryMACDHistory(input.symbol, input.startDate, input.endDate);
    return JSON.stringify({
      symbol: input.symbol,
      startDate: input.startDate,
      endDate: input.endDate,
      count: result.length,
      data: result
    }, null, 2);
  }

  throw new Error(`Unknown tool: ${name}`);
}

async function main() {
  // 启动WebSocket服务器
  const wsServer = new WebSocketServer(8080, client);

  const transport = new StdioServerTransport();
  const server = new Server(
    {
      name: 'homalos-futures-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // 处理工具列表请求
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // 处理工具调用请求
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await processToolCall(
        request.params.name,
        request.params.arguments as Record<string, unknown>
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: result,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  });

  await server.connect(transport);
  console.error('Futures MCP server running on stdio');
  console.error('WebSocket server running on ws://localhost:8080');

  // 处理进程终止
  process.on('SIGINT', () => {
    console.error('Shutting down servers...');
    wsServer.stop();
    process.exit(0);
  });
}

main().catch(console.error);
