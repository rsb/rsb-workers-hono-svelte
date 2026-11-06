// Generated from prd/todo/rules.md by tooling/rules/generate.ts. Do not edit: change the spec and regenerate.
import { type Result, err, ok } from "@todo/business/result.ts";
import type { RuleId } from "@todo/business/rules.ts";
import type { SignIn } from "@todo/business/auth/credential.ts";
import { text } from "../fields/decode.ts";
import { problemsFrom } from "../fields/problems.ts";
import type { Problem, Problems } from "../problem.ts";
import { emailLength } from "../rules/email-length.ts";
import { emailShape } from "../rules/email-shape.ts";
import { passwordGiven } from "../rules/password-given.ts";

/** `email`: text, trimmed, lower-cased, then `email.length`, `email.shape`. */
const emailField = (value: unknown): Result<string, Problem> => {
  const decoded = text("email", value);
  if (!decoded.ok) {
    return decoded;
  }

  const applied = decoded.value.trim().toLowerCase();
  const emailLengthProblem = emailLength("email", applied);
  if (emailLengthProblem !== undefined) {
    return err(emailLengthProblem);
  }
  const emailShapeProblem = emailShape("email", applied);
  if (emailShapeProblem !== undefined) {
    return err(emailShapeProblem);
  }

  return ok(applied);
};

/** `password`: text, then `password.given`. */
const passwordField = (value: unknown): Result<string, Problem> => {
  const decoded = text("password", value);
  if (!decoded.ok) {
    return decoded;
  }

  const applied = decoded.value;
  const passwordGivenProblem = passwordGiven("password", applied);
  if (passwordGivenProblem !== undefined) {
    return err(passwordGivenProblem);
  }

  return ok(applied);
};

/** What a delivery read for a `SignIn`, not yet decoded. */
export type SignInCandidate = { email: unknown; password: unknown };

/**
 * A `SignIn` from what a delivery read. What someone signs in with: an email
 * and a password. Gives every problem it finds, as prd/todo/rules.md › Every
 * input says.
 */
export const toSignIn = (candidate: SignInCandidate): Result<SignIn, Problems> => {
  const email = emailField(candidate.email);
  const password = passwordField(candidate.password);

  if (!email.ok) {
    return err(problemsFrom(email.error, [password]));
  }
  if (!password.ok) {
    return err([password.error]);
  }

  return ok({
    email: email.value,
    password: password.value,
  });
};

/** The rules `toSignIn` applies, by id: what a route that runs it applies (L33). */
toSignIn.rules = ["email.length", "email.shape", "password.given"] as const satisfies readonly RuleId[];
