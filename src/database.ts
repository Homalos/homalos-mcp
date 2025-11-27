/**
 * 数据库管理器 - 使用SQLite存储期货数据
 */

const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbName: string = 'futures-data.db') {
    // 数据库文件存储在项目根目录
    this.dbPath = path.join(__dirname, '..', dbName);
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  /**
   * 初始化数据库表
   */
  private initializeTables(): void {
    // K线数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kline_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        open REAL NOT NULL,
        high REAL NOT NULL,
        low REAL NOT NULL,
        close REAL NOT NULL,
        volume INTEGER NOT NULL,
        open_interest INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date, time)
      );
      
      CREATE INDEX IF NOT EXISTS idx_kline_symbol_date ON kline_data(symbol, date);
    `);

    // KD指标数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kd_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        k_value REAL NOT NULL,
        d_value REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date, time)
      );
      
      CREATE INDEX IF NOT EXISTS idx_kd_symbol_date ON kd_data(symbol, date);
    `);

    // MACD指标数据表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS macd_data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        macd_value REAL NOT NULL,
        signal_value REAL NOT NULL,
        histogram_value REAL NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(symbol, date, time)
      );
      
      CREATE INDEX IF NOT EXISTS idx_macd_symbol_date ON macd_data(symbol, date);
    `);
  }

  /**
   * 保存K线数据
   */
  saveKlineData(symbol: string, date: string, time: string, kline: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    openInterest: number;
  }): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO kline_data 
      (symbol, date, time, open, high, low, close, volume, open_interest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      symbol,
      date,
      time,
      kline.open,
      kline.high,
      kline.low,
      kline.close,
      kline.volume,
      kline.openInterest
    );
  }

  /**
   * 批量保存K线数据
   */
  saveKlineDataBatch(data: Array<{
    symbol: string;
    date: string;
    time: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    openInterest: number;
  }>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO kline_data 
      (symbol, date, time, open, high, low, close, volume, open_interest)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: typeof data) => {
      for (const item of items) {
        stmt.run(
          item.symbol,
          item.date,
          item.time,
          item.open,
          item.high,
          item.low,
          item.close,
          item.volume,
          item.openInterest
        );
      }
    });

    transaction(data);
  }

  /**
   * 保存KD指标数据
   */
  saveKDData(symbol: string, date: string, time: string, k: number, d: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO kd_data 
      (symbol, date, time, k_value, d_value)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(symbol, date, time, k, d);
  }

  /**
   * 批量保存KD指标数据
   */
  saveKDDataBatch(data: Array<{
    symbol: string;
    date: string;
    time: string;
    k: number;
    d: number;
  }>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO kd_data 
      (symbol, date, time, k_value, d_value)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: typeof data) => {
      for (const item of items) {
        stmt.run(item.symbol, item.date, item.time, item.k, item.d);
      }
    });

    transaction(data);
  }

  /**
   * 保存MACD指标数据
   */
  saveMACDData(symbol: string, date: string, time: string, macd: number, signal: number, histogram: number): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO macd_data 
      (symbol, date, time, macd_value, signal_value, histogram_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(symbol, date, time, macd, signal, histogram);
  }

  /**
   * 批量保存MACD指标数据
   */
  saveMACDDataBatch(data: Array<{
    symbol: string;
    date: string;
    time: string;
    macd: number;
    signal: number;
    histogram: number;
  }>): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO macd_data 
      (symbol, date, time, macd_value, signal_value, histogram_value)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((items: typeof data) => {
      for (const item of items) {
        stmt.run(item.symbol, item.date, item.time, item.macd, item.signal, item.histogram);
      }
    });

    transaction(data);
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
    let query = 'SELECT * FROM kline_data WHERE symbol = ?';
    const params: any[] = [symbol];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date, time';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      symbol: row.symbol,
      date: row.date,
      time: row.time,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
      openInterest: row.open_interest
    }));
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
    let query = 'SELECT * FROM kd_data WHERE symbol = ?';
    const params: any[] = [symbol];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date, time';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      symbol: row.symbol,
      date: row.date,
      time: row.time,
      k: row.k_value,
      d: row.d_value
    }));
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
    let query = 'SELECT * FROM macd_data WHERE symbol = ?';
    const params: any[] = [symbol];

    if (startDate) {
      query += ' AND date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND date <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY date, time';

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];

    return rows.map(row => ({
      symbol: row.symbol,
      date: row.date,
      time: row.time,
      macd: row.macd_value,
      signal: row.signal_value,
      histogram: row.histogram_value
    }));
  }

  /**
   * 获取数据库统计信息
   */
  getStats(): {
    klineCount: number;
    kdCount: number;
    symbols: string[];
    dbPath: string;
  } {
    const klineCount = (this.db.prepare('SELECT COUNT(*) as count FROM kline_data').get() as any).count;
    const kdCount = (this.db.prepare('SELECT COUNT(*) as count FROM kd_data').get() as any).count;
    const symbols = (this.db.prepare('SELECT DISTINCT symbol FROM kline_data ORDER BY symbol').all() as any[])
      .map(row => row.symbol);

    return {
      klineCount,
      kdCount,
      symbols,
      dbPath: this.dbPath
    };
  }

  /**
   * 清除所有数据
   */
  clearAllData(): void {
    this.db.exec('DELETE FROM kline_data; DELETE FROM kd_data; DELETE FROM macd_data;');
  }

  /**
   * 清除指定合约的数据
   */
  clearSymbolData(symbol: string): void {
    this.db.prepare('DELETE FROM kline_data WHERE symbol = ?').run(symbol);
    this.db.prepare('DELETE FROM kd_data WHERE symbol = ?').run(symbol);
    this.db.prepare('DELETE FROM macd_data WHERE symbol = ?').run(symbol);
  }

  /**
   * 关闭数据库
   */
  close(): void {
    this.db.close();
  }
}

module.exports = { DatabaseManager };
