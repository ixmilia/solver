import { DVector } from "../dvector.js";
import { PrimitiveLike } from "../interfaces.js";

/** A 2-DOF point primitive. */
export class Point2 implements PrimitiveLike {
    private _x: number;
    private _y: number;
    private gradX = 0;
    private gradY = 0;

    constructor(x: number, y: number) {
        this._x = x;
        this._y = y;
    }

    getDataLength(): number {
        return 2;
    }

    getData(): DVector {
        return new DVector([this._x, this._y]);
    }

    setData(data: DVector): void {
        this._x = data.get(0);
        this._y = data.get(1);
    }

    getGradient(): DVector {
        return new DVector([this.gradX, this.gradY]);
    }

    zeroGradient(): void {
        this.gradX = 0;
        this.gradY = 0;
    }

    addToGradient(dx: number, dy: number): void {
        this.gradX += dx;
        this.gradY += dy;
    }

    get x(): number {
        return this._x;
    }
    set x(value: number) {
        this._x = value;
    }

    get y(): number {
        return this._y;
    }
    set y(value: number) {
        this._y = value;
    }
}
