import { DVector } from "./dvector.js";
import { PrimitiveLike, ConstraintLike } from "./interfaces.js";

/**
 * A minimal Sketch class that mirrors the Rust Sketch API surface needed
 * by the gradient-based solver: getData, setData, getLoss, getGradient.
 */
export class Sketch {
    private primitives: Map<number, PrimitiveLike> = new Map();
    private primitivesNextId = 0;
    private constraints: ConstraintLike[] = [];

    addPrimitive(primitive: PrimitiveLike): number {
        const id = this.primitivesNextId++;
        this.primitives.set(id, primitive);
        return id;
    }

    /** Remove a primitive by reference. Returns true if found and removed. */
    removePrimitive(primitive: PrimitiveLike): boolean {
        for (const [id, p] of this.primitives) {
            if (p === primitive) {
                this.primitives.delete(id);
                return true;
            }
        }
        return false;
    }

    /**
     * Find all primitives that directly depend on the given primitive.
     * For example, Lines that reference a Point2 as start or end.
     */
    getDependents(primitive: PrimitiveLike): PrimitiveLike[] {
        const deps: PrimitiveLike[] = [];
        for (const p of this.primitives.values()) {
            // Check if p has start/end references matching the target
            const any = p as any;
            if (any.start === primitive || any.end === primitive || any.center === primitive) {
                deps.push(p);
            }
        }
        return deps;
    }

    addConstraint(constraint: ConstraintLike): void {
        this.constraints.push(constraint);
    }

    /** Remove a constraint by reference. Returns true if found and removed. */
    removeConstraint(constraint: ConstraintLike): boolean {
        const idx = this.constraints.indexOf(constraint);
        if (idx >= 0) {
            this.constraints.splice(idx, 1);
            return true;
        }
        return false;
    }

    /** Returns all constraints that directly reference the given primitive. */
    getConstraintsOnPrimitive(primitive: PrimitiveLike): ConstraintLike[] {
        return this.constraints.filter(c =>
            c.getReferencedPrimitives().includes(primitive)
        );
    }

    /** Returns an iterator over all registered primitives. */
    getPrimitives(): IterableIterator<PrimitiveLike> {
        return this.primitives.values();
    }

    /** Returns an iterator over all [id, primitive] entries. */
    getPrimitiveEntries(): IterableIterator<[number, PrimitiveLike]> {
        return this.primitives.entries();
    }

    /** Returns the id assigned to the given primitive, or undefined if not found. */
    getPrimitiveId(primitive: PrimitiveLike): number | undefined {
        for (const [id, p] of this.primitives) {
            if (p === primitive) return id;
        }
        return undefined;
    }

    /** Returns all registered constraints. */
    getConstraints(): ReadonlyArray<ConstraintLike> {
        return this.constraints;
    }

    /** Total number of scalar degrees of freedom across all primitives. */
    getNDofs(): number {
        let n = 0;
        for (const p of this.primitives.values()) {
            n += p.getDataLength();
        }
        return n;
    }

    /** Collects all primitive data into a single flat vector. */
    getData(): DVector {
        const data = DVector.zeros(this.getNDofs());
        let offset = 0;
        for (const p of this.primitives.values()) {
            const pData = p.getData();
            data.copyFrom(offset, pData);
            offset += pData.length;
        }
        return data;
    }

    /** Distributes a flat data vector back into each primitive. */
    setData(data: DVector): void {
        let offset = 0;
        for (const p of this.primitives.values()) {
            const n = p.getDataLength();
            p.setData(data.slice(offset, n));
            offset += n;
        }
    }

    /** Sum of all constraint losses. */
    getLoss(): number {
        let loss = 0;
        for (const c of this.constraints) {
            loss += c.lossValue();
        }
        return loss;
    }

    /** Computes the aggregated gradient across all constraints and primitives. */
    getGradient(): DVector {
        // Zero all primitive gradients
        for (const p of this.primitives.values()) {
            p.zeroGradient();
        }

        // Accumulate gradients from each constraint
        for (const c of this.constraints) {
            c.updateGradient();
        }

        // Collect into a single vector
        const gradient = DVector.zeros(this.getNDofs());
        let offset = 0;
        for (const p of this.primitives.values()) {
            const pGrad = p.getGradient();
            gradient.copyFrom(offset, pGrad);
            offset += pGrad.length;
        }
        return gradient;
    }
}
