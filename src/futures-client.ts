const https = require('https');
const { FuturesResponse, TradingDay, KlineData, RawKlineData, KDResponse, KDValue, MACDResponse, MACDValue } = require('./types');
const { CacheManager } = require('./cache-manager');
const { DatabaseManager } = require('./database');

class FuturesClient {
  private baseUrl = 'https://stock2.finance.sina.com.cn/futures/api/jsonp.php';
  private cacheManager: CacheManager<FuturesResponse>;
  private db: DatabaseManager;

  constructor() {
    // 初始化缓存管理器: 最多100个合约，30秒TTL
    this.cacheManager = new CacheManager<FuturesResponse>(100, 30);
    // 初始化数据库管理器
    this.db = new DatabaseManager();
  }

  /**
   * 获取期货K线数据（带缓存和持久化）
   */
  async fetchKlineData(symbol: string): Promise<FuturesResponse> {
    try {
      // 检查缓存
      const cachedData = this.cacheManager.get(symbol);
      if (cachedData) {
        return cachedData;
      }

      // 缓存未命中，请求API
      const rawData = await this.fetchFromApi(symbol);
      const parsedData = this.parseJsonp(rawData, symbol);
      const formatted = this.formatData(parsedData, symbol);

      // 存入缓存
      this.cacheManager.set(symbol, formatted);

      // 保存到数据库
      this.saveKlineDataToDatabase(formatted);

      return formatted;
    } catch (error) {
      throw new Error(`Failed to fetch kline data for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 保存K线数据到数据库
   */
  private saveKlineDataToDatabase(data: FuturesResponse): void {
    const klineRecords: Array<{
      symbol: string;
      date: string;
      time: string;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
      openInterest: number;
    }> = [];

    for (const tradingDay of data.tradingDays) {
      for (const kline of tradingDay.klines) {
        klineRecords.push({
          symbol: data.symbol,
          date: tradingDay.date,
          time: kline.time,
          open: kline.open,
          high: kline.high,
          low: kline.low,
          close: kline.close,
          volume: kline.volume,
          openInterest: kline.openInterest
        });
      }
    }

    if (klineRecords.length > 0) {
      this.db.saveKlineDataBatch(klineRecords);
    }
  }

  /**
   * 计算KD指标
   * 参数: N=21, M1=13, M2=34
   */
  async calculateKDIndicator(symbol: string, n: number = 21, m1: number = 13, m2: number = 34): Promise<KDResponse> {
    try {
      // 获取K线数据
      const futuresData = await this.fetchKlineData(symbol);
      
      // 合并所有交易日的K线数据
      const allKlines: Array<KlineData & { date: string }> = [];
      for (const tradingDay of futuresData.tradingDays) {
        for (const kline of tradingDay.klines) {
          allKlines.push({
            ...kline,
            date: tradingDay.date
          });
        }
      }

      // 计算KD指标
      const kdValues = this.computeKDIndicator(allKlines, n, m1, m2);

      // 保存到数据库
      this.saveKDDataToDatabase(symbol, kdValues);

      return {
        symbol,
        parameters: { n, m1, m2 },
        kdValues
      };
    } catch (error) {
      throw new Error(`Failed to calculate KD indicator for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 核心KD指标计算逻辑
   */
  private computeKDIndicator(klines: Array<KlineData & { date: string }>, n: number, m1: number, m2: number): KDValue[] {
    const kdValues: KDValue[] = [];
    let k = 50;  // 初始K值
    let d = 50;  // 初始D值

    for (let i = 0; i < klines.length; i++) {
      const kline = klines[i];

      // 计算N周期内的最高价和最低价
      const startIdx = Math.max(0, i - n + 1);
      let highestHigh = klines[startIdx].high;
      let lowestLow = klines[startIdx].low;

      for (let j = startIdx + 1; j <= i; j++) {
        highestHigh = Math.max(highestHigh, klines[j].high);
        lowestLow = Math.min(lowestLow, klines[j].low);
      }

      // 计算RSV（原始随机值）
      const range = highestHigh - lowestLow;
      let rsv = 0;
      if (range !== 0) {
        rsv = ((kline.close - lowestLow) / range) * 100;
      }

      // 计算K值和D值
      k = k * (1 - 1 / m1) + rsv * (1 / m1);
      d = d * (1 - 1 / m2) + k * (1 / m2);

      // 保留两位小数
      kdValues.push({
        date: kline.date,
        time: kline.time,
        k: Math.round(k * 100) / 100,
        d: Math.round(d * 100) / 100
      });
    }

    return kdValues;
  }

  /**
   * 计算MACD指标
   * 参数: fast=28, slow=177, signal=9
   */
  async calculateMACDIndicator(symbol: string, fast: number = 28, slow: number = 177, signal: number = 9): Promise<MACDResponse> {
    try {
      // 获取K线数据
      const futuresData = await this.fetchKlineData(symbol);
      
      // 合并所有交易日的K线数据
      const allKlines: Array<KlineData & { date: string }> = [];
      for (const tradingDay of futuresData.tradingDays) {
        for (const kline of tradingDay.klines) {
          allKlines.push({
            ...kline,
            date: tradingDay.date
          });
        }
      }

      // 计算MACD指标
      const macdValues = this.computeMACDIndicator(allKlines, fast, slow, signal);

      // 保存到数据库
      this.saveMACDDataToDatabase(symbol, macdValues);

      return {
        symbol,
        parameters: { fast, slow, signal },
        macdValues
      };
    } catch (error) {
      throw new Error(`Failed to calculate MACD indicator for ${symbol}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 核心MACD指标计算逻辑
   */
  private computeMACDIndicator(klines: Array<KlineData & { date: string }>, fast: number, slow: number, signal: number): MACDValue[] {
    const macdValues: MACDValue[] = [];
    
    // 计算快速EMA和慢速EMA
    const fastEMA = this.calculateEMA(klines.map(k => k.close), fast);
    const slowEMA = this.calculateEMA(klines.map(k => k.close), slow);
    
    // 计算MACD线（快速EMA - 慢速EMA）
    const macdLine: number[] = [];
    for (let i = 0; i < fastEMA.length; i++) {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
    
    // 计算Signal线（MACD线的EMA）
    const signalLine = this.calculateEMA(macdLine, signal);
    
    // 计算Histogram（MACD线 - Signal线）
    for (let i = 0; i < klines.length; i++) {
      const kline = klines[i];
      const histogram = macdLine[i] - signalLine[i];
      
      macdValues.push({
        date: kline.date,
        time: kline.time,
        macd: Math.round(macdLine[i] * 10000) / 10000,
        signal: Math.round(signalLine[i] * 10000) / 10000,
        histogram: Math.round(histogram * 10000) / 10000
      });
    }
    
    return macdValues;
  }

  /**
   * 计算指数移动平均线（EMA）
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    // 计算初始SMA作为第一个EMA值
    let sum = 0;
    for (let i = 0; i < Math.min(period, prices.length); i++) {
      sum += prices[i];
    }
    let currentEMA = sum / Math.min(period, prices.length);
    ema.push(currentEMA);
    
    // 计算后续EMA值
    for (let i = period; i < prices.length; i++) {
      currentEMA = (prices[i] - currentEMA) * multiplier + currentEMA;
      ema.push(currentEMA);
    }
    
    // 填充前面的值（使用SMA）
    if (prices.length > period) {
      const result: number[] = [];
      for (let i = 0; i < period - 1; i++) {
        let sum = 0;
        for (let j = 0; j <= i; j++) {
          sum += prices[j];
        }
        result.push(sum / (i + 1));
      }
      result.push(...ema);
      return result;
    }
    
    return ema;
  }

  /**
   * 从API获取原始数据
   */
  private fetchFromApi(symbol: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const varName = `t5nf_${symbol}`;
      const url = `${this.baseUrl}/var ${varName}=/InnerFuturesNewService.getFourDaysLine?symbol=${symbol}`;

      https.get(url, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data);
          } else {
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * 解析JSONP格式的响应
   * 从 var t5nf_MA2601=([[[...]]]) 中提取数据
   */
  private parseJsonp(text: string, symbol: string): RawKlineData[][][] {
    try {
      // 移除JSONP包装和注释
      let cleaned = text.replace(/\/\*[\s\S]*?\*\//g, '');
      
      // 查找数据的起始和结束位置
      // 格式: var t5nf_XXX=([[[...]]])
      const firstBracket = cleaned.indexOf('([[[');
      const lastBracket = cleaned.lastIndexOf(']');

      if (firstBracket === -1 || lastBracket === -1) {
        throw new Error('Could not find data boundaries in JSONP response');
      }

      // 提取 [[[ ... ]]]
      const jsonStr = cleaned.substring(firstBracket + 1, lastBracket + 1);
      const data = JSON.parse(jsonStr) as RawKlineData[][][];

      // 返回所有交易日的K线数据（应该是5个交易日）
      // data 是一个数组，每个元素是一个交易日的K线数据
      return data;
    } catch (error) {
      throw new Error(`Failed to parse JSONP: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 格式化原始数据为统一格式
   */
  private formatData(rawData: RawKlineData[][][], symbol: string): FuturesResponse {
    const tradingDays: TradingDay[] = [];

    // 遍历每个交易日
    for (const dayData of rawData) {
      const klines: KlineData[] = [];
      let tradingDate = '';

      // 遍历该交易日的所有K线
      for (const klineRaw of dayData) {
        if (klineRaw.length === 0) continue;

        const time = String(klineRaw[0]);
        const close = Number(klineRaw[1]);
        const high = Number(klineRaw[2]);
        const volume = Number(klineRaw[3]);
        const openInterest = Number(klineRaw[4]);

        // 第一条K线包含最低价和交易日期
        let low = close;

        if (klineRaw.length === 7) {
          low = Number(klineRaw[5]);
          tradingDate = String(klineRaw[6]);
        }

        // 构建K线数据
        const kline: KlineData = {
          time,
          open: close,        // 使用收盘价作为开盘价（API未提供开盘价）
          high,
          low,
          close,
          volume,
          openInterest
        };

        klines.push(kline);
      }

      // 如果有K线数据，添加该交易日
      if (klines.length > 0) {
        tradingDays.push({
          date: tradingDate || 'unknown',
          klines
        });
      }
    }

    return {
      symbol,
      tradingDays
    };
  }

  /**
   * 清除所有缓存
   */
  clearCache(): void {
    this.cacheManager.clear();
  }

  /**
   * 清除指定合约的缓存
   */
  clearCacheForSymbol(symbol: string): boolean {
    return this.cacheManager.delete(symbol);
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    return this.cacheManager.getStats();
  }

  /**
   * 保存KD指标数据到数据库
   */
  private saveKDDataToDatabase(symbol: string, kdValues: KDValue[]): void {
    const kdRecords = kdValues.map(kd => ({
      symbol,
      date: kd.date,
      time: kd.time,
      k: kd.k,
      d: kd.d
    }));

    if (kdRecords.length > 0) {
      this.db.saveKDDataBatch(kdRecords);
    }
  }

  /**
   * 保存MACD指标数据到数据库
   */
  private saveMACDDataToDatabase(symbol: string, macdValues: MACDValue[]): void {
    const macdRecords = macdValues.map(macd => ({
      symbol,
      date: macd.date,
      time: macd.time,
      macd: macd.macd,
      signal: macd.signal,
      histogram: macd.histogram
    }));

    if (macdRecords.length > 0) {
      this.db.saveMACDDataBatch(macdRecords);
    }
  }

  /**
   * 查询K线历史数据
   */
  queryKlineHistory(symbol: string, startDate?: string, endDate?: string): Array<{
    symbol: string;
    date: string;
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    openInterest: number;
  }> {
    return this.db.queryKlineHistory(symbol, startDate, endDate);
  }

  /**
   * 查询KD指标历史数据
   */
  queryKDHistory(symbol: string, startDate?: string, endDate?: string): Array<{
    symbol: string;
    date: string;
    time: string;
    k: number;
    d: number;
  }> {
    return this.db.queryKDHistory(symbol, startDate, endDate);
  }

  /**
   * 查询MACD指标历史数据
   */
  queryMACDHistory(symbol: string, startDate?: string, endDate?: string): Array<{
    symbol: string;
    date: string;
    time: string;
    macd: number;
    signal: number;
    histogram: number;
  }> {
    return this.db.queryMACDHistory(symbol, startDate, endDate);
  }

  /**
   * 获取数据库统计信息
   */
  getDatabaseStats(): {
    klineCount: number;
    kdCount: number;
    symbols: string[];
    dbPath: string;
  } {
    return this.db.getStats();
  }

  /**
   * 清除数据库中的所有数据
   */
  clearDatabaseData(): void {
    this.db.clearAllData();
  }

  /**
   * 清除数据库中指定合约的数据
   */
  clearDatabaseSymbolData(symbol: string): void {
    this.db.clearSymbolData(symbol);
  }
}

module.exports = { FuturesClient };
