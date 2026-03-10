// IRIS — Structured Activity Logging

type LogLevel = 'info' | 'warn' | 'error';

export function irisLog(level: LogLevel, message: string, data?: Record<string, unknown>) {
  const timestamp = new Date().toISOString();
  const prefix = `[IRIS] [${timestamp}]`;
  const payload = data ? ` ${JSON.stringify(data)}` : '';

  switch (level) {
    case 'info':
      console.log(`${prefix} ${message}${payload}`);
      break;
    case 'warn':
      console.warn(`${prefix} ${message}${payload}`);
      break;
    case 'error':
      console.error(`${prefix} ${message}${payload}`);
      break;
  }
}
