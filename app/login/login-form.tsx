"use client";

import { useActionState } from "react";
import { signInAction, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signInAction, initialState);

  return (
    <form className="form-grid" action={action}>
      <label htmlFor="email">E-posta</label>
      <input id="email" name="email" type="email" autoComplete="username" required />

      <label htmlFor="password">Parola</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />

      {state.error ? (
        <p className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? "Giriş yapılıyor" : "Giriş yap"}
      </button>
    </form>
  );
}
