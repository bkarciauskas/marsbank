import { PublicHeader } from "@/components/public/public-header";
import { DemoConsole } from "@/components/demo/demo-console";

export const metadata = {
  title: "Demo control",
};

export default function DemoPage() {
  return (
    <>
      <PublicHeader />
      <main className="demo-page">
        <DemoConsole />
      </main>
    </>
  );
}
