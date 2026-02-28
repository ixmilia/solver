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

    addConstraint(constraint: ConstraintLike): void {
        this.constraints.push(constraint);
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
