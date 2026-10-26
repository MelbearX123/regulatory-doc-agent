/** The requested matter doesn't exist on the site. A user problem, not a bug. */
export class MatterNotFoundError extends Error {
  readonly matterNumber: string;

  constructor(matterNumber: string) {
    super(`Matter ${matterNumber} was not found`);
    this.name = 'MatterNotFoundError';
    this.matterNumber = matterNumber;
  }
}

/** The site behaved unexpectedly: timeout, wrong matter opened, layout changed. */
export class ScrapeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ScrapeError';
  }
}
