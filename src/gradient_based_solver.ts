import { Solver } from "./solver.js";
import { Sketch } from "./sketch.js";
import { lineSearchWolfe } from "./line_search.js";

/**
 * A gradient-descent solver with Wolfe-condition line search.
 *
 * This is a direct port of the Rust `GradientBasedSolver`.
 */
export class GradientBasedSolver implements Solver {
    private maxIterations: number;
    private minLoss: number;
    private minGrad: number;

    constructor(
        maxIterations = 10_000,
        minLoss = 1e-14,
        minGrad = 1e-10,
    ) {
        this.maxIterations = maxIterations;
        this.minLoss = minLoss;
        this.minGrad = minGrad;
    }

    /**
     * Iteratively moves the sketch parameters in the steepest-descent direction
     * until the gradient norm or total loss drops below the configured thresholds,
     * or the iteration limit is reached.
     */
    solve(sketch: Sketch): void {
        let iterations = 0;

        let gradient = sketch.getGradient();
        let gradNorm = gradient.norm();
        let loss = sketch.getLoss();

        while (iterations < this.maxIterations) {
            if (gradNorm < this.minGrad) {
                break;
            }
            if (loss < this.minLoss) {
                break;
            }

            let data = sketch.getData();

            const direction = gradient.negate();
            const alpha = lineSearchWolfe(sketch, direction, gradient);

            // data = data + alpha * direction  (equivalent to nalgebra's axpy)
            data = data.axpy(alpha, direction, 1.0);
            sketch.setData(data);

            // Update metrics
            loss = sketch.getLoss();
            gradient = sketch.getGradient();
            gradNorm = gradient.norm();

            iterations++;
        }
    }
}
