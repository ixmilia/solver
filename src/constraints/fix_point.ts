import { ConstraintLike, PrimitiveLike } from "../interfaces.js";
import { Point2 } from "../primitives/point2.js";

/** Format a number with up to 2 decimal places, stripping trailing zeros. */
function formatValue(v: number): string {
    return parseFloat(v.toFixed(2)).toString();
}

/** Fix a point to a desired position.  loss = 0.5 * |p - target|^2 */
export class FixPoint implements ConstraintLike {
    get description(): string {
        return `FixPoint(${formatValue(this.tx)}, ${formatValue(this.ty)})`;
    }

    constructor(
        private point: Point2,
        private _tx: number,
        private _ty: number,
    ) { }

    get tx(): number { return this._tx; }
    set tx(value: number) { this._tx = value; }

    get ty(): number { return this._ty; }
    set ty(value: number) { this._ty = value; }

    getReferencedPrimitives(): PrimitiveLike[] {
        return [this.point];
    }

    lossValue(): number {
        const dx = this.point.x - this._tx;
        const dy = this.point.y - this._ty;
        return 0.5 * (dx * dx + dy * dy);
    }

    updateGradient(): void {
        const dx = this.point.x - this._tx;
        const dy = this.point.y - this._ty;
        this.point.addToGradient(dx, dy);
    }
}
