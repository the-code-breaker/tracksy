export function returnAfterAuth(recovery: boolean, token?: string) {
  if (recovery) return "/auth/password" as const;
  if (token && /^[a-f0-9]{64}$/.test(token))
    return { pathname: "/join" as const, params: { token } };
  return "/" as const;
}
