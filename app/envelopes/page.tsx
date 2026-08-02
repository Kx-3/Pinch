import { AppShell } from "@/components/layout/AppShell";
import { EnvelopeBoard } from "@/components/dashboard/EnvelopeBoard";

export default function EnvelopesPage() {
  return (
    <AppShell title="Categories" subtitle="Filter, sort and fund every category.">
      <EnvelopeBoard />
    </AppShell>
  );
}
