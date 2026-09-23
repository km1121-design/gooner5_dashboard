import { describe, expect, it } from "vitest";
import { normalizeEmail, pkceChallenge, safeReturnTo, signOAuthState, signSession, verifyOAuthState, verifySession } from "../session";

const SECRET = "x".repeat(40);

describe("session", () => {
  it("round-trips a signed session", async () => {
    const t = await signSession({ sub: "MEM_001", email: "a@gooner.space" }, SECRET);
    expect(await verifySession(t, SECRET)).toEqual({ sub: "MEM_001", email: "a@gooner.space" });
  });

  it("rejects tampered or foreign tokens", async () => {
    const t = await signSession({ sub: "MEM_001", email: "a@gooner.space" }, SECRET);
    expect(await verifySession(t, "y".repeat(40))).toBeNull();
    expect(await verifySession(t.slice(0, -2) + "xx", SECRET)).toBeNull();
    expect(await verifySession(undefined, SECRET)).toBeNull();
    // OAuth state トークンをセッションとして使い回せない
    const state = await signOAuthState({ state: "s", nonce: "n", verifier: "v", returnTo: "/" }, SECRET);
    expect(await verifySession(state, SECRET)).toBeNull();
    expect((await verifyOAuthState(state, SECRET))?.nonce).toBe("n");
    expect(await verifyOAuthState(t, SECRET)).toBeNull();
  });

  it("rejects expired sessions", async () => {
    const t = await signSession({ sub: "MEM_001", email: "a@gooner.space" }, SECRET, -1);
    expect(await verifySession(t, SECRET)).toBeNull();
  });

  it("requires a long secret", async () => {
    await expect(signSession({ sub: "a", email: "b" }, "short")).rejects.toThrow();
  });

  it("safeReturnTo blocks open redirects", () => {
    expect(safeReturnTo("/?month=2026-09")).toBe("/?month=2026-09");
    expect(safeReturnTo("https://evil.example")).toBe("/");
    expect(safeReturnTo("//evil.example")).toBe("/");
    expect(safeReturnTo("/\\evil.example")).toBe("/");
    expect(safeReturnTo(null)).toBe("/");
  });

  it("PKCE challenge matches RFC 7636 test vector", async () => {
    expect(await pkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("normalizes emails", () => {
    expect(normalizeEmail("  Yushi@Gooner.Space ")).toBe("yushi@gooner.space");
  });
});
