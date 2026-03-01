export { DVector } from "./dvector.js";
export { PrimitiveLike, ConstraintLike } from "./interfaces.js";
export { Sketch } from "./sketch.js";
export { Solver } from "./solver.js";
export { GradientBasedSolver } from "./gradient_based_solver.js";
export {
    lineSearchWolfe,
    NotDescentDirectionError,
    LineSearchFailedError,
} from "./line_search.js";
export { Point2 } from "./primitives/point2.js";
export { Line } from "./primitives/line.js";
export { Circle } from "./primitives/circle.js";
export { Arc } from "./primitives/arc.js";
export { FixPoint } from "./constraints/fix_point.js";
export { HorizontalLine } from "./constraints/horizontal_line.js";
export { VerticalLine } from "./constraints/vertical_line.js";
export { HorizontalDistanceBetweenPoints } from "./constraints/horizontal_distance.js";
export { VerticalDistanceBetweenPoints } from "./constraints/vertical_distance.js";
export { Viewport } from "./viewport.js";

import { Viewport } from "./viewport.js";

export function main(canvas?: HTMLCanvasElement): void {
    if (canvas) {
        new Viewport(canvas);
    }
}
