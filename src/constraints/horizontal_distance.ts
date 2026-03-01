import { ConstraintLike, PrimitiveLike } from "../interfaces.js";
import { Point2 } from "../primitives/point2.js";

/** Constrain horizontal distance (x2 - x1) to a target.  loss = 0.5 * err^2 */
export class HorizontalDistanceBetweenPoints implements ConstraintLike {
    readonly description: string;

    constructor(
        private p1: Point2,
        private p2: Point2,
        private desiredDistance: number,
    ) {
        this.description = `HorizontalDistance(${desiredDistance})`;
    }

    getReferencedPrimitives(): PrimitiveLike[] {
        return [this.p1, this.p2];
    }

    lossValue(): number {
        const err = (this.p2.x - this.p1.x) - this.desiredDistance;
        return 0.5 * err * err;
    }

    updateGradient(): void {
        const err = (this.p2.x - this.p1.x) - this.desiredDistance;
        this.p1.addToGradient(-err, 0);
        this.p2.addToGradient(err, 0);
    }
}
