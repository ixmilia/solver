/**
 * A simple dynamic vector class that mirrors the nalgebra DVector<f64> operations
 * used by the gradient-based solver.
 */
export class DVector {
    public data: Float64Array;

    constructor(data: Float64Array | number[]) {
        this.data = data instanceof Float64Array ? data : new Float64Array(data);
    }

    static zeros(len: number): DVector {
        return new DVector(new Float64Array(len));
    }

    get length(): number {
        return this.data.length;
    }

    get(i: number): number {
        return this.data[i];
    }

    set(i: number, value: number): void {
        this.data[i] = value;
    }

    /** Returns the Euclidean (L2) norm. */
    norm(): number {
        let sum = 0;
        for (let i = 0; i < this.data.length; i++) {
            sum += this.data[i] * this.data[i];
        }
        return Math.sqrt(sum);
    }

    /** Dot product with another vector. */
    dot(other: DVector): number {
        let sum = 0;
        for (let i = 0; i < this.data.length; i++) {
            sum += this.data[i] * other.data[i];
        }
        return sum;
    }

    /** Returns a negated copy of this vector. */
    negate(): DVector {
        const result = new Float64Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            result[i] = -this.data[i];
        }
        return new DVector(result);
    }

    /** Returns a new vector: a*x + b*this  (mirrors nalgebra's axpy). */
    axpy(a: number, x: DVector, b: number): DVector {
        const result = new Float64Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            result[i] = a * x.data[i] + b * this.data[i];
        }
        return new DVector(result);
    }

    /** Element-wise addition: this + scalar * other. */
    addScaled(other: DVector, scalar: number): DVector {
        const result = new Float64Array(this.data.length);
        for (let i = 0; i < this.data.length; i++) {
            result[i] = this.data[i] + scalar * other.data[i];
        }
        return new DVector(result);
    }

    /** Returns a copy of this vector. */
    clone(): DVector {
        return new DVector(new Float64Array(this.data));
    }

    /** Copy values from a sub-range of `source` into this vector starting at `offset`. */
    copyFrom(offset: number, source: DVector): void {
        for (let i = 0; i < source.length; i++) {
            this.data[offset + i] = source.data[i];
        }
    }

    /** Returns a sub-vector view (copy) starting at `offset` with the given `length`. */
    slice(offset: number, length: number): DVector {
        return new DVector(new Float64Array(this.data.buffer.slice(
            offset * Float64Array.BYTES_PER_ELEMENT,
            (offset + length) * Float64Array.BYTES_PER_ELEMENT,
        )));
    }
}
