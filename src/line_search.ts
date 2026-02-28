import { DVector } from "./dvector.js";
import { Sketch } from "./sketch.js";

/**
 * Error thrown when the search direction is not a descent direction.
 */
export class NotDescentDirectionError extends Error {
    constructor() {
        super("line search failed: search direction is not a descent direction");
        this.name = "NotDescentDirectionError";
    }
}

/**
 * Error thrown when the line search cannot find a suitable step size.
 */
export class LineSearchFailedError extends Error {
    constructor() {
        super("line search failed: could not find a suitable step size");
        this.name = "LineSearchFailedError";
    }
}

const WOLFE_C1 = 1e-4;
const WOLFE_C2 = 0.9;
const MAX_ITER = 15;

/**
 * Performs a line search satisfying the strong Wolfe conditions.
 *
 * This is a direct port of the Rust `line_search_wolfe` function.
 *
 * @param sketch    The sketch whose data is mutated during the search.
 * @param direction The search direction vector.
 * @param gradient  The current gradient vector.
 * @returns         The step size alpha satisfying the Wolfe conditions.
 * @throws {NotDescentDirectionError} If `direction` is not a descent direction.
 * @throws {LineSearchFailedError}    If no suitable step size is found.
 */
export function lineSearchWolfe(
    sketch: Sketch,
    direction: DVector,
    gradient: DVector,
): number {
    let alpha = 1.0;
    const m = gradient.dot(direction);

    if (m >= 0.0) {
        throw new NotDescentDirectionError();
    }

    const curvatureCondition = WOLFE_C2 * m;
    const loss = sketch.getLoss();
    const x0 = sketch.getData();

    for (let i = 0; i < MAX_ITER; i++) {
        // data = x0 + alpha * direction
        const data = x0.addScaled(direction, alpha);
        sketch.setData(data);

        const newLoss = sketch.getLoss();

        // Sufficient decrease condition (Armijo)
        if (newLoss <= loss + WOLFE_C1 * alpha * m) {
            // Curvature condition
            const newGradient = sketch.getGradient();
            const curvature = newGradient.dot(direction);

            if (curvature >= curvatureCondition) {
                return alpha;
            }
            alpha *= 1.5;
        } else {
            alpha *= 0.5;
        }
    }

    throw new LineSearchFailedError();
}
