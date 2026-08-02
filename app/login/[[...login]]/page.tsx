import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="mx-auto flex items-center justify-center h-screen p-6">
      <SignIn 
      appearance = {{
        elements: {
          card: "!border !border-outline-variant !shadow-none !bg-surface-container-low !p-6",
          headerTitle: "!text-headline-md !text-on-surface",
          headerSubtitle: "!text-label-sm !text-on-surface-variant",
          formFieldInput: "!bg-surface-container-lowest !text-on-surface !placeholder:text-on-surface-variant",
          formFieldLabel: "!text-label-bold !text-on-surface",
          formButtonPrimary: '!bg-primary !text-on-primary !hover:bg-primary-container',
          formButtonSecondary: "!bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low",
          footerActionText: "!text-label-bold !text-on-surface-variant",
        },
      }}
      path="/login" routing="path" />
    </div>
  );
}