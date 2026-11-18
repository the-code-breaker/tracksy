import { login } from "../actions";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <section>
      <p className="eyebrow">TRACKSY OPERATIONS</p>
      <h1>Welcome back.</h1>
      <p>Sign in with your provisioned administrator account.</p>
      {error && <p role="alert">{error}</p>}
      <form action={login}>
        <label>
          Email
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        <button>Continue to verification →</button>
      </form>
    </section>
  );
}
