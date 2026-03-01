import { ConstraintLike, PrimitiveLike } from "../interfaces.js";
import { Point2 } from "../primitives/point2.js";

/** Constrain vertical distance (y2 - y1) to a target.  loss = 0.5 * err^2 */
export class VerticalDistanceBetweenPoints implements ConstraintLike {
    readonly description: string;

    constructor(
        private p1: Point2,
        private p2: Point2,
        private _desiredDistance: number,
    ) {
        this.description = `VerticalDistance(${_desiredDistance})`;
    }

    get desiredDistance(): number { return this._desiredDistance; }

    getReferencedPrimitives(): PrimitiveLike[] {
        return [this.p1, this.p2];
    }

    lossValue(): number {
        const err = (this.p2.y - this.p1.y) - this._desiredDistance;
        return 0.5 * err * err;
    }

    updateGradient(): void {
        const err = (this.p2.y - this.p1.y) - this._desiredDistance;
        this.p1.addToGradient(0, -err);
        this.p2.addToGradient(0, err);
    }
}
