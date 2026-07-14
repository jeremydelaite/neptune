import { describe, it, expect } from "vitest";
import { containsProfanity } from "../src/lib/moderation";

describe("containsProfanity", () => {
  it("détecte un gros mot évident", () => {
    expect(containsProfanity("espèce de connard")).toBe(true);
  });
  it("détecte l'anglais", () => {
    expect(containsProfanity("what the fuck")).toBe(true);
  });
  it("détecte le contournement par espacement", () => {
    expect(containsProfanity("c o n n a r d")).toBe(true);
  });
  it("détecte le leet (0/1/3/4)", () => {
    expect(containsProfanity("encul3")).toBe(true);
  });
  it("laisse passer un texte normal", () => {
    expect(containsProfanity("super film, une intrigue passionnante")).toBe(false);
  });
  it("ne se déclenche pas sur un mot sain contenant des lettres proches", () => {
    expect(containsProfanity("j'adore la culture japonaise")).toBe(false);
  });
});
