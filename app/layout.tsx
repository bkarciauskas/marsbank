import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource/saira/400.css";
import "@fontsource/saira/600.css";
import "@fontsource/saira-extra-condensed/600.css";
import "@fontsource/saira-extra-condensed/700.css";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Mars Bank",
    template: "%s | Mars Bank",
  },
  description:
    "Mars-local banking for residents, habitats and enterprises, measured in model tokens.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" data-theme="dark" lang="en" suppressHydrationWarning>
      <body>
        <Script id="marsbank-theme" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
        <span
          dangerouslySetInnerHTML={{
            __html: `<!-- THESIS: Mars Bank plots frontier finance as one exact coordinate register, refusing both conservative bank cards and space-game HUD. OWN-WORLD: graphite #101518 ground (default) or dust #EFE6DA paper (light); survey mint #DCE8E6 type on graphite only; oxide #E4623F; signal #356CFF / #2454D6 on dust; one-pixel survey rules; condensed Saira; orbital-arc lockup. STORY: Cameron reads the total position, scans every account on shared columns, checks recent movement, then transfers or opens an account. FIRST VIEWPORT: retained graphite navigation at left on a graphite stage; greeting and sol line above a full-width blue total; continuous account ledger left and dated movement rail right; oxide transfer action in the position band. FORM: Cross-account Coordinate Register, position 4, seed f9b4cea0. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md -->`,
          }}
        />
        {children}
      </body>
    </html>
  );
}
