/** What the frame shows of a signed-in person: never their id or the rest of the actor. */
export type Person = { name: string; email: string; initials: string; admin: boolean };

/**
 * Who the frame is drawn for: a signed-in person, nobody (the api's
 * `anonymous`), or `failed` when the actor could not be read.
 */
export type Account = { state: "signed_in"; person: Person } | { state: "anonymous" } | { state: "failed" };

/**
 * The root layout's data. The probe is not a page of the app: it has no
 * frame and spends no actor read (deviation 13).
 */
export type Frame = { probe: true } | { probe: false; account: Account };
