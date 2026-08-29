import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BankingShell } from "@/components/banking/banking-shell";
import { isDemoSlug } from "@/lib/fixtures";
import { BankProvider } from "@/lib/store";

export default async function BankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const slug = cookieStore.get("marsbank-demo-session")?.value;
  if (!isDemoSlug(slug)) {
    redirect("/login");
  }

  return (
    <BankProvider customerSlug={slug} key={slug}>
      <BankingShell>{children}</BankingShell>
    </BankProvider>
  );
}
