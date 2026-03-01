import { Sketch } from "./sketch.js";
import { PrimitiveLike } from "./interfaces.js";
import { Point2 } from "./primitives/point2.js";
import { Line } from "./primitives/line.js";
import { FixPoint } from "./constraints/fix_point.js";
import { HorizontalLine } from "./constraints/horizontal_line.js";
import { VerticalLine } from "./constraints/vertical_line.js";
import { HorizontalDistanceBetweenPoints } from "./constraints/horizontal_distance.js";
import { VerticalDistanceBetweenPoints } from "./constraints/vertical_distance.js";
import { GradientBasedSolver } from "./gradient_based_solver.js";

/** The tools available in the toolbar. */
export type Tool = "none" | "point" | "line";

/** Pending two-point constraint awaiting second point selection. */
type PendingDistanceConstraint = {
    kind: "horizontal-distance" | "vertical-distance";
    sourcePoint: Point2;
    desiredDistance: number;
};

/**
 * A viewport for mapping world coordinates to a canvas.
 *
 * The viewport is defined by:
 *   - bottomLeft: the world-space coordinate of the canvas's bottom-left corner
 *   - viewHeight: the world-space height visible in the viewport
 *
 * The aspect ratio is derived from the canvas element's pixel dimensions,
 * so the world-space width is computed as:
 *     viewWidth = viewHeight * (canvasWidth / canvasHeight)
 */
export class Viewport {
    /** World-space x of the bottom-left corner. */
    bottomLeftX: number;
    /** World-space y of the bottom-left corner. */
    bottomLeftY: number;
    /** World-space height of the viewport. */
    viewHeight: number;

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private resizeObserver: ResizeObserver;

    /** The sketch that holds all placed primitives. */
    sketch: Sketch = new Sketch();

    /** The currently-active tool. */
    activeTool: Tool = "none";

    /** For multi-step tools (e.g. line): the first selected point, if any. */
    private pendingLineStart: Point2 | null = null;

    /** The currently selected primitive, or null. */
    private selectedPrimitive: PrimitiveLike | null = null;

    /** Current mouse position in canvas-pixel coords, or null if the cursor is outside. */
    private cursorCanvasX: number | null = null;
    private cursorCanvasY: number | null = null;

    /** Whether the user is currently panning with the middle mouse button. */
    private isPanning = false;
    /** Last mouse position during a pan (CSS pixels, not DPR-scaled). */
    private panLastX = 0;
    private panLastY = 0;

    /** Transient status message drawn at the bottom of the canvas. */
    private statusMessage: string | null = null;
    private statusTimer: ReturnType<typeof setTimeout> | null = null;

    /** Whether the current sketch state has been solved. */
    private isSolved = false;

    /** Pending two-point constraint awaiting a second point click. */
    private pendingConstraint: PendingDistanceConstraint | null = null;

    constructor(canvas: HTMLCanvasElement, bottomLeftX = -10, bottomLeftY = -10, viewHeight = 20) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d")!;
        this.bottomLeftX = bottomLeftX;
        this.bottomLeftY = bottomLeftY;
        this.viewHeight = viewHeight;

        // Size backing store to match CSS layout and kick off first draw
        this.resizeObserver = new ResizeObserver(() => this.syncSize());
        this.resizeObserver.observe(canvas);
        this.syncSize();

        // Zoom on mouse wheel
        this.onWheel = this.onWheel.bind(this);
        canvas.addEventListener("wheel", this.onWheel, { passive: false });

        // Track mouse position for coordinate readout
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseLeave = this.onMouseLeave.bind(this);
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("mouseleave", this.onMouseLeave);

        // Middle-button pan
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        canvas.addEventListener("mousedown", this.onMouseDown);
        canvas.addEventListener("mouseup", this.onMouseUp);

        // Click to place primitives
        this.onClick = this.onClick.bind(this);
        canvas.addEventListener("click", this.onClick);

        // Right-click to cancel placement
        this.onContextMenu = this.onContextMenu.bind(this);
        canvas.addEventListener("contextmenu", this.onContextMenu);

        // ESC to cancel placement
        this.onKeyDown = this.onKeyDown.bind(this);
        document.addEventListener("keydown", this.onKeyDown);

        // Wire up toolbar buttons
        this.initToolbar();

        // Fit-all button
        document.getElementById("fit-all")?.addEventListener("click", () => this.zoomToFit());

        // Solve button
        document.getElementById("solve")?.addEventListener("click", () => {
            const solver = new GradientBasedSolver();
            const start = performance.now();
            solver.solve(this.sketch);
            const elapsed = performance.now() - start;
            this.isSolved = true;
            this.showStatus(`Solved in ${elapsed.toFixed(1)} ms`);
            this.updatePropertiesPanel();
            this.draw();
        });

        // Clear button
        document.getElementById("clear")?.addEventListener("click", () => {
            this.sketch = new Sketch();
            this.pendingLineStart = null;
            this.pendingConstraint = null;
            this.isSolved = false;
            this.bottomLeftX = -10;
            this.bottomLeftY = -10;
            this.viewHeight = 20;
            this.selectPrimitive(null);
            this.draw();
        });

        // Export DXF button
        document.getElementById("export-dxf")?.addEventListener("click", () => {
            this.exportDxf();
        });
    }

    /** Adjust the viewport so all Point2 primitives are visible, with some padding. */
    zoomToFit(): void {
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;
        let count = 0;

        for (const prim of this.sketch.getPrimitives()) {
            if (prim instanceof Point2) {
                minX = Math.min(minX, prim.x);
                maxX = Math.max(maxX, prim.x);
                minY = Math.min(minY, prim.y);
                maxY = Math.max(maxY, prim.y);
                count++;
            }
        }

        if (count === 0) return;

        // Add 10% padding around the bounding box
        const padFraction = 0.1;
        const spanX = maxX - minX || 1;
        const spanY = maxY - minY || 1;
        const padX = spanX * padFraction;
        const padY = spanY * padFraction;
        minX -= padX;
        maxX += padX;
        minY -= padY;
        maxY += padY;

        // Determine viewHeight so both axes fit
        const aspect = this.canvas.width / this.canvas.height;
        const fitByHeight = maxY - minY;
        const fitByWidth = (maxX - minX) / aspect;
        this.viewHeight = Math.max(fitByHeight, fitByWidth);

        // Center the bounding box in the viewport
        const viewWidth = this.viewHeight * aspect;
        this.bottomLeftX = (minX + maxX) / 2 - viewWidth / 2;
        this.bottomLeftY = (minY + maxY) / 2 - this.viewHeight / 2;

        this.draw();
    }

    /** Cancel any in-progress placement and reset the active tool. */
    private cancelTool(): void {
        this.pendingLineStart = null;
        this.pendingConstraint = null;
        this.activeTool = "none";
        this.canvas.style.cursor = "default";
        document.querySelectorAll<HTMLButtonElement>("#toolbar button[data-tool]")
            .forEach((b) => b.classList.remove("active"));
        this.draw();
    }

    /** Handle right-click — cancel current placement. */
    private onContextMenu(e: MouseEvent): void {
        e.preventDefault();
        if (this.activeTool !== "none") {
            this.cancelTool();
        }
    }

    /** Handle keydown — ESC cancels current placement or deselects. */
    private onKeyDown(e: KeyboardEvent): void {
        if (e.key === "Escape") {
            if (this.pendingConstraint) {
                this.pendingConstraint = null;
                this.updatePropertiesPanel();
                this.draw();
            } else if (this.activeTool !== "none") {
                this.cancelTool();
            } else if (this.selectedPrimitive) {
                this.selectPrimitive(null);
                this.draw();
            }
        }
    }

    /** Bind toolbar button clicks to tool selection. */
    private initToolbar(): void {
        const buttons = document.querySelectorAll<HTMLButtonElement>("#toolbar button[data-tool]");
        buttons.forEach((btn) => {
            btn.addEventListener("click", () => {
                const tool = btn.dataset.tool as Tool;
                if (this.activeTool === tool) {
                    // Toggle off
                    this.activeTool = "none";
                    btn.classList.remove("active");
                    this.canvas.style.cursor = "default";
                } else {
                    // Deactivate all, then activate this one
                    buttons.forEach((b) => b.classList.remove("active"));
                    this.activeTool = tool;
                    btn.classList.add("active");
                    this.canvas.style.cursor = "crosshair";
                }
            });
        });
    }

    /** Handle canvas click — place a primitive if a tool is active, otherwise try to select. */
    private onClick(e: MouseEvent): void {
        const dpr = window.devicePixelRatio || 1;
        const cx = e.offsetX * dpr;
        const cy = e.offsetY * dpr;
        const wx = this.canvasToWorldX(cx);
        const wy = this.canvasToWorldY(cy);

        // If no tool is active, try to select a primitive
        if (this.activeTool === "none") {
            // If awaiting second point for a distance constraint, handle that first
            if (this.pendingConstraint) {
                const hitPoint = this.findNearestPoint(cx, cy);
                if (hitPoint && hitPoint !== this.pendingConstraint.sourcePoint) {
                    const { kind, sourcePoint, desiredDistance } = this.pendingConstraint;
                    if (kind === "horizontal-distance") {
                        this.sketch.addConstraint(
                            new HorizontalDistanceBetweenPoints(sourcePoint, hitPoint, desiredDistance)
                        );
                    } else {
                        this.sketch.addConstraint(
                            new VerticalDistanceBetweenPoints(sourcePoint, hitPoint, desiredDistance)
                        );
                    }
                    this.isSolved = false;
                    this.pendingConstraint = null;
                    this.updatePropertiesPanel();
                    this.draw();
                }
                return;
            }
            const hit = this.findNearestPrimitive(cx, cy);
            this.selectPrimitive(hit);
            this.draw();
            return;
        }

        if (this.activeTool === "point") {
            const p = new Point2(wx, wy);
            this.sketch.addPrimitive(p);
            this.isSolved = false;
            this.cancelTool();
            return;
        }

        if (this.activeTool === "line") {
            const hitPoint = this.findNearestPoint(cx, cy);
            if (!hitPoint) return; // no point near cursor — ignore click

            if (!this.pendingLineStart) {
                // First click: select start point
                this.pendingLineStart = hitPoint;
                this.draw();
            } else {
                // Second click: select end point and create line
                if (hitPoint !== this.pendingLineStart) {
                    const line = new Line(this.pendingLineStart, hitPoint);
                    this.sketch.addPrimitive(line);
                    this.isSolved = false;
                }
                this.cancelTool();
            }
            return;
        }
    }

    /** Find the nearest Point2 primitive within a hit-test radius (in canvas pixels). */
    private findNearestPoint(canvasX: number, canvasY: number): Point2 | null {
        const dpr = window.devicePixelRatio || 1;
        const hitRadius = 10 * dpr;
        let best: Point2 | null = null;
        let bestDist = hitRadius;

        for (const prim of this.sketch.getPrimitives()) {
            if (prim instanceof Point2) {
                const px = this.worldToCanvasX(prim.x);
                const py = this.worldToCanvasY(prim.y);
                const dx = px - canvasX;
                const dy = py - canvasY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = prim;
                }
            }
        }
        return best;
    }

    /** Find the nearest primitive (point or line) within hit-test radius. Points take priority. */
    private findNearestPrimitive(canvasX: number, canvasY: number): PrimitiveLike | null {
        // Check points first (they're small targets, higher priority)
        const point = this.findNearestPoint(canvasX, canvasY);
        if (point) return point;

        // Check lines
        const dpr = window.devicePixelRatio || 1;
        const hitRadius = 8 * dpr;
        let best: Line | null = null;
        let bestDist = hitRadius;

        for (const prim of this.sketch.getPrimitives()) {
            if (prim instanceof Line) {
                const x1 = this.worldToCanvasX(prim.start.x);
                const y1 = this.worldToCanvasY(prim.start.y);
                const x2 = this.worldToCanvasX(prim.end.x);
                const y2 = this.worldToCanvasY(prim.end.y);
                const dist = this.distToSegment(canvasX, canvasY, x1, y1, x2, y2);
                if (dist < bestDist) {
                    bestDist = dist;
                    best = prim;
                }
            }
        }
        return best;
    }

    /** Perpendicular distance from point (px,py) to line segment (x1,y1)-(x2,y2). */
    private distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lenSq = dx * dx + dy * dy;
        if (lenSq === 0) return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
        let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const closestX = x1 + t * dx;
        const closestY = y1 + t * dy;
        return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
    }

    // ── Selection & properties panel ───────────────────────────

    /** Set the selected primitive and update the properties panel. */
    private selectPrimitive(prim: PrimitiveLike | null): void {
        this.selectedPrimitive = prim;
        this.updatePropertiesPanel();
    }

    /** Rebuild the properties panel DOM based on the current selection. */
    private updatePropertiesPanel(): void {
        const panel = document.getElementById("properties-panel")!;
        panel.innerHTML = "";

        if (!this.selectedPrimitive) {
            panel.classList.remove("visible");
            return;
        }

        panel.classList.add("visible");
        const prim = this.selectedPrimitive;

        if (prim instanceof Point2) {
            this.buildPointPanel(panel, prim);
        } else if (prim instanceof Line) {
            this.buildLinePanel(panel, prim);
        }
    }

    /** Build properties panel content for a Point2. */
    private buildPointPanel(panel: HTMLElement, point: Point2): void {
        const title = document.createElement("div");
        title.className = "prop-title";
        title.textContent = "Point";
        panel.appendChild(title);

        // X coordinate
        const xLabel = document.createElement("label");
        xLabel.textContent = "X: ";
        const xInput = document.createElement("input");
        xInput.type = "number";
        xInput.step = "0.1";
        xInput.value = point.x.toString();
        xInput.addEventListener("input", () => {
            const v = parseFloat(xInput.value);
            if (!isNaN(v)) { point.x = v; this.isSolved = false; this.draw(); }
        });
        xLabel.appendChild(xInput);
        panel.appendChild(xLabel);

        // Y coordinate
        const yLabel = document.createElement("label");
        yLabel.textContent = "Y: ";
        const yInput = document.createElement("input");
        yInput.type = "number";
        yInput.step = "0.1";
        yInput.value = point.y.toString();
        yInput.addEventListener("input", () => {
            const v = parseFloat(yInput.value);
            if (!isNaN(v)) { point.y = v; this.isSolved = false; this.draw(); }
        });
        yLabel.appendChild(yInput);
        panel.appendChild(yLabel);

        // Constraints section
        const constraints = this.sketch.getConstraintsOnPrimitive(point);
        const existingFixPoint = constraints.find((c): c is FixPoint => c instanceof FixPoint) ?? null;

        if (constraints.length > 0) {
            const section = document.createElement("div");
            section.className = "prop-constraints";
            const heading = document.createElement("div");
            heading.className = "prop-subtitle";
            heading.textContent = `Constraints (${constraints.length})`;
            section.appendChild(heading);
            const list = document.createElement("ul");
            for (const c of constraints) {
                const li = document.createElement("li");
                li.textContent = c.description;
                list.appendChild(li);
            }
            section.appendChild(list);
            panel.appendChild(section);
        }

        if (existingFixPoint) {
            // Edit / delete existing FixPoint
            const editSection = document.createElement("div");
            editSection.className = "prop-add-constraint";
            const editHeading = document.createElement("div");
            editHeading.className = "prop-subtitle";
            editHeading.textContent = "Edit FixPoint";
            editSection.appendChild(editHeading);

            const txLabel = document.createElement("label");
            txLabel.textContent = "tx: ";
            const txInput = document.createElement("input");
            txInput.type = "number";
            txInput.step = "0.1";
            txInput.value = existingFixPoint.tx.toString();
            txInput.addEventListener("input", () => {
                const v = parseFloat(txInput.value);
                if (!isNaN(v)) {
                    existingFixPoint.tx = v;
                    this.isSolved = false;
                    this.updatePropertiesPanel();
                    this.draw();
                }
            });
            txLabel.appendChild(txInput);
            editSection.appendChild(txLabel);

            const tyLabel = document.createElement("label");
            tyLabel.textContent = "ty: ";
            const tyInput = document.createElement("input");
            tyInput.type = "number";
            tyInput.step = "0.1";
            tyInput.value = existingFixPoint.ty.toString();
            tyInput.addEventListener("input", () => {
                const v = parseFloat(tyInput.value);
                if (!isNaN(v)) {
                    existingFixPoint.ty = v;
                    this.isSolved = false;
                    this.updatePropertiesPanel();
                    this.draw();
                }
            });
            tyLabel.appendChild(tyInput);
            editSection.appendChild(tyLabel);

            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = "Delete FixPoint";
            deleteBtn.addEventListener("click", () => {
                this.sketch.removeConstraint(existingFixPoint);
                this.isSolved = false;
                this.updatePropertiesPanel();
                this.draw();
            });
            editSection.appendChild(deleteBtn);
            panel.appendChild(editSection);
        } else {
            // Add new FixPoint
            const addSection = document.createElement("div");
            addSection.className = "prop-add-constraint";
            const addHeading = document.createElement("div");
            addHeading.className = "prop-subtitle";
            addHeading.textContent = "Add Constraint";
            addSection.appendChild(addHeading);

            const txLabel = document.createElement("label");
            txLabel.textContent = "tx: ";
            const txInput = document.createElement("input");
            txInput.type = "number";
            txInput.step = "0.1";
            txInput.value = point.x.toString();
            txLabel.appendChild(txInput);
            addSection.appendChild(txLabel);

            const tyLabel = document.createElement("label");
            tyLabel.textContent = "ty: ";
            const tyInput = document.createElement("input");
            tyInput.type = "number";
            tyInput.step = "0.1";
            tyInput.value = point.y.toString();
            tyLabel.appendChild(tyInput);
            addSection.appendChild(tyLabel);

            const addBtn = document.createElement("button");
            addBtn.textContent = "Add FixPoint";
            addBtn.addEventListener("click", () => {
                const tx = parseFloat(txInput.value);
                const ty = parseFloat(tyInput.value);
                if (isNaN(tx) || isNaN(ty)) return;
                const constraint = new FixPoint(point, tx, ty);
                this.sketch.addConstraint(constraint);
                this.isSolved = false;
                this.updatePropertiesPanel();
                this.draw();
            });
            addSection.appendChild(addBtn);
            panel.appendChild(addSection);
        }

        // Distance constraints section
        const distConstraints = constraints.filter(
            (c): c is HorizontalDistanceBetweenPoints | VerticalDistanceBetweenPoints =>
                c instanceof HorizontalDistanceBetweenPoints || c instanceof VerticalDistanceBetweenPoints
        );

        if (distConstraints.length > 0) {
            const section = document.createElement("div");
            section.className = "prop-add-constraint";
            const heading = document.createElement("div");
            heading.className = "prop-subtitle";
            heading.textContent = "Distance Constraints";
            section.appendChild(heading);

            for (const dc of distConstraints) {
                const row = document.createElement("div");
                row.style.display = "flex";
                row.style.alignItems = "center";
                row.style.gap = "4px";
                row.style.marginBottom = "4px";
                const label = document.createElement("span");
                label.textContent = dc.description;
                label.style.flex = "1";
                row.appendChild(label);
                const delBtn = document.createElement("button");
                delBtn.textContent = "Delete";
                delBtn.addEventListener("click", () => {
                    this.sketch.removeConstraint(dc);
                    this.isSolved = false;
                    this.updatePropertiesPanel();
                    this.draw();
                });
                row.appendChild(delBtn);
                section.appendChild(row);
            }
            panel.appendChild(section);
        }

        // Add distance constraint section
        if (this.pendingConstraint) {
            const pendingSection = document.createElement("div");
            pendingSection.className = "prop-add-constraint";
            const pendingLabel = document.createElement("div");
            pendingLabel.className = "prop-subtitle";
            pendingLabel.textContent = this.pendingConstraint.kind === "horizontal-distance"
                ? "Select second point for HorizontalDistance"
                : "Select second point for VerticalDistance";
            pendingSection.appendChild(pendingLabel);
            const cancelBtn = document.createElement("button");
            cancelBtn.textContent = "Cancel";
            cancelBtn.addEventListener("click", () => {
                this.pendingConstraint = null;
                this.updatePropertiesPanel();
                this.draw();
            });
            pendingSection.appendChild(cancelBtn);
            panel.appendChild(pendingSection);
        } else {
            const addDistSection = document.createElement("div");
            addDistSection.className = "prop-add-constraint";
            const addDistHeading = document.createElement("div");
            addDistHeading.className = "prop-subtitle";
            addDistHeading.textContent = "Add Distance Constraint";
            addDistSection.appendChild(addDistHeading);

            const distLabel = document.createElement("label");
            distLabel.textContent = "distance: ";
            const distInput = document.createElement("input");
            distInput.type = "number";
            distInput.step = "0.1";
            distInput.value = "0";
            distLabel.appendChild(distInput);
            addDistSection.appendChild(distLabel);

            const addHDistBtn = document.createElement("button");
            addHDistBtn.textContent = "Add HorizontalDistance";
            addHDistBtn.addEventListener("click", () => {
                const d = parseFloat(distInput.value);
                if (isNaN(d)) return;
                this.pendingConstraint = {
                    kind: "horizontal-distance",
                    sourcePoint: point,
                    desiredDistance: d,
                };
                this.canvas.style.cursor = "crosshair";
                this.updatePropertiesPanel();
                this.draw();
            });
            addDistSection.appendChild(addHDistBtn);

            const addVDistBtn = document.createElement("button");
            addVDistBtn.textContent = "Add VerticalDistance";
            addVDistBtn.addEventListener("click", () => {
                const d = parseFloat(distInput.value);
                if (isNaN(d)) return;
                this.pendingConstraint = {
                    kind: "vertical-distance",
                    sourcePoint: point,
                    desiredDistance: d,
                };
                this.canvas.style.cursor = "crosshair";
                this.updatePropertiesPanel();
                this.draw();
            });
            addDistSection.appendChild(addVDistBtn);
            panel.appendChild(addDistSection);
        }

        // Delete button
        this.appendDeleteButton(panel, point);
    }

    /** Build properties panel content for a Line. */
    private buildLinePanel(panel: HTMLElement, line: Line): void {
        const title = document.createElement("div");
        title.className = "prop-title";
        title.textContent = "Line";
        panel.appendChild(title);

        const info = document.createElement("div");
        info.textContent = `(${this.formatValue(line.start.x)}, ${this.formatValue(line.start.y)}) \u2192 (${this.formatValue(line.end.x)}, ${this.formatValue(line.end.y)})`;
        info.style.marginBottom = "4px";
        panel.appendChild(info);

        // Check for existing HorizontalLine / VerticalLine constraint
        const constraints = this.sketch.getConstraintsOnPrimitive(line);
        const existingH = constraints.find((c): c is HorizontalLine => c instanceof HorizontalLine) ?? null;
        const existingV = constraints.find((c): c is VerticalLine => c instanceof VerticalLine) ?? null;
        const existingDirectional = existingH ?? existingV;

        if (constraints.length > 0) {
            const section = document.createElement("div");
            section.className = "prop-constraints";
            const heading = document.createElement("div");
            heading.className = "prop-subtitle";
            heading.textContent = `Constraints (${constraints.length})`;
            section.appendChild(heading);
            const list = document.createElement("ul");
            for (const c of constraints) {
                const li = document.createElement("li");
                li.textContent = c.description;
                list.appendChild(li);
            }
            section.appendChild(list);
            panel.appendChild(section);
        }

        if (existingDirectional) {
            // Allow deleting the existing constraint
            const section = document.createElement("div");
            section.className = "prop-add-constraint";
            const deleteBtn = document.createElement("button");
            deleteBtn.textContent = `Delete ${existingDirectional.description}`;
            deleteBtn.addEventListener("click", () => {
                this.sketch.removeConstraint(existingDirectional);
                this.isSolved = false;
                this.updatePropertiesPanel();
                this.draw();
            });
            section.appendChild(deleteBtn);
            panel.appendChild(section);
        } else {
            // Allow adding HorizontalLine or VerticalLine
            const section = document.createElement("div");
            section.className = "prop-add-constraint";
            const heading = document.createElement("div");
            heading.className = "prop-subtitle";
            heading.textContent = "Add Constraint";
            section.appendChild(heading);

            const addHBtn = document.createElement("button");
            addHBtn.textContent = "Add HorizontalLine";
            addHBtn.addEventListener("click", () => {
                this.sketch.addConstraint(new HorizontalLine(line));
                this.isSolved = false;
                this.updatePropertiesPanel();
                this.draw();
            });
            section.appendChild(addHBtn);

            const addVBtn = document.createElement("button");
            addVBtn.textContent = "Add VerticalLine";
            addVBtn.addEventListener("click", () => {
                this.sketch.addConstraint(new VerticalLine(line));
                this.isSolved = false;
                this.updatePropertiesPanel();
                this.draw();
            });
            section.appendChild(addVBtn);
            panel.appendChild(section);
        }

        // Delete button
        this.appendDeleteButton(panel, line);
    }

    /** Add a delete button to the properties panel for the given primitive. */
    private appendDeleteButton(panel: HTMLElement, prim: PrimitiveLike): void {
        const btn = document.createElement("button");
        btn.textContent = "Delete";
        btn.addEventListener("click", () => {
            this.deletePrimitive(prim);
        });
        panel.appendChild(btn);
    }

    /** Delete a primitive from the sketch. If it's a point, warn about dependent lines and constraints first. */
    private deletePrimitive(prim: PrimitiveLike): void {
        if (prim instanceof Point2) {
            const deps = this.sketch.getDependents(prim);
            const distConstraints = this.sketch.getConstraintsOnPrimitive(prim).filter(
                c => c instanceof HorizontalDistanceBetweenPoints || c instanceof VerticalDistanceBetweenPoints
            );
            const warnings: string[] = [];
            if (deps.length > 0) {
                warnings.push(`${deps.length} line(s)`);
            }
            if (distConstraints.length > 0) {
                warnings.push(`${distConstraints.length} distance constraint(s)`);
            }
            if (warnings.length > 0) {
                const ok = window.confirm(
                    `This point is used by ${warnings.join(" and ")}. Deleting it will also delete those. Continue?`
                );
                if (!ok) return;
                for (const dep of deps) {
                    this.sketch.removePrimitive(dep);
                }
                for (const dc of distConstraints) {
                    this.sketch.removeConstraint(dc);
                }
            }
        }
        this.sketch.removePrimitive(prim);
        this.isSolved = false;
        this.selectPrimitive(null);
        this.draw();
    }

    /** Update stored cursor position, handle panning, and redraw. */
    private onMouseMove(e: MouseEvent): void {
        const dpr = window.devicePixelRatio || 1;
        this.cursorCanvasX = e.offsetX * dpr;
        this.cursorCanvasY = e.offsetY * dpr;

        if (this.isPanning) {
            const dx = e.offsetX - this.panLastX;
            const dy = e.offsetY - this.panLastY;
            this.panLastX = e.offsetX;
            this.panLastY = e.offsetY;
            // Convert CSS-pixel deltas to world units
            this.bottomLeftX -= dx * dpr / this.scale;
            this.bottomLeftY += dy * dpr / this.scale;
        }

        this.draw();
    }

    /** Clear cursor position and stop panning when the mouse leaves the canvas. */
    private onMouseLeave(): void {
        this.cursorCanvasX = null;
        this.cursorCanvasY = null;
        this.isPanning = false;
        this.draw();
    }

    /** Start panning on middle mouse button press. */
    private onMouseDown(e: MouseEvent): void {
        if (e.button === 1) {
            e.preventDefault();
            this.isPanning = true;
            this.panLastX = e.offsetX;
            this.panLastY = e.offsetY;
        }
    }

    /** Stop panning on middle mouse button release. */
    private onMouseUp(e: MouseEvent): void {
        if (e.button === 1) {
            this.isPanning = false;
        }
    }

    /** Handle mouse-wheel zoom, keeping the world point under the cursor fixed. */
    private onWheel(e: WheelEvent): void {
        e.preventDefault();

        const zoomIn = 0.8;   // shrink viewHeight → zoom in
        const zoomOut = 1.25; // grow viewHeight → zoom out
        const factor = e.deltaY < 0 ? zoomIn : zoomOut;

        // World position under the cursor before zoom
        const dpr = window.devicePixelRatio || 1;
        const cx = e.offsetX * dpr;
        const cy = e.offsetY * dpr;
        const wx = this.canvasToWorldX(cx);
        const wy = this.canvasToWorldY(cy);

        // Apply zoom
        this.viewHeight *= factor;

        // Adjust bottom-left so (wx, wy) stays under the cursor
        this.bottomLeftX = wx - cx / this.scale;
        this.bottomLeftY = wy - (this.canvas.height - cy) / this.scale;

        this.draw();
    }

    /** Keeps the backing-buffer resolution in sync with the CSS layout size. */
    private syncSize(): void {
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = this.canvas.clientWidth;
        const displayHeight = this.canvas.clientHeight;
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        this.draw();
    }

    // ── Coordinate helpers ─────────────────────────────────────

    /** Computed world-space width, derived from height and aspect ratio. */
    get viewWidth(): number {
        return this.viewHeight * (this.canvas.width / this.canvas.height);
    }

    /** Pixels per world-unit. */
    private get scale(): number {
        return this.canvas.height / this.viewHeight;
    }

    /** Convert world X to canvas pixel X. */
    worldToCanvasX(wx: number): number {
        return (wx - this.bottomLeftX) * this.scale;
    }

    /** Convert world Y to canvas pixel Y (canvas Y is top-down). */
    worldToCanvasY(wy: number): number {
        return this.canvas.height - (wy - this.bottomLeftY) * this.scale;
    }

    /** Convert canvas pixel X to world X. */
    canvasToWorldX(cx: number): number {
        return cx / this.scale + this.bottomLeftX;
    }

    /** Convert canvas pixel Y to world Y. */
    canvasToWorldY(cy: number): number {
        return (this.canvas.height - cy) / this.scale + this.bottomLeftY;
    }

    // ── Drawing ────────────────────────────────────────────────

    /** Clear the canvas and redraw the grid + axes. */
    draw(): void {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Background
        ctx.fillStyle = "#1e1e1e";
        ctx.fillRect(0, 0, w, h);

        this.drawGrid(ctx);
        this.drawAxes(ctx);
        this.drawAxisLabels(ctx);
        this.drawPrimitives(ctx);
        this.drawCursorLabel(ctx);
        this.drawStatusMessage(ctx);
        this.drawSolvedIndicator(ctx);
        this.updateExportButton();
    }

    /** Update the Export DXF button's enabled state. */
    private updateExportButton(): void {
        const btn = document.getElementById("export-dxf") as HTMLButtonElement | null;
        if (!btn) return;
        let hasLine = false;
        for (const prim of this.sketch.getPrimitives()) {
            if (prim instanceof Line) { hasLine = true; break; }
        }
        btn.disabled = !(this.isSolved && hasLine);
    }

    /** Generate a minimal DXF file of all Line primitives and trigger a download. */
    private exportDxf(): void {
        const lines: Line[] = [];
        for (const prim of this.sketch.getPrimitives()) {
            if (prim instanceof Line) lines.push(prim);
        }
        if (lines.length === 0) return;

        let dxf = "";
        dxf += "0\nSECTION\n2\nENTITIES\n";
        for (const line of lines) {
            dxf += "0\nLINE\n";
            dxf += "8\n0\n";           // layer 0
            dxf += `10\n${line.start.x}\n`;  // start x
            dxf += `20\n${line.start.y}\n`;  // start y
            dxf += `30\n0\n`;                // start z
            dxf += `11\n${line.end.x}\n`;    // end x
            dxf += `21\n${line.end.y}\n`;    // end y
            dxf += `31\n0\n`;                // end z
        }
        dxf += "0\nENDSEC\n0\nEOF\n";

        const blob = new Blob([dxf], { type: "application/dxf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sketch.dxf";
        a.click();
        URL.revokeObjectURL(url);
    }

    /** Draw a persistent solved/unsolved indicator in the top-right corner. */
    private drawSolvedIndicator(ctx: CanvasRenderingContext2D): void {
        const dpr = window.devicePixelRatio || 1;
        const fontSize = 12 * dpr;
        const pad = 6 * dpr;
        const label = this.isSolved ? "Solved" : "Unsolved";

        ctx.font = `${fontSize}px monospace`;
        const metrics = ctx.measureText(label);
        const textW = metrics.width;
        const textH = fontSize;

        const x = this.canvas.width - textW - pad * 2;
        const y = pad;

        // Background pill
        ctx.fillStyle = "rgba(30, 30, 30, 0.85)";
        ctx.fillRect(x, y, textW + pad * 2, textH + pad * 2);

        // Text
        ctx.fillStyle = this.isSolved ? "#66bb6a" : "#888";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, x + pad, y + pad);
    }

    /** Draw a subtle reference grid. */
    private drawGrid(ctx: CanvasRenderingContext2D): void {
        const step = this.niceGridStep();
        const left = Math.floor(this.bottomLeftX / step) * step;
        const bottom = Math.floor(this.bottomLeftY / step) * step;
        const right = this.bottomLeftX + this.viewWidth;
        const top = this.bottomLeftY + this.viewHeight;

        ctx.strokeStyle = "#333";
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = left; x <= right; x += step) {
            const cx = this.worldToCanvasX(x);
            ctx.moveTo(cx, 0);
            ctx.lineTo(cx, this.canvas.height);
        }
        for (let y = bottom; y <= top; y += step) {
            const cy = this.worldToCanvasY(y);
            ctx.moveTo(0, cy);
            ctx.lineTo(this.canvas.width, cy);
        }
        ctx.stroke();
    }

    /** Draw the X and Y axes through the origin. */
    private drawAxes(ctx: CanvasRenderingContext2D): void {
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 2;
        ctx.beginPath();

        // X axis
        const y0 = this.worldToCanvasY(0);
        ctx.moveTo(0, y0);
        ctx.lineTo(this.canvas.width, y0);

        // Y axis
        const x0 = this.worldToCanvasX(0);
        ctx.moveTo(x0, 0);
        ctx.lineTo(x0, this.canvas.height);

        ctx.stroke();
    }

    /** Draw min/max axis value labels at the ends of each axis, or at the canvas edges if the axis is off-screen. */
    private drawAxisLabels(ctx: CanvasRenderingContext2D): void {
        const xMin = this.bottomLeftX;
        const xMax = this.bottomLeftX + this.viewWidth;
        const yMin = this.bottomLeftY;
        const yMax = this.bottomLeftY + this.viewHeight;

        const dpr = window.devicePixelRatio || 1;
        const fontSize = 12 * dpr;
        const pad = 4 * dpr;

        ctx.font = `${fontSize}px monospace`;
        ctx.fillStyle = "#888";

        // Determine if the X axis (y=0) is visible
        const xAxisCanvasY = this.worldToCanvasY(0);
        const xAxisVisible = yMin <= 0 && 0 <= yMax;

        // Determine if the Y axis (x=0) is visible
        const yAxisCanvasX = this.worldToCanvasX(0);
        const yAxisVisible = xMin <= 0 && 0 <= xMax;

        // ── X-axis labels (xMin at left edge, xMax at right edge) ──
        if (xAxisVisible) {
            // Place labels just below the X axis line
            const labelY = Math.min(xAxisCanvasY + fontSize + pad, this.canvas.height - pad);
            const baseline = xAxisCanvasY + fontSize + pad <= this.canvas.height - pad ? "top" : "bottom";
            const actualY = baseline === "top" ? xAxisCanvasY + pad : this.canvas.height - pad;

            ctx.textBaseline = "top";

            ctx.textAlign = "left";
            ctx.fillText(this.formatValue(xMin), pad, xAxisCanvasY + pad);

            ctx.textAlign = "right";
            ctx.fillText(this.formatValue(xMax), this.canvas.width - pad, xAxisCanvasY + pad);
        } else {
            // X axis off-screen: fall back to bottom edge corners
            ctx.textBaseline = "bottom";

            ctx.textAlign = "left";
            ctx.fillText(this.formatValue(xMin), pad, this.canvas.height - pad);

            ctx.textAlign = "right";
            ctx.fillText(this.formatValue(xMax), this.canvas.width - pad, this.canvas.height - pad);
        }

        // ── Y-axis labels (yMin at bottom edge, yMax at top edge) ──
        if (yAxisVisible) {
            // Place labels just to the right of the Y axis line
            const labelX = yAxisCanvasX + pad;

            ctx.textAlign = "left";

            ctx.textBaseline = "bottom";
            ctx.fillText(this.formatValue(yMin), labelX, this.canvas.height - pad);

            ctx.textBaseline = "top";
            ctx.fillText(this.formatValue(yMax), labelX, pad);
        } else {
            // Y axis off-screen: fall back to left edge corners
            ctx.textAlign = "left";

            ctx.textBaseline = "bottom";
            ctx.fillText(this.formatValue(yMin), pad, this.canvas.height - pad - fontSize - pad);

            ctx.textBaseline = "top";
            ctx.fillText(this.formatValue(yMax), pad, pad);
        }
    }

    /** Format a world-coordinate value for display, trimming excess decimals. */
    private formatValue(v: number): string {
        // Use up to 2 decimal places, but strip trailing zeros
        return parseFloat(v.toFixed(2)).toString();
    }

    /** Choose a "nice" grid spacing (1, 2, or 5 × 10^n) so ~5–15 lines fit. */
    private niceGridStep(): number {
        const rough = this.viewHeight / 10;
        const pow = Math.pow(10, Math.floor(Math.log10(rough)));
        const norm = rough / pow;
        if (norm < 1.5) return pow;
        if (norm < 3.5) return 2 * pow;
        if (norm < 7.5) return 5 * pow;
        return 10 * pow;
    }

    /** Draw the world-coordinate label near the mouse cursor. */
    private drawCursorLabel(ctx: CanvasRenderingContext2D): void {
        if (this.cursorCanvasX === null || this.cursorCanvasY === null) return;

        const wx = this.canvasToWorldX(this.cursorCanvasX);
        const wy = this.canvasToWorldY(this.cursorCanvasY);
        const label = `(${this.formatValue(wx)}, ${this.formatValue(wy)})`;

        const dpr = window.devicePixelRatio || 1;
        const fontSize = 12 * dpr;
        const pad = 4 * dpr;
        const offset = 14 * dpr; // distance from cursor to label

        ctx.font = `${fontSize}px monospace`;
        const metrics = ctx.measureText(label);
        const textW = metrics.width;
        const textH = fontSize;

        // Position the label to the right and below the cursor by default,
        // but flip to the other side if it would go off-screen.
        let lx = this.cursorCanvasX + offset;
        let ly = this.cursorCanvasY + offset;

        if (lx + textW + pad > this.canvas.width) {
            lx = this.cursorCanvasX - offset - textW;
        }
        if (ly + textH + pad > this.canvas.height) {
            ly = this.cursorCanvasY - offset - textH;
        }

        // Background pill
        ctx.fillStyle = "rgba(30, 30, 30, 0.85)";
        ctx.fillRect(lx - pad, ly - pad, textW + pad * 2, textH + pad * 2);

        // Text
        ctx.fillStyle = "#ccc";
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        ctx.fillText(label, lx, ly);
    }

    /** Show a transient status message at the bottom of the canvas for a few seconds. */
    private showStatus(message: string, durationMs = 3000): void {
        if (this.statusTimer !== null) {
            clearTimeout(this.statusTimer);
        }
        this.statusMessage = message;
        this.statusTimer = setTimeout(() => {
            this.statusMessage = null;
            this.statusTimer = null;
            this.draw();
        }, durationMs);
    }

    /** Draw the status message centred at the bottom of the canvas. */
    private drawStatusMessage(ctx: CanvasRenderingContext2D): void {
        if (!this.statusMessage) return;

        const dpr = window.devicePixelRatio || 1;
        const fontSize = 14 * dpr;
        const pad = 6 * dpr;

        ctx.font = `${fontSize}px monospace`;
        const metrics = ctx.measureText(this.statusMessage);
        const textW = metrics.width;
        const textH = fontSize;

        const cx = this.canvas.width / 2;
        const by = this.canvas.height - pad * 2;

        // Background pill
        ctx.fillStyle = "rgba(30, 30, 30, 0.85)";
        ctx.fillRect(cx - textW / 2 - pad, by - textH - pad, textW + pad * 2, textH + pad * 2);

        // Text
        ctx.fillStyle = "#4fc3f7";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText(this.statusMessage, cx, by);
    }

    /** Draw all placed primitives. */
    private drawPrimitives(ctx: CanvasRenderingContext2D): void {
        const dpr = window.devicePixelRatio || 1;
        const pointRadius = 4 * dpr;

        // Draw lines
        ctx.lineWidth = 2 * dpr;
        for (const prim of this.sketch.getPrimitives()) {
            if (prim instanceof Line) {
                const isSelected = this.selectedPrimitive === prim;
                ctx.strokeStyle = isSelected ? "#fff" : "#4fc3f7";
                const x1 = this.worldToCanvasX(prim.start.x);
                const y1 = this.worldToCanvasY(prim.start.y);
                const x2 = this.worldToCanvasX(prim.end.x);
                const y2 = this.worldToCanvasY(prim.end.y);
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.stroke();
            }
        }

        // Draw points (on top of lines)
        for (const prim of this.sketch.getPrimitives()) {
            if (prim instanceof Point2) {
                const cx = this.worldToCanvasX(prim.x);
                const cy = this.worldToCanvasY(prim.y);
                const isHighlighted = this.pendingLineStart === prim;
                const isSelected = this.selectedPrimitive === prim;
                ctx.fillStyle = (isHighlighted || isSelected) ? "#fff" : "#4fc3f7";
                ctx.beginPath();
                ctx.arc(cx, cy, pointRadius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    /** Dispose of the observer and event listeners when no longer needed. */
    dispose(): void {
        this.resizeObserver.disconnect();
        this.canvas.removeEventListener("wheel", this.onWheel);
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
        this.canvas.removeEventListener("mousedown", this.onMouseDown);
        this.canvas.removeEventListener("mouseup", this.onMouseUp);
        this.canvas.removeEventListener("click", this.onClick);
        this.canvas.removeEventListener("contextmenu", this.onContextMenu);
        document.removeEventListener("keydown", this.onKeyDown);
    }
}
