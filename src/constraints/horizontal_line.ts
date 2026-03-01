import { ConstraintLike, PrimitiveLike } from "../interfaces.js";
import { Line } from "../primitives/line.js";

/** Constrain a line to be horizontal.  loss = 0.5 * dy^2 */
export class HorizontalLine implements ConstraintLike {
    readonly description = "HorizontalLine";

    constructor(private line: Line) { }

    getReferencedPrimitives(): PrimitiveLike[] {
        return [this.line, this.line.start, this.line.end];
    }

    lossValue(): number {
        const dy = this.line.end.y - this.line.start.y;
        return 0.5 * dy * dy;
    }

    updateGradient(): void {
        const dy = this.line.end.y - this.line.start.y;
        this.line.start.addToGradient(0, -dy);
        this.line.end.addToGradient(0, dy);
    }
}
