/**
 * Error Logger Utility
 * Captures and saves error logs to a file for debugging
 */

import * as FileSystem from 'expo-file-system';

interface LogEntry {
  timestamp: string;
  level: 'log' | 'error' | 'warn' | 'info';
  message: string;
  data?: any;
}

class ErrorLogger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 logs
  private logFile: string;

  constructor() {
    this.logFile = `${FileSystem.documentDirectory}error-logs.txt`;
    this.setupConsoleInterception();
  }

  private setupConsoleInterception() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalInfo = console.info;

    console.log = (...args: any[]) => {
      this.addLog('log', args);
      originalLog(...args);
    };

    console.error = (...args: any[]) => {
      this.addLog('error', args);
      originalError(...args);
    };

    console.warn = (...args: any[]) => {
      this.addLog('warn', args);
      originalWarn(...args);
    };

    console.info = (...args: any[]) => {
      this.addLog('info', args);
      originalInfo(...args);
    };
  }

  private addLog(level: LogEntry['level'], args: any[]) {
    const message = args
      .map((arg) => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: args.length > 1 ? args.slice(1) : undefined,
    };

    this.logs.push(logEntry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Save to file periodically (every 10 logs)
    if (this.logs.length % 10 === 0) {
      this.saveLogsToFile();
    }
  }

  private async saveLogsToFile() {
    try {
      const logContent = this.logs
        .map(
          (log) =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${
              log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''
            }`
        )
        .join('\n\n');

      await FileSystem.writeAsStringAsync(this.logFile, logContent);
    } catch (error) {
      // Silently fail - we don't want logging to break the app
    }
  }

  async getLogs(): Promise<string> {
    await this.saveLogsToFile();
    try {
      return await FileSystem.readAsStringAsync(this.logFile);
    } catch {
      return this.logs
        .map(
          (log) =>
            `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.message}${
              log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''
            }`
        )
        .join('\n\n');
    }
  }

  async clearLogs() {
    this.logs = [];
    try {
      await FileSystem.deleteAsync(this.logFile, { idempotent: true });
    } catch {
      // Ignore errors
    }
  }

  getLogFilePath(): string {
    return this.logFile;
  }
}

export const errorLogger = new ErrorLogger();

