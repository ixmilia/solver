import { DVector } from "../dvector.js";
import { PrimitiveLike } from "../interfaces.js";
import { Point2 } from "./point2.js";

/**
 * A 3-DOF arc primitive that references a center point.
 * Independent parameters: [radius, startAngle, endAngle].
 * The center position flows through Point2.
 */
export class Arc implements PrimitiveLike {
    private _radius: number;
    private _startAngle: number;
    private _endAngle: number;

    private gradRadius = 0;
    private gradStartAngle = 0;
    private gradEndAngle = 0;

    private _clockwise: boolean;

    constructor(
        public readonly center: Point2,
        radius: number,
        clockwise: boolean,
        startAngle: number,
        endAngle: number,
    ) {
        this._radius = radius;
        this._clockwise = clockwise;
        this._startAngle = startAngle;
        this._endAngle = endAngle;
    }

    // ── PrimitiveLike ──────────────────────────────────────────

    getDataLength(): number {
        return 3;
    }

    getData(): DVector {
        return new DVector([this._radius, this._startAngle, this._endAngle]);
    }

    setData(data: DVector): void {
        this._radius = data.get(0);
        this._startAngle = data.get(1);
        this._endAngle = data.get(2);
    }

    getGradient(): DVector {
        return new DVector([this.gradRadius, this.gradStartAngle, this.gradEndAngle]);
    }

    zeroGradient(): void {
        this.gradRadius = 0;
        this.gradStartAngle = 0;
        this.gradEndAngle = 0;
    }

    // ── Accessors ──────────────────────────────────────────────

    get radius(): number {
        return this._radius;
    }

    set radius(value: number) {
        this._radius = value;
    }

    get startAngle(): number {
        return this._startAngle;
    }

    set startAngle(value: number) {
        this._startAngle = value;
    }

    get endAngle(): number {
        return this._endAngle;
    }

    set endAngle(value: number) {
        this._endAngle = value;
    }

    get clockwise(): boolean {
        return this._clockwise;
    }

    set clockwise(value: boolean) {
        this._clockwise = value;
    }

    // ── Derived geometry ───────────────────────────────────────

    /** Returns [x, y] of the start point on the arc. */
    startPoint(): [number, number] {
        const cx = this.center.x;
        const cy = this.center.y;
        return [
            cx + this._radius * Math.cos(this._startAngle),
            cy + this._radius * Math.sin(this._startAngle),
        ];
    }

    /** Returns [x, y] of the end point on the arc. */
    endPoint(): [number, number] {
        const cx = this.center.x;
        const cy = this.center.y;
        return [
            cx + this._radius * Math.cos(this._endAngle),
            cy + this._radius * Math.sin(this._endAngle),
        ];
    }

    /** Returns a new Arc with the direction reversed and start/end swapped. */
    reverse(): Arc {
        return new Arc(
            this.center,
            this._radius,
            !this._clockwise,
            this._endAngle,
            this._startAngle,
        );
    }

    // ── Gradient accumulation ──────────────────────────────────

    /**
     * Accumulate gradient contributions.
     * The full gradient row is [dcx, dcy, dr, dsa, dea] (length 5).
     * dcx/dcy are forwarded to the center Point2; the rest stay here.
     */
    addToGradient(dcx: number, dcy: number, dr: number, dsa: number, dea: number): void {
        this.center.addToGradient(dcx, dcy);
        this.gradRadius += dr;
        this.gradStartAngle += dsa;
        this.gradEndAngle += dea;
    }
}
