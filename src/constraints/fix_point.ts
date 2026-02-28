import { ConstraintLike } from "../interfaces.js";
import { Point2 } from "../primitives/point2.js";

/** Fix a point to a desired position.  loss = 0.5 * |p - target|^2 */
export class FixPoint implements ConstraintLike {
    constructor(
        private point: Point2,
        private tx: number,
        private ty: number,
    ) { }

    lossValue(): number {
        const dx = this.point.x - this.tx;
        const dy = this.point.y - this.ty;
        return 0.5 * (dx * dx + dy * dy);
    }

    updateGradient(): void {
        const dx = this.point.x - this.tx;
        const dy = this.point.y - this.ty;
        this.point.addToGradient(dx, dy);
    }
}
