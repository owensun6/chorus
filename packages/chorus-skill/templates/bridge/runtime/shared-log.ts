// Author: be-domain-modeler

/**
 * Unified tagged logger. Single point of control for all runtime output.
 * Replace with structured logging (e.g. pino) before production deployment.
 */

const log = (tag: string, message: string): void => {
  process.stdout.write(`[${tag}] ${message}\n`);
};

const logError = (tag: string, message: string): void => {
  process.stderr.write(`[${tag}] ${message}\n`);
};

const extractErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export { log, logError, extractErrorMessage };
