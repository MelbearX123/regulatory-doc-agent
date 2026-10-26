export class MatterNotFoundError extends Error {
  readonly matterNumber: string;

  constructor(matterNumber: string) {
    super(`Matter ${matterNumber} was not found`);
    this.name = 'MatterNotFoundError';
    this.matterNumber = matterNumber;
  }
}

export class ScrapeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ScrapeError';
  }
}
