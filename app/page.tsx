import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";

export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="max-w-3xl mx-auto py-20 px-4">
      <h1 className="text-3xl font-semibold mb-4">Welcome to Pinch</h1>
      <p className="mb-6">Precision budgeting for real life — sign in to continue.</p>
      <div className="flex gap-3">
        <Link href="/login" className="btn-primary">Sign in</Link>
        <Link href="/signup" className="btn-outline">Create account</Link>
      </div>
    </main>
  );
}