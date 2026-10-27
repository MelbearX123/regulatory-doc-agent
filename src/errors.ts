export class MatterNotFoundError extends Error {
  constructor(matterNumber: string) {
    super(`Matter ${matterNumber} was not found`);
    this.name = 'MatterNotFoundError';
  }
}

export class ScrapeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ScrapeError';
  }
}
