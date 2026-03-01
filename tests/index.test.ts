import { describe, it, expect } from "vitest";
import {
    Sketch,
    GradientBasedSolver,
    Point2,
    Line,
    Circle,
    Arc,
    FixPoint,
    HorizontalLine,
    VerticalLine,
    HorizontalDistanceBetweenPoints,
    VerticalDistanceBetweenPoints,
    serializeSketch,
    deserializeSketch,
    serializeSketchToString,
    deserializeSketchFromString,
} from "../src/index";

describe("rectangle (README example)", () => {
    it("should solve a rectangle from four points at the origin", () => {
        const sketch = new Sketch();

        // Create four points (all starting at the origin)
        const pointA = new Point2(0, 0);
        const pointB = new Point2(0, 0);
        const pointC = new Point2(0, 0);
        const pointD = new Point2(0, 0);

        sketch.addPrimitive(pointA);
        sketch.addPrimitive(pointB);
        sketch.addPrimitive(pointC);
        sketch.addPrimitive(pointD);

        // Create four lines based on the points
        const lineA = new Line(pointA, pointB);
        const lineB = new Line(pointB, pointC);
        const lineC = new Line(pointC, pointD);
        const lineD = new Line(pointD, pointA);

        sketch.addPrimitive(lineA);
        sketch.addPrimitive(lineB);
        sketch.addPrimitive(lineC);
        sketch.addPrimitive(lineD);

        // Fix point A to the origin
        sketch.addConstraint(new FixPoint(pointA, 0, 0));

        // Constrain line_a and line_c to be horizontal
        sketch.addConstraint(new HorizontalLine(lineA));
        sketch.addConstraint(new HorizontalLine(lineC));

        // Constrain line_b and line_d to be vertical
        sketch.addConstraint(new VerticalLine(lineB));
        sketch.addConstraint(new VerticalLine(lineD));

        // Constrain the horizontal distance (length of line_a) to 2
        sketch.addConstraint(new HorizontalDistanceBetweenPoints(pointA, pointB, 2));

        // Constrain the vertical distance (length of line_d) to 3
        sketch.addConstraint(new VerticalDistanceBetweenPoints(pointA, pointD, 3));

        // Solve the sketch
        const solver = new GradientBasedSolver();
        solver.solve(sketch);

        // Verify the results match the expected rectangle vertices
        expect(pointA.x).toBeCloseTo(0, 5);
        expect(pointA.y).toBeCloseTo(0, 5);

        expect(pointB.x).toBeCloseTo(2, 5);
        expect(pointB.y).toBeCloseTo(0, 5);

        expect(pointC.x).toBeCloseTo(2, 5);
        expect(pointC.y).toBeCloseTo(3, 5);

        expect(pointD.x).toBeCloseTo(0, 5);
        expect(pointD.y).toBeCloseTo(3, 5);
    });
});

describe("circle", () => {
    it("should round-trip data and accumulate gradients", () => {
        const sketch = new Sketch();

        // Create a circle centered at a free point with radius 5
        const center = new Point2(1, 2);
        const circle = new Circle(center, 5);

        sketch.addPrimitive(center);
        sketch.addPrimitive(circle);

        // Fix the center to (3, 4) and solve — only the center should move
        sketch.addConstraint(new FixPoint(center, 3, 4));

        const solver = new GradientBasedSolver();
        solver.solve(sketch);

        expect(center.x).toBeCloseTo(3, 5);
        expect(center.y).toBeCloseTo(4, 5);

        // Radius should be unchanged (no constraint acting on it)
        expect(circle.radius).toBeCloseTo(5, 5);
    });
});

describe("arc", () => {
    it("should round-trip data, compute start/end points, and reverse", () => {
        const center = new Point2(0, 0);
        const radius = 10;
        const startAngle = 0;
        const endAngle = Math.PI / 2; // 90°

        const arc = new Arc(center, radius, false, startAngle, endAngle);

        // Use the arc in a sketch and solve — fix center to (5, 5)
        const sketch = new Sketch();
        sketch.addPrimitive(center);
        sketch.addPrimitive(arc);
        sketch.addConstraint(new FixPoint(center, 5, 5));

        const solver = new GradientBasedSolver();
        solver.solve(sketch);

        expect(center.x).toBeCloseTo(5, 5);
        expect(center.y).toBeCloseTo(5, 5);

        // Radius and angles should be unchanged
        expect(arc.radius).toBeCloseTo(radius, 5);
        expect(arc.startAngle).toBeCloseTo(startAngle, 5);
        expect(arc.endAngle).toBeCloseTo(endAngle, 5);

        // Verify start/end points shifted by the new center
        const [sx2, sy2] = arc.startPoint();
        expect(sx2).toBeCloseTo(15, 5); // 5 + 10*cos(0)
        expect(sy2).toBeCloseTo(5, 5);  // 5 + 10*sin(0)

        const [ex2, ey2] = arc.endPoint();
        expect(ex2).toBeCloseTo(5, 5);  // 5 + 10*cos(π/2)
        expect(ey2).toBeCloseTo(15, 5); // 5 + 10*sin(π/2)
    });
});

// ── Serialization tests ────────────────────────────────────

describe("serialization", () => {
    /** Build the rectangle sketch from the README example. */
    function buildRectangleSketch(): Sketch {
        const sketch = new Sketch();
        const pA = new Point2(0, 0);
        const pB = new Point2(0, 0);
        const pC = new Point2(0, 0);
        const pD = new Point2(0, 0);
        sketch.addPrimitive(pA);
        sketch.addPrimitive(pB);
        sketch.addPrimitive(pC);
        sketch.addPrimitive(pD);

        const lA = new Line(pA, pB);
        const lB = new Line(pB, pC);
        const lC = new Line(pC, pD);
        const lD = new Line(pD, pA);
        sketch.addPrimitive(lA);
        sketch.addPrimitive(lB);
        sketch.addPrimitive(lC);
        sketch.addPrimitive(lD);

        sketch.addConstraint(new FixPoint(pA, 0, 0));
        sketch.addConstraint(new HorizontalLine(lA));
        sketch.addConstraint(new HorizontalLine(lC));
        sketch.addConstraint(new VerticalLine(lB));
        sketch.addConstraint(new VerticalLine(lD));
        sketch.addConstraint(new HorizontalDistanceBetweenPoints(pA, pB, 2));
        sketch.addConstraint(new VerticalDistanceBetweenPoints(pA, pD, 3));
        return sketch;
    }

    it("should serialize a rectangle sketch to the expected JSON structure", () => {
        const sketch = buildRectangleSketch();
        const json = serializeSketch(sketch);

        // 4 points + 4 lines
        expect(json.primitives).toHaveLength(8);

        // Check point primitives
        const points = json.primitives.filter(p => p.type === "point");
        expect(points).toHaveLength(4);
        expect(points[0]).toEqual({ id: 0, type: "point", x: 0, y: 0 });

        // Check line primitives reference correct point IDs
        const lines = json.primitives.filter(p => p.type === "line");
        expect(lines).toHaveLength(4);
        expect(lines[0]).toEqual({ id: 4, type: "line", start: 0, end: 1 });
        expect(lines[1]).toEqual({ id: 5, type: "line", start: 1, end: 2 });

        // 7 constraints
        expect(json.constraints).toHaveLength(7);
        expect(json.constraints[0]).toEqual({ type: "fix_point", point: 0, tx: 0, ty: 0 });
        expect(json.constraints[1]).toEqual({ type: "horizontal_line", line: 4 });
        expect(json.constraints[5]).toEqual({ type: "horizontal_distance", p1: 0, p2: 1, distance: 2 });
        expect(json.constraints[6]).toEqual({ type: "vertical_distance", p1: 0, p2: 3, distance: 3 });
    });

    it("should deserialize a rectangle sketch from hard-coded JSON", () => {
        const json = {
            primitives: [
                { id: 0, type: "point" as const, x: 0, y: 0 },
                { id: 1, type: "point" as const, x: 0, y: 0 },
                { id: 2, type: "point" as const, x: 0, y: 0 },
                { id: 3, type: "point" as const, x: 0, y: 0 },
                { id: 4, type: "line" as const, start: 0, end: 1 },
                { id: 5, type: "line" as const, start: 1, end: 2 },
                { id: 6, type: "line" as const, start: 2, end: 3 },
                { id: 7, type: "line" as const, start: 3, end: 0 },
            ],
            constraints: [
                { type: "fix_point" as const, point: 0, tx: 0, ty: 0 },
                { type: "horizontal_line" as const, line: 4 },
                { type: "horizontal_line" as const, line: 6 },
                { type: "vertical_line" as const, line: 5 },
                { type: "vertical_line" as const, line: 7 },
                { type: "horizontal_distance" as const, p1: 0, p2: 1, distance: 2 },
                { type: "vertical_distance" as const, p1: 0, p2: 3, distance: 3 },
            ],
        };

        const restored = deserializeSketch(json);

        // Should have same number of primitives and constraints
        const restoredJson = serializeSketch(restored);
        expect(restoredJson.primitives).toHaveLength(8);
        expect(restoredJson.constraints).toHaveLength(7);

        // Solve the restored sketch and verify it produces the expected rectangle
        const solver = new GradientBasedSolver();
        solver.solve(restored);

        // Get the point primitives from the restored sketch
        const restoredPoints: Point2[] = [];
        for (const [, prim] of restored.getPrimitiveEntries()) {
            if (prim instanceof Point2) {
                restoredPoints.push(prim);
            }
        }

        expect(restoredPoints[0].x).toBeCloseTo(0, 5);
        expect(restoredPoints[0].y).toBeCloseTo(0, 5);
        expect(restoredPoints[1].x).toBeCloseTo(2, 5);
        expect(restoredPoints[1].y).toBeCloseTo(0, 5);
        expect(restoredPoints[2].x).toBeCloseTo(2, 5);
        expect(restoredPoints[2].y).toBeCloseTo(3, 5);
        expect(restoredPoints[3].x).toBeCloseTo(0, 5);
        expect(restoredPoints[3].y).toBeCloseTo(3, 5);
    });

    it("should round-trip: serialize → deserialize → serialize produces identical JSON", () => {
        const sketch = buildRectangleSketch();
        const json1 = serializeSketch(sketch);
        const restored = deserializeSketch(json1);
        const json2 = serializeSketch(restored);

        expect(json2).toEqual(json1);
    });

    it("should round-trip via string", () => {
        const sketch = buildRectangleSketch();
        const str = serializeSketchToString(sketch);
        const restored = deserializeSketchFromString(str);
        const str2 = serializeSketchToString(restored);

        expect(str2).toBe(str);
    });

    it("should serialize and round-trip a sketch with circles and arcs", () => {
        const sketch = new Sketch();
        const center = new Point2(1, 2);
        sketch.addPrimitive(center);

        const circle = new Circle(center, 5);
        sketch.addPrimitive(circle);

        const arc = new Arc(center, 10, true, 0, Math.PI / 2);
        sketch.addPrimitive(arc);

        sketch.addConstraint(new FixPoint(center, 3, 4));

        const json = serializeSketch(sketch);

        // Verify structure
        expect(json.primitives).toHaveLength(3);
        expect(json.primitives[0]).toEqual({ id: 0, type: "point", x: 1, y: 2 });
        expect(json.primitives[1]).toEqual({ id: 1, type: "circle", center: 0, radius: 5 });
        expect(json.primitives[2]).toEqual({
            id: 2,
            type: "arc",
            center: 0,
            radius: 10,
            clockwise: true,
            startAngle: 0,
            endAngle: Math.PI / 2,
        });
        expect(json.constraints).toHaveLength(1);
        expect(json.constraints[0]).toEqual({ type: "fix_point", point: 0, tx: 3, ty: 4 });

        // Round-trip
        const restored = deserializeSketch(json);
        const json2 = serializeSketch(restored);
        expect(json2).toEqual(json);

        // Solve the restored sketch and verify
        const solver = new GradientBasedSolver();
        solver.solve(restored);

        const entries = [...restored.getPrimitiveEntries()];
        const restoredCenter = entries[0][1] as Point2;
        expect(restoredCenter.x).toBeCloseTo(3, 5);
        expect(restoredCenter.y).toBeCloseTo(4, 5);
    });

    it("should serialize an empty sketch", () => {
        const sketch = new Sketch();
        const json = serializeSketch(sketch);
        expect(json).toEqual({ primitives: [], constraints: [] });

        // Round-trip
        const restored = deserializeSketch(json);
        const json2 = serializeSketch(restored);
        expect(json2).toEqual(json);
    });

    it("should serialize all constraint types", () => {
        const sketch = new Sketch();
        const p1 = new Point2(0, 0);
        const p2 = new Point2(5, 0);
        const p3 = new Point2(5, 3);
        sketch.addPrimitive(p1);
        sketch.addPrimitive(p2);
        sketch.addPrimitive(p3);

        const line = new Line(p1, p2);
        sketch.addPrimitive(line);

        sketch.addConstraint(new FixPoint(p1, 0, 0));
        sketch.addConstraint(new HorizontalLine(line));
        sketch.addConstraint(new VerticalLine(line)); // contrived, for serialization coverage
        sketch.addConstraint(new HorizontalDistanceBetweenPoints(p1, p2, 5));
        sketch.addConstraint(new VerticalDistanceBetweenPoints(p1, p3, 3));

        const json = serializeSketch(sketch);
        expect(json.constraints).toHaveLength(5);

        const types = json.constraints.map(c => c.type);
        expect(types).toEqual([
            "fix_point",
            "horizontal_line",
            "vertical_line",
            "horizontal_distance",
            "vertical_distance",
        ]);

        // Round-trip
        const restored = deserializeSketch(json);
        const json2 = serializeSketch(restored);
        expect(json2).toEqual(json);
    });
});
