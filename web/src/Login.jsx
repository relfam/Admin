import React, { useState } from "react";
import { ShieldCheck, KeyRound } from "lucide-react";
import { api, setToken } from "./api";

const C = { primary: "#5B8DEF", primarySoft: "#EEF3FE", bg: "#F8FAFC", card: "#FFFFFF", border: "#E5E7EB", text: "#111827", sub: "#6B7280", error: "#EF4444" };

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  // Set once the password step comes back asking for a TOTP code — either straight verification
  // (tfaRequired) or first-time enrollment (tfaSetupRequired, carries a QR code to scan).
  const [tfa, setTfa] = useState(null);
  const [code, setCode] = useState("");

  const submitPassword = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const result = await api.login(email.trim(), password);
      if (result.tfaSetupRequired || result.tfaRequired) {
        setTfa(result);
      } else {
        setToken(result.token);
        onLogin(result.admin);
      }
    } catch (e2) {
      setErr(e2.message || "Login failed");
    } finally {
      setBusy(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { token, admin } = await api.tfaVerify(tfa.tempToken, code.trim());
      setToken(token);
      onLogin(admin);
    } catch (e2) {
      setErr(e2.message || "Incorrect code");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif" }}>
      <form onSubmit={tfa ? submitCode : submitPassword} style={{ width: 360, maxWidth: "92vw", background: C.card, border: `1px solid ${C.border}`, borderRadius: 20, padding: 32, boxShadow: "0 20px 48px rgba(17,24,39,.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${C.primary}, #7BA6F5)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>R</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Relfam Admin</div>
            <div style={{ fontSize: 11.5, color: C.sub }}>{tfa ? (tfa.tfaSetupRequired ? "Set up two-factor login" : "Enter your authenticator code") : "Sign in to continue"}</div>
          </div>
        </div>

        {!tfa && (
          <>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>Email</label>
            <input autoFocus type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, marginBottom: 16, boxSizing: "border-box" }} />
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>Password</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 13.5, marginBottom: 20, boxSizing: "border-box" }} />
          </>
        )}

        {tfa?.tfaSetupRequired && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12.5, color: C.sub, margin: "0 0 12px" }}>
              Scan this with Google Authenticator, Authy, or any TOTP app, then enter the 6-digit code it shows.
            </p>
            <img src={tfa.qrDataUrl} alt="TOTP QR code" style={{ display: "block", margin: "0 auto 10px", width: 176, height: 176, borderRadius: 8, border: `1px solid ${C.border}` }} />
            <div style={{ fontSize: 11, color: C.sub, textAlign: "center", wordBreak: "break-all" }}>Can't scan? Enter manually: <code>{tfa.secret}</code></div>
          </div>
        )}

        {tfa && (
          <>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.sub, marginBottom: 6 }}>6-digit code</label>
            <input autoFocus type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} required value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              style={{ width: "100%", border: `1px solid ${C.border}`, borderRadius: 12, padding: "10px 14px", fontSize: 16, letterSpacing: 4, textAlign: "center", marginBottom: 12, boxSizing: "border-box" }} />
            <button type="button" onClick={() => { setTfa(null); setCode(""); setErr(""); }}
              style={{ background: "none", border: "none", color: C.sub, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 16 }}>
              ← Back
            </button>
          </>
        )}

        {err && <div style={{ fontSize: 12.5, color: C.error, marginBottom: 14 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ width: "100%", border: "none", borderRadius: 12, padding: "11px 0", background: C.primary, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: busy ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          {tfa ? <KeyRound size={15} /> : <ShieldCheck size={15} />} {busy ? "Verifying…" : tfa ? (tfa.tfaSetupRequired ? "Verify & enable" : "Verify") : "Sign in"}
        </button>
      </form>
    </div>
  );
}
