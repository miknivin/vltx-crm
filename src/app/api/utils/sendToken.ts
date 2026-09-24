import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  authCookieOptions,
  signJwtToken,
} from "@/app/lib/auth/token";

interface TokenUser {
  id: string;
  name: string | null;
  email: string;
}

interface TokenResponse {
  success: boolean;
  token: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

const sendToken = (user: TokenUser, statusCode: number): NextResponse<TokenResponse> => {
  const token = signJwtToken(user.id);

  const response = NextResponse.json(
    {
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    },
    { status: statusCode }
  );

  response.cookies.set(AUTH_COOKIE, token, authCookieOptions(SESSION_MAX_AGE_SECONDS));

  return response;
};

export default sendToken;
