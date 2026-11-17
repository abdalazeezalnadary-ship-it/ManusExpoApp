import * as Auth from "./auth";

/** The standalone app uses bearer-token auth; no cookie/OAuth endpoint is required. */
export async function logout(): Promise<void> {
  await Auth.removeSessionToken();
}

/** Signed-in user details are loaded through the protected tRPC endpoint. */
export async function getMe(): Promise<null> {
  return null;
}
