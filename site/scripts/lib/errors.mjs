export class GeneratorError extends Error {
  /** @param {string} message @param {number} [exitCode] */
  constructor(message, exitCode = 1) {
    super(message);
    this.name = 'GeneratorError';
    this.exitCode = exitCode;
  }
}
