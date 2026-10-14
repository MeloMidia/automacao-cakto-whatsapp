const levels = { debug: 10, info: 20, warn: 30, error: 40 };

export function createLogger(minimumLevel = 'info') {
  const minimum = levels[minimumLevel] ?? levels.info;

  const write = (level, message, details = {}) => {
    if (levels[level] < minimum) return;
    const record = { timestamp: new Date().toISOString(), level, message, ...details };
    const output = JSON.stringify(record);
    if (level === 'error') console.error(output);
    else console.log(output);
  };

  return {
    debug: (message, details) => write('debug', message, details),
    info: (message, details) => write('info', message, details),
    warn: (message, details) => write('warn', message, details),
    error: (message, details) => write('error', message, details),
  };
}
