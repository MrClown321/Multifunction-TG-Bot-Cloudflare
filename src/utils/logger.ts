// Logging utilities with structured logging

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  userId?: number;
  chatId?: number;
  command?: string;
  duration?: number;
  error?: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private minLevel: LogLevel;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLevel = minLevel;
  }

  private log(level: LogLevel, levelName: string, message: string, meta?: Partial<LogEntry>): void {
    if (level < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: levelName,
      message,
      ...meta,
    };

    const output = JSON.stringify(entry);

    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, meta);
  }

  info(message: string, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.INFO, 'INFO', message, meta);
  }

  warn(message: string, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.WARN, 'WARN', message, meta);
  }

  error(message: string, error?: Error, meta?: Partial<LogEntry>): void {
    this.log(LogLevel.ERROR, 'ERROR', message, {
      ...meta,
      error: error?.message,
      stack: error?.stack,
    });
  }

  command(command: string, userId: number, chatId: number, duration?: number): void {
    this.info(`Command executed: /${command}`, {
      command,
      userId,
      chatId,
      duration,
    });
  }
}

export const logger = new Logger(LogLevel.INFO);
