import { drillFromQuery } from "@/lib/flow-report";
import { ReportsRegister } from "./reports-register";

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string | string[];
    flow?: string | string[];
    habit?: string | string[];
    id?: string | string[];
  }>;
}) {
  const query = await searchParams;
  const drill = drillFromQuery({
    view: firstParam(query.view),
    flow: firstParam(query.flow),
    habit: firstParam(query.habit),
    id: firstParam(query.id),
  });

  return (
    <div>
      <div className="page-intro">
        <h1>Posted movement</h1>
        <p className="mars-time">Mars-local ledger</p>
      </div>
      <ReportsRegister drill={drill} />
    </div>
  );
}
