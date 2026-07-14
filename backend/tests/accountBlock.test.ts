import { describe, it, expect } from "vitest";
import { accountBlockMessage } from "../src/lib/accountStatus";

const future = new Date(Date.now() + 86400000);
const past = new Date(Date.now() - 86400000);

describe("accountBlockMessage", () => {
  it("bloque un compte banni", () => {
    expect(accountBlockMessage({ bannedAt: new Date(), suspendedUntil: null })).toMatch(/banni/i);
  });
  it("bloque une suspension en cours", () => {
    expect(accountBlockMessage({ bannedAt: null, suspendedUntil: future })).toMatch(/suspendu/i);
  });
  it("laisse passer une suspension expirée", () => {
    expect(accountBlockMessage({ bannedAt: null, suspendedUntil: past })).toBeNull();
  });
  it("laisse passer un compte sain", () => {
    expect(accountBlockMessage({ bannedAt: null, suspendedUntil: null })).toBeNull();
  });
});
