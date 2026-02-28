import { DVector } from "../dvector.js";
import { PrimitiveLike } from "../interfaces.js";
import { Point2 } from "./point2.js";

/**
 * A 1-DOF circle primitive that references a center point.
 * Its single independent parameter is the radius;
 * the center position flows through Point2.
 */
export class Circle implements PrimitiveLike {
    private _radius: number;
    private gradRadius = 0;

    constructor(
        public readonly center: Point2,
        radius: number,
    ) {
        this._radius = radius;
    }

    getDataLength(): number {
        return 1;
    }

    getData(): DVector {
        return new DVector([this._radius]);
    }

    setData(data: DVector): void {
        this._radius = data.get(0);
    }

    getGradient(): DVector {
        return new DVector([this.gradRadius]);
    }

    zeroGradient(): void {
        this.gradRadius = 0;
    }

    get radius(): number {
        return this._radius;
    }

    set radius(value: number) {
        this._radius = value;
    }

    /**
     * Accumulate gradient contributions.
     * The full gradient row is [dcx, dcy, dr] (length 3).
     * dcx/dcy are forwarded to the center Point2; dr stays here.
     */
    addToGradient(dcx: number, dcy: number, dr: number): void {
        this.center.addToGradient(dcx, dcy);
        this.gradRadius += dr;
    }
}
