"use client";

import { useEffect, useState } from "react";
import { authToken, inviteToken } from "@/lib/phase11/config";
import { confirmAuthAction } from "@/lib/phase11/auth-actions";
import { rememberInviteAction } from "@/lib/phase11/clinic-actions";
import { DemoForm } from "./forms";

export function CapabilityForm({ kind }: { kind: "auth" | "invite" }) {
  const [fragment, setFragment] = useState<string | null>(null);
  useEffect(() => {
    function readFragment() {
      const value = location.hash.slice(1);
      if (value) {
        history.replaceState(history.state, "", location.pathname + location.search);
        setFragment(value);
      } else {
        setFragment((current) => current ?? "");
      }
    }
    const frame = requestAnimationFrame(readFragment);
    window.addEventListener("hashchange", readFragment);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", readFragment);
    };
  }, []);
  if (fragment === null) return <p role="status">Bağlantı okunuyor…</p>;
  const params = new URLSearchParams(fragment);
  if (kind === "invite") {
    const token = inviteToken.safeParse(params.get("code"));
    return token.success ? (
      <DemoForm action={rememberInviteAction} submit="Davetle devam et">
        <input type="hidden" name="token" value={token.data} />
      </DemoForm>
    ) : <p className="form-error" role="alert">Davet bağlantısı eksik veya geçersiz.</p>;
  }
  const token = authToken.safeParse(params.get("token"));
  const mode = params.get("mode");
  if (!token.success || (mode !== "recovery" && mode !== "signup")) {
    return <p className="form-error" role="alert">Bağlantı eksik veya geçersiz. Yeni bir bağlantı isteyin.</p>;
  }
  return (
    <DemoForm action={confirmAuthAction} submit={mode === "signup" ? "E-posta adresini doğrula" : "Parolayı yenile"}>
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="token" value={token.data} />
    </DemoForm>
  );
}
