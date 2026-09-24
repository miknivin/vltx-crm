import type { ApiUser, ApiSignupMethod } from "@/app/lib/auth/serializeUser";

export type { ApiUser, ApiSignupMethod };

export type UserRole = "user" | "employee" | "team_member" | "admin";

/// The user shape the frontend receives. Named `IUser` and keyed on `_id` to
/// match what the components already read — the Mongoose document interface
/// this replaces had the same fields, minus its instance methods.
export type IUser = ApiUser;
