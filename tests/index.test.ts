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
