import { describe, expect, it } from "vitest";
import { demoPasswordValue } from "./env.js";

describe("demo password env values", () => {
  it("keeps a hash inside quoted and unquoted passwords", () => {
    expect(demoPasswordValue('"BookLeaf#Admin1"')).toBe("BookLeaf#Admin1");
    expect(demoPasswordValue("'BookLeaf#Author1'")).toBe("BookLeaf#Author1");
    expect(demoPasswordValue("BookLeaf#Author1")).toBe("BookLeaf#Author1");
  });
});