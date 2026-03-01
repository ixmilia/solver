import { DVector } from "./dvector.js";

/**
 * Interface matching the PrimitiveLike trait from Rust.
 * Each primitive holds its own data and gradient vectors.
 */
export interface PrimitiveLike {
    /** Returns the number of scalar parameters for this primitive. */
    getDataLength(): number;

    /** Returns a copy of the parameter data for this primitive. */
    getData(): DVector;

    /** Overwrites the parameter data for this primitive. */
    setData(data: DVector): void;

    /** Returns a copy of the accumulated gradient for this primitive. */
    getGradient(): DVector;

    /** Resets the gradient to zero. */
    zeroGradient(): void;
}

/**
 * Interface matching the ConstraintLike trait from Rust.
 */
export interface ConstraintLike {
    /** Returns the scalar loss value for this constraint. */
    lossValue(): number;

    /**
     * Computes the gradient of this constraint's loss and adds it
     * to the referenced primitives' gradient accumulators.
     */
    updateGradient(): void;

    /** Returns a short human-readable description of this constraint. */
    readonly description: string;

    /** Returns the primitives directly referenced by this constraint. */
    getReferencedPrimitives(): PrimitiveLike[];
}
