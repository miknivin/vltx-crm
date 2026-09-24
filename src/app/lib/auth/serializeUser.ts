import type { Role, SignupMethod, User } from "@prisma/client";

/// Wire format for signup method. The database enum can't contain a slash, so
/// `Email/Password` is stored as `EmailPassword` and translated at the API
/// boundary — the frontend and existing clients keep sending the old strings.
export type ApiSignupMethod = "OTP" | "Email/Password" | "OAuth";

const SIGNUP_METHOD_TO_API: Record<SignupMethod, ApiSignupMethod> = {
  OTP: "OTP",
  EmailPassword: "Email/Password",
  OAuth: "OAuth",
};

const SIGNUP_METHOD_FROM_API: Record<ApiSignupMethod, SignupMethod> = {
  OTP: "OTP",
  "Email/Password": "EmailPassword",
  OAuth: "OAuth",
};

export function toDbSignupMethod(value: ApiSignupMethod): SignupMethod {
  return SIGNUP_METHOD_FROM_API[value];
}

export interface ApiUser {
  /// Kept as `_id` rather than `id`: the whole admin frontend reads `user._id`,
  /// and renaming the wire field would be a change in every component rather
  /// than one in the data layer.
  _id: string;
  uid: number;
  name: string | null;
  email: string;
  phone: string;
  role: Role;
  signupMethod: ApiSignupMethod;
  avatar: { public_id: string; url: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

/// Takes the password-less shape on purpose: handlers hold `Omit<User, "password">`
/// from the auth middleware, and nothing here needs the hash.
export type SerializableUser = Omit<User, "password" | "resetPasswordToken" | "resetPasswordExpire"> &
  Partial<Pick<User, "resetPasswordToken" | "resetPasswordExpire">>;

export function serializeUser(user: SerializableUser): ApiUser {
  return {
    _id: user.id,
    uid: user.uid,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    signupMethod: SIGNUP_METHOD_TO_API[user.signupMethod],
    avatar: user.avatarUrl
      ? { public_id: user.avatarPublicId ?? "", url: user.avatarUrl }
      : null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
