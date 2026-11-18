"use client";
import { useActionState } from "react";
import { prepareMfa, verifyMfa, type MfaState } from "../actions";
export default function Mfa() {
  const [setup, start, pending] = useActionState<MfaState, FormData>(
    prepareMfa,
    {},
  );
  const [verified, verify, verifying] = useActionState<MfaState, FormData>(
    verifyMfa,
    {},
  );
  return (
    <section>
      <p className="eyebrow">AN EXTRA LAYER</p>
      <h1>Verify it’s you.</h1>
      <p>
        Use a time based authenticator. Enrollment requires a valid
        administrator session.
      </p>
      <form action={start}>
        <button disabled={pending}>Set up or challenge authenticator</button>
      </form>
      {setup.error && <p role="alert">{setup.error}</p>}
      {setup.qr && <img alt="Scan with your authenticator" src={setup.qr} />}
      {setup.factorId && (
        <form action={verify}>
          <input name="factorId" type="hidden" value={setup.factorId} />
          <input name="challengeId" type="hidden" value={setup.challengeId} />
          <label>
            Six digit code
            <input
              name="code"
              pattern="[0-9]{6}"
              inputMode="numeric"
              required
              autoComplete="one-time-code"
            />
          </label>
          <button disabled={verifying}>Verify and open console</button>
        </form>
      )}
      {verified.error && <p role="alert">{verified.error}</p>}
    </section>
  );
}
