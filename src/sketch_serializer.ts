import { Sketch } from "./sketch.js";
import { PrimitiveLike, ConstraintLike } from "./interfaces.js";
import { Point2 } from "./primitives/point2.js";
import { Line } from "./primitives/line.js";
import { Circle } from "./primitives/circle.js";
import { Arc } from "./primitives/arc.js";
import { FixPoint } from "./constraints/fix_point.js";
import { HorizontalLine } from "./constraints/horizontal_line.js";
import { VerticalLine } from "./constraints/vertical_line.js";
import { HorizontalDistanceBetweenPoints } from "./constraints/horizontal_distance.js";
import { VerticalDistanceBetweenPoints } from "./constraints/vertical_distance.js";

// ── JSON schema types ──────────────────────────────────────

export interface SketchJson {
    primitives: PrimitiveJson[];
    constraints: ConstraintJson[];
}

export type PrimitiveJson =
    | { id: number; type: "point"; x: number; y: number }
    | { id: number; type: "line"; start: number; end: number }
    | { id: number; type: "circle"; center: number; radius: number }
    | { id: number; type: "arc"; center: number; radius: number; clockwise: boolean; startAngle: number; endAngle: number };

export type ConstraintJson =
    | { type: "fix_point"; point: number; tx: number; ty: number }
    | { type: "horizontal_line"; line: number }
    | { type: "vertical_line"; line: number }
    | { type: "horizontal_distance"; p1: number; p2: number; distance: number }
    | { type: "vertical_distance"; p1: number; p2: number; distance: number };

// ── Serialize ──────────────────────────────────────────────

/** Serialize a Sketch to a plain JSON-compatible object. */
export function serializeSketch(sketch: Sketch): SketchJson {
    const primitives: PrimitiveJson[] = [];
    const idOf = (prim: PrimitiveLike): number => {
        const id = sketch.getPrimitiveId(prim);
        if (id === undefined) {
            throw new Error("Primitive not found in sketch");
        }
        return id;
    };

    for (const [id, prim] of sketch.getPrimitiveEntries()) {
        if (prim instanceof Point2) {
            primitives.push({ id, type: "point", x: prim.x, y: prim.y });
        } else if (prim instanceof Line) {
            primitives.push({ id, type: "line", start: idOf(prim.start), end: idOf(prim.end) });
        } else if (prim instanceof Circle) {
            primitives.push({ id, type: "circle", center: idOf(prim.center), radius: prim.radius });
        } else if (prim instanceof Arc) {
            primitives.push({
                id,
                type: "arc",
                center: idOf(prim.center),
                radius: prim.radius,
                clockwise: prim.clockwise,
                startAngle: prim.startAngle,
                endAngle: prim.endAngle,
            });
        }
    }

    const constraints: ConstraintJson[] = [];
    for (const c of sketch.getConstraints()) {
        if (c instanceof FixPoint) {
            const refs = c.getReferencedPrimitives();
            constraints.push({ type: "fix_point", point: idOf(refs[0]), tx: c.tx, ty: c.ty });
        } else if (c instanceof HorizontalLine) {
            const refs = c.getReferencedPrimitives();
            // refs[0] is the line itself
            constraints.push({ type: "horizontal_line", line: idOf(refs[0]) });
        } else if (c instanceof VerticalLine) {
            const refs = c.getReferencedPrimitives();
            constraints.push({ type: "vertical_line", line: idOf(refs[0]) });
        } else if (c instanceof HorizontalDistanceBetweenPoints) {
            const refs = c.getReferencedPrimitives();
            constraints.push({
                type: "horizontal_distance",
                p1: idOf(refs[0]),
                p2: idOf(refs[1]),
                distance: c.desiredDistance,
            });
        } else if (c instanceof VerticalDistanceBetweenPoints) {
            const refs = c.getReferencedPrimitives();
            constraints.push({
                type: "vertical_distance",
                p1: idOf(refs[0]),
                p2: idOf(refs[1]),
                distance: c.desiredDistance,
            });
        }
    }

    return { primitives, constraints };
}

/** Serialize a Sketch to a JSON string. */
export function serializeSketchToString(sketch: Sketch): string {
    return JSON.stringify(serializeSketch(sketch));
}

// ── Deserialize ────────────────────────────────────────────

/** Deserialize a plain JSON object into a Sketch. */
export function deserializeSketch(json: SketchJson): Sketch {
    const sketch = new Sketch();
    const primById = new Map<number, PrimitiveLike>();

    const getPoint = (id: number): Point2 => {
        const p = primById.get(id);
        if (!p || !(p instanceof Point2)) {
            throw new Error(`Expected Point2 at id ${id}`);
        }
        return p;
    };

    const getLine = (id: number): Line => {
        const p = primById.get(id);
        if (!p || !(p instanceof Line)) {
            throw new Error(`Expected Line at id ${id}`);
        }
        return p;
    };

    // First pass: create all Point2 primitives (they have no references)
    for (const pj of json.primitives) {
        if (pj.type === "point") {
            const p = new Point2(pj.x, pj.y);
            sketch.addPrimitive(p);
            primById.set(pj.id, p);
        }
    }

    // Second pass: create reference-based primitives (Line, Circle, Arc)
    for (const pj of json.primitives) {
        if (pj.type === "line") {
            const line = new Line(getPoint(pj.start), getPoint(pj.end));
            sketch.addPrimitive(line);
            primById.set(pj.id, line);
        } else if (pj.type === "circle") {
            const circle = new Circle(getPoint(pj.center), pj.radius);
            sketch.addPrimitive(circle);
            primById.set(pj.id, circle);
        } else if (pj.type === "arc") {
            const arc = new Arc(getPoint(pj.center), pj.radius, pj.clockwise, pj.startAngle, pj.endAngle);
            sketch.addPrimitive(arc);
            primById.set(pj.id, arc);
        }
    }

    // Create constraints
    for (const cj of json.constraints) {
        switch (cj.type) {
            case "fix_point":
                sketch.addConstraint(new FixPoint(getPoint(cj.point), cj.tx, cj.ty));
                break;
            case "horizontal_line":
                sketch.addConstraint(new HorizontalLine(getLine(cj.line)));
                break;
            case "vertical_line":
                sketch.addConstraint(new VerticalLine(getLine(cj.line)));
                break;
            case "horizontal_distance":
                sketch.addConstraint(new HorizontalDistanceBetweenPoints(getPoint(cj.p1), getPoint(cj.p2), cj.distance));
                break;
            case "vertical_distance":
                sketch.addConstraint(new VerticalDistanceBetweenPoints(getPoint(cj.p1), getPoint(cj.p2), cj.distance));
                break;
        }
    }

    return sketch;
}

/** Deserialize a JSON string into a Sketch. */
export function deserializeSketchFromString(jsonString: string): Sketch {
    return deserializeSketch(JSON.parse(jsonString));
}
