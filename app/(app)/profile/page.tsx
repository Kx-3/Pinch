"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { useUser, SignInButton } from "@clerk/nextjs";

export default function ProfilePage() {
  const { user } = useUser();
  const [name, setName] = useState(user?.fullName ?? "");
  const [email, setEmail] = useState(user?.emailAddresses?.[0]?.emailAddress ?? "");
  const [error, setError] = useState("");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name can't be empty.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
    setError("");
    toast.success("Profile saved", { description: "Changes are local until the backend is wired up." });
  };

  const field =
    "w-full rounded-md border border-outline-variant bg-surface-container-low px-sm py-2 text-label-bold font-normal outline-none transition-colors duration-150 focus:border-primary";

  if (!user) {
    return (
      <AppShell title="Profile" subtitle="You're signed out.">
        <SignInButton mode="modal">
          <button className="pressable rounded-md bg-primary px-md py-2.5 font-label-bold text-on-primary hover:bg-primary-container">
            Log in
          </button>
        </SignInButton>
      </AppShell>
    );
  }

  return (
    <AppShell title="Profile" subtitle="Who's pinching the pennies.">
      <form onSubmit={save} className="ghost-border max-w-[28rem] space-y-md rounded-lg bg-surface-container-lowest p-md">
        <div>
          <label htmlFor="name" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Name
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-label-sm uppercase text-on-surface-variant">
            Email
          </label>
          <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
        </div>
        {error && <p className="text-label-sm text-error">{error}</p>}
        <button
          type="submit"
          className="pressable rounded-md bg-primary px-md py-2.5 font-label-bold text-on-primary hover:bg-primary-container"
        >
          Save changes
        </button>
      </form>
    </AppShell>
  );
}
