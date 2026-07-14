import { describe, it, expect } from "vitest";
import { hasNonLatin, isLatinMedia } from "../src/lib/text";

describe("hasNonLatin", () => {
  it("accepte le latin/accents", () => {
    expect(hasNonLatin("Amélie Poulain")).toBe(false);
  });
  it("détecte le japonais", () => expect(hasNonLatin("君の名は")).toBe(true));
  it("détecte le coréen", () => expect(hasNonLatin("오징어 게임")).toBe(true));
  it("détecte le gurmukhî (pendjabi)", () => expect(hasNonLatin("ਸਤਲੁਜ")).toBe(true));
  it("détecte le cyrillique", () => expect(hasNonLatin("Война и мир")).toBe(true));
  it("détecte l'arabe", () => expect(hasNonLatin("مسلسل")).toBe(true));
});

describe("isLatinMedia", () => {
  it("garde un titre latin", () => expect(isLatinMedia({ title: "The Matrix" })).toBe(true));
  it("écarte un titre non-latin", () => expect(isLatinMedia({ name: "ਸਤਲੁਜ" })).toBe(false));
  it("gère title/name manquants", () => expect(isLatinMedia({})).toBe(true));
});
