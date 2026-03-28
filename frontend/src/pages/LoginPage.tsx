import { FormEvent, useState } from "react";
import { login, register } from "../api/client";

type Props = {
  onAuthenticated: () => void;
};

function friendlyAuthError(error: unknown): string {
  const raw = String(error).replace(/^Error:\s*/, "").trim();
  try {
    const parsed = JSON.parse(raw) as {
      detail?: string | Array<{ msg?: string; type?: string; loc?: unknown; ctx?: { min_length?: number } }>;
    };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (Array.isArray(parsed.detail) && parsed.detail.length > 0) {
      const first = parsed.detail[0];
      if (first?.type === "string_too_short" && Array.isArray(first.loc) && first.loc.includes("password")) {
        return `Password must be at least ${first.ctx?.min_length ?? 8} characters.`;
      }
      if (first?.msg) {
        return first.msg;
      }
    }
  } catch {
    // Fallback to raw text below.
  }
  return raw || "Something went wrong. Please try again.";
}

export function LoginPage({ onAuthenticated }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const payload = isRegister ? await register(email, password) : await login(email, password);
      localStorage.setItem("token", payload.access_token);
      onAuthenticated();
    } catch (e) {
      setError(friendlyAuthError(e));
    }
  }

  return (
    <section className="card auth-card">
      <h2>{isRegister ? "Create Account" : "Login"}</h2>
      <p className="hint">Secure access to your forensic enhancement workspace.</p>
      <form onSubmit={handleSubmit} className="form-grid auth-form">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {isRegister ? <small className="hint">Use at least 8 characters for password.</small> : null}
        <button type="submit">{isRegister ? "Register" : "Login"}</button>
      </form>
      <button className="link-btn" onClick={() => setIsRegister((s) => !s)}>
        {isRegister ? "Use existing account" : "Create new account"}
      </button>
      {error ? <pre className="error">{error}</pre> : null}
    </section>
  );
}
