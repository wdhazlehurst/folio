// Custom error class so errors can be reported to user in the alerts
export class UserInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserInputError";
  }
}