import { NextResponse } from "next/server";
import { readHookActivity } from "@/lib/demo/hook-activity";

export async function GET() {
  return NextResponse.json({ entries: readHookActivity() });
}
