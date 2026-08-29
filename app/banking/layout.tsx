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
      <span
        dangerouslySetInnerHTML={{
          __html: `<!-- THESIS: The post-login bank is an account desk, one white ledger on a quiet canvas, refusing the condensed all-caps coordinate register that made a daily task read as an instrument panel. OWN-WORLD: #F2F3F5 canvas, white ledger cards with 1px #E3E5E4 rules and 6px corners, graphite #101518 top bar and icon rail, oxide #E4623F for the one primary action, signal #356CFF for available amounts and credits, Hanken Grotesk throughout in sentence case with 11px tracked column labels the only uppercase. STORY: Cameron reads one available total, scans every account on shared columns, checks recent movement, then searches or transfers. FIRST VIEWPORT: full-width graphite bar carrying the orbital lockup, universal search, customer and log out; labelled icon rail at left; greeting and sol line opposite the available total and oxide transfer; one white accounts table closing on a reconciled totals row; recent movements beneath. FORM: Search-led Account Desk, surface option 3 of 6, seed e8279d3a. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance -->`,
        }}
      />
      <BankingShell>{children}</BankingShell>
    </BankProvider>
  );
}
