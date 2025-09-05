import validator from "validator";
import { UserInputError } from "./errors";

export function validateEmail(email: string) {
  if (!validator.isEmail(email)) {
    throw new Error("Invalid Email Format");
  }
}

export function validatePassword(password: string) {
  const minLength = 6; //default frontend prevents the use of less than 6 chars, update to test errors if needed
  const hasSpecial = /[^A-Za-z0-9]/.test(password); //Special chars

  if (password.length < minLength || !hasSpecial) {
    throw new UserInputError("Password does not meet complexity requirements");
  }
}
