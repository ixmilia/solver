import { Sketch } from "./sketch.js";

/**
 * Common solver interface matching the Rust Solver trait.
 */
export interface Solver {
    solve(sketch: Sketch): void;
}
