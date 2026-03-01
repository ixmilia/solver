import { ConstraintLike, PrimitiveLike } from "../interfaces.js";
import { Line } from "../primitives/line.js";

/** Constrain a line to be vertical.  loss = 0.5 * dx^2 */
export class VerticalLine implements ConstraintLike {
    readonly description = "VerticalLine";

    constructor(private line: Line) { }

    getReferencedPrimitives(): PrimitiveLike[] {
        return [this.line, this.line.start, this.line.end];
    }

    lossValue(): number {
        const dx = this.line.end.x - this.line.start.x;
        return 0.5 * dx * dx;
    }

    updateGradient(): void {
        const dx = this.line.end.x - this.line.start.x;
        this.line.start.addToGradient(-dx, 0);
        this.line.end.addToGradient(dx, 0);
    }
}
