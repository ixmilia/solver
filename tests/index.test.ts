import { describe, it, expect } from "vitest";
import { greet } from "../src/index";

describe("greet", () => {
    it("should return a greeting with the given name", () => {
        expect(greet("World")).toBe("Hello, World!");
    });
});
