"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useBudget } from "@/lib/budget-store";

export function AuthDialog() {
  const { authOpen, setAuthOpen, login } = useBudget();
  const mode = authOpen || "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;
    login();
    setAuthOpen(false);
    setEmail("");
    setPassword("");
    toast.success(mode === "login" ? "Welcome back" : "Account created", {
      description: "Mock session started — backend wiring comes next.",
    });
  };

  const field =
    "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

  return (
    <Dialog open={authOpen !== false} onOpenChange={(v) => setAuthOpen(v ? mode : false)}>
      <DialogContent className="sm:max-w-[24rem]">
        <DialogHeader>
          <DialogTitle>{mode === "login" ? "Log in to Pinch" : "Create your Pinch budget"}</DialogTitle>
          <DialogDescription>Every dollar gets a job — starting today.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-base rounded-md bg-surface-container-low p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setAuthOpen(m)}
              className={`pressable rounded-md px-sm py-2 text-label-bold ${
                mode === m ? "bg-surface-container-lowest text-primary" : "text-on-surface-variant"
              }`}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-md">
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Email
            </label>
            <input
              id="auth-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={field}
            />
            {errors.email && <p className="mt-1 text-label-sm text-error">{errors.email}</p>}
          </div>
          <div>
            <label htmlFor="auth-pw" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
              Password
            </label>
            <input
              id="auth-pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={field}
            />
            {errors.password && <p className="mt-1 text-label-sm text-error">{errors.password}</p>}
          </div>
          <button
            type="submit"
            className="pressable w-full rounded-md bg-primary py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
          >
            {mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
