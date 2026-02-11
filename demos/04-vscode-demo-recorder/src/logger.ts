/**
 * Structured logger for vscode-demo-recorder using tslog.
 */

import { Logger } from "tslog";

export type LogLevel = "silly" | "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LOG_LEVEL_MAP: Record<LogLevel, number> = {
  silly: 0,
  trace: 1,
  debug: 2,
  info: 3,
  warn: 4,
  error: 5,
  fatal: 6,
};

let currentLogger: Logger<unknown> | null = null;

export function createLogger(opts: { verbose?: boolean; quiet?: boolean } = {}): Logger<unknown> {
  let minLevel: number;
  if (opts.quiet) {
    minLevel = LOG_LEVEL_MAP.error;
  } else if (opts.verbose) {
    minLevel = LOG_LEVEL_MAP.debug;
  } else {
    minLevel = LOG_LEVEL_MAP.info;
  }

  currentLogger = new Logger({
    name: "vscode-demo-recorder",
    minLevel,
    prettyLogTemplate: "{{logLevelName}}\t",
    prettyLogTimeZone: "local",
    stylePrettyLogs: true,
  });

  return currentLogger;
}

export function getLogger(): Logger<unknown> {
  if (!currentLogger) {
    return createLogger();
  }
  return currentLogger;
}
