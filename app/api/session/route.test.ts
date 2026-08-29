import { describe, expect, it } from "vitest";
import { demoEmail, demoPassword } from "@/lib/fixtures";
import { DELETE, POST } from "./route";

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/session", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }),
  );
}

describe("session route", () => {
  it("sets the demo cookie for the fictional credentials", async () => {
    const response = await post({ email: demoEmail, password: demoPassword });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(response.cookies.get("marsbank-demo-session")?.value).toBe("cameron");
  });

  it("sets a session for another roster resident", async () => {
    const response = await post({
      email: "blake@marsbank.mars",
      password: "Elysium!2026",
    });
    expect(response.status).toBe(200);
    expect(response.cookies.get("marsbank-demo-session")?.value).toBe("blake");
  });

  it("rejects a wrong password without setting a session", async () => {
    const response = await post({ email: demoEmail, password: "wrong" });
    expect(response.status).toBe(401);
    expect(response.cookies.get("marsbank-demo-session")?.value).toBeUndefined();
  });

  it("clears the demo cookie on logout", async () => {
    const response = await DELETE();
    expect(response.status).toBe(200);
    expect(response.cookies.get("marsbank-demo-session")?.value).toBe("");
  });
});
