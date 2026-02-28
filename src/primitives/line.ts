import { DVector } from "../dvector.js";
import { PrimitiveLike } from "../interfaces.js";
import { Point2 } from "./point2.js";

/**
 * A zero-DOF line primitive that references two points (mirrors Rust Line).
 * It carries no independent data; gradients flow through to its endpoints.
 */
export class Line implements PrimitiveLike {
    constructor(
        public readonly start: Point2,
        public readonly end: Point2,
    ) { }

    getDataLength(): number {
        return 0;
    }

    getData(): DVector {
        return DVector.zeros(0);
    }

    setData(_data: DVector): void {
        /* no-op */
    }

    getGradient(): DVector {
        return DVector.zeros(0);
    }

    zeroGradient(): void {
        /* referenced points zero their own gradients */
    }
}
