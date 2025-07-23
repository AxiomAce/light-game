/**
 * @file Canvas绘图模块
 * @description 封装所有与Canvas 2D上下文直接交互的绘图函数，负责渲染应用的视觉表现。
 * 绘制策略：在界面主循环中不停循环调用draw()函数。
 */

import graph from "../model/graph.js";
import * as View from "./view.js";
import { solverState } from "../model/solver.js";

/**
 * @typedef {import('../model/graph.js').Node} Node
 * @typedef {import('../model/graph.js').Edge} Edge
 */

/**
 * @class Canvas
 * @description 负责管理Canvas 2D上下文，并提供绘图API。
 */
class CanvasView {
    #ctx;
    #canvasHTML;

    /**
     * 初始化Canvas模块。
     * @param {HTMLCanvasElement} _canvasHTML - 画布DOM元素。
     */
    init(_canvasHTML) {
        this.#canvasHTML = _canvasHTML;
        this.#ctx = this.#canvasHTML.getContext("2d");
        this.#setupCanvas();
    }

    /**
     * 响应窗口大小变化，重新设置画布尺寸。
     */
    resize() {
        this.#setupCanvas();
    }

    /**
     * 设置画布的鼠标光标样式。
     * @param {string} style - CSS cursor样式。
     */
    setCursor(style) {
        if (!this.#canvasHTML) return;
        this.#canvasHTML.style.cursor = style;
    }

    /**
     * 设置画布尺寸以匹配设备像素比，并适应窗口大小。
     */
    #setupCanvas() {
        if (!this.#canvasHTML) return;
        const dpr = window.devicePixelRatio || 1;
        const rect = this.#canvasHTML.getBoundingClientRect();
        this.#canvasHTML.width = rect.width * dpr;
        this.#canvasHTML.height = rect.height * dpr;
        this.#ctx.scale(dpr, dpr);
    }

    // ===================================================================
    // ========================   绘制 canvas   ===========================
    // ===================================================================

    /**
     * 主渲染函数，按预定顺序调用所有独立的绘图函数。
     */
    draw() {
        if (!this.#ctx) return;
        const rect = this.#canvasHTML.getBoundingClientRect();
        // Fill background first, in screen space
        this.#ctx.fillStyle = View.COLOR_BACKGROUND;
        this.#ctx.fillRect(0, 0, rect.width, rect.height);

        this.#ctx.save();
        this.#ctx.translate(
            View.viewState.viewOffset.x,
            View.viewState.viewOffset.y
        );
        this.#ctx.scale(View.viewState.zoom, View.viewState.zoom);

        this.#drawBackground(rect);
        this.#drawHoverHighlight();
        this.#drawSelectionHighlights();
        this.#drawSolutionHighlight();
        this.#drawEdges();
        this.#drawDragLine();
        this.#drawGhostNode();
        this.#drawSelectionBox();
        this.#drawNodes();

        this.#ctx.restore();
    }

    /**
     * 绘制画布背景和网格线。
     * @param {DOMRect} rect - 画布的边界矩形。
     */
    #drawBackground(rect) {
        this.#ctx.strokeStyle = View.COLOR_GRID_PRIMARY;
        this.#setLineWidth(View.LINE_WIDTH_GRID_PRIMARY);
        const S = View.INITIAL_GRID_SPACING;

        const viewXStart = -View.viewState.viewOffset.x / View.viewState.zoom;
        const viewYStart = -View.viewState.viewOffset.y / View.viewState.zoom;
        const viewXEnd = viewXStart + rect.width / View.viewState.zoom;
        const viewYEnd = viewYStart + rect.height / View.viewState.zoom;

        const gridXStart = Math.floor(viewXStart / S) * S;
        const gridYStart = Math.floor(viewYStart / S) * S;

        if (View.viewState.canvasLayout === "square") {
            this.#setLineWidth(View.LINE_WIDTH_GRID_PRIMARY);
            for (let x = gridXStart; x < viewXEnd; x += S) {
                this.#ctx.beginPath();
                this.#ctx.moveTo(x, viewYStart);
                this.#ctx.lineTo(x, viewYEnd);
                this.#ctx.stroke();
            }
            for (let y = gridYStart; y < viewYEnd; y += S) {
                this.#ctx.beginPath();
                this.#ctx.moveTo(viewXStart, y);
                this.#ctx.lineTo(viewXEnd, y);
                this.#ctx.stroke();
            }
            this.#ctx.strokeStyle = View.COLOR_GRID_SECONDARY;
            this.#setLineWidth(View.LINE_WIDTH_GRID_SECONDARY);

            for (let y = gridYStart; y < viewYEnd; y += S) {
                for (let x = gridXStart; x < viewXEnd; x += S) {
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(x, y);
                    this.#ctx.lineTo(x + S, y + S);
                    this.#ctx.stroke();
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(x + S, y);
                    this.#ctx.lineTo(x, y + S);
                    this.#ctx.stroke();
                }
            }
        } else if (View.viewState.canvasLayout === "triangular") {
            const h = (S * Math.sqrt(3)) / 2;
            const gridYStartTri = Math.floor(viewYStart / h) * h - h;

            for (let y = gridYStartTri; y < viewYEnd; y += h) {
                const staggerOffset = (Math.round(y / h) % 2) * (S / 2);
                const gridXStartTri =
                    Math.floor((viewXStart - staggerOffset) / S) * S +
                    staggerOffset -
                    S;

                for (let x = gridXStartTri; x < viewXEnd; x += S) {
                    const top = { x: x + S / 2, y: y };
                    const left = { x: x, y: y + h };
                    const right = { x: x + S, y: y + h };
                    const bottom = { x: x + S / 2, y: y + 2 * h };

                    this.#ctx.strokeStyle = View.COLOR_GRID_PRIMARY;
                    this.#setLineWidth(View.LINE_WIDTH_GRID_PRIMARY);
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(top.x, top.y);
                    this.#ctx.lineTo(left.x, left.y);
                    this.#ctx.moveTo(top.x, top.y);
                    this.#ctx.lineTo(right.x, right.y);
                    this.#ctx.moveTo(left.x, left.y);
                    this.#ctx.lineTo(right.x, right.y);
                    this.#ctx.stroke();

                    const centerDown = { x: top.x, y: y + (2 * h) / 3 };
                    this.#setLineWidth(View.LINE_WIDTH_GRID_SECONDARY);
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(top.x, top.y);
                    this.#ctx.lineTo(centerDown.x, centerDown.y);
                    this.#ctx.moveTo(left.x, left.y);
                    this.#ctx.lineTo(centerDown.x, centerDown.y);
                    this.#ctx.moveTo(right.x, right.y);
                    this.#ctx.lineTo(centerDown.x, centerDown.y);
                    this.#ctx.stroke();

                    const centerUp = { x: bottom.x, y: y + h + h / 3 };
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(left.x, left.y);
                    this.#ctx.lineTo(centerUp.x, centerUp.y);
                    this.#ctx.moveTo(right.x, right.y);
                    this.#ctx.lineTo(centerUp.x, centerUp.y);
                    this.#ctx.moveTo(bottom.x, bottom.y);
                    this.#ctx.lineTo(centerUp.x, centerUp.y);
                    this.#ctx.stroke();
                }
            }
        }
    }

    /**
     * 绘制所有节点，根据模式显示不同状态。
     */
    #drawNodes() {
        graph.getGraph().nodes.forEach((node) => {
            this.#ctx.beginPath();
            this.#ctx.arc(
                node.x,
                node.y,
                View.INITIAL_NODE_RADIUS,
                0,
                Math.PI * 2
            );
            this.#ctx.fillStyle = (
                View.viewState.currentMode === "solver"
                    ? node.on
                    : node.initialOn
            )
                ? View.COLOR_NODE_ON
                : View.COLOR_NODE_OFF;
            this.#ctx.fill();
            this.#ctx.strokeStyle = View.COLOR_STROKE_DEFAULT;
            this.#setLineWidth(View.LINE_WIDTH_DEFAULT);
            this.#ctx.stroke();
        });
    }

    /**
     * 绘制所有边。
     */
    #drawEdges() {
        graph.getGraph().edges.forEach((edge) => {
            const fromNode = graph.findNodeById(edge.source);
            const toNode = graph.findNodeById(edge.target);
            if (!fromNode || !toNode) return;
            this.#ctx.beginPath();
            this.#ctx.moveTo(fromNode.x, fromNode.y);
            this.#ctx.lineTo(toNode.x, toNode.y);
            this.#ctx.strokeStyle = View.COLOR_STROKE_DEFAULT;
            this.#setLineWidth(View.LINE_WIDTH_DEFAULT);
            this.#ctx.stroke();
        });
    }

    /**
     * 绘制鼠标悬停在元素上时的高亮效果。
     */
    #drawHoverHighlight() {
        if (View.viewState.currentMode !== "edit") return;

        const elementsToHighlight = [];
        if (View.viewState.hoveredElement) {
            elementsToHighlight.push(View.viewState.hoveredElement);
        }

        const ids = new Set(elementsToHighlight.map((e) => e.id));
        (View.viewState.boxSelectionHovered || []).forEach((sel) => {
            if (!ids.has(sel.id)) {
                elementsToHighlight.push(sel);
                ids.add(sel.id);
            }
        });

        elementsToHighlight.forEach((el) => {
            if (el.type === "node") {
                const node = graph.findNodeById(el.id);
                if (node) {
                    this.#ctx.beginPath();
                    this.#ctx.arc(
                        node.x,
                        node.y,
                        View.INITIAL_NODE_RADIUS +
                            View.HIGHLIGHT_PADDING / View.viewState.zoom,
                        0,
                        Math.PI * 2
                    );
                    this.#ctx.fillStyle = View.COLOR_HOVER;
                    this.#ctx.fill();
                }
            } else if (el.type === "edge") {
                const edge = graph.getGraph().edges.find((e) => e.id === el.id);
                if (edge) {
                    const fromNode = graph.findNodeById(edge.source);
                    const toNode = graph.findNodeById(edge.target);
                    if (!fromNode || !toNode) return;
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(fromNode.x, fromNode.y);
                    this.#ctx.lineTo(toNode.x, toNode.y);
                    this.#ctx.strokeStyle = View.COLOR_HOVER;
                    this.#setLineWidth(View.LINE_WIDTH_HIGHLIGHT);
                    this.#ctx.stroke();
                }
            }
        });
    }

    /**
     * 绘制选中元素的高亮效果。
     */
    #drawSelectionHighlights() {
        View.viewState.selectedElements.forEach((sel) => {
            if (sel.type === "node") {
                const node = graph.findNodeById(sel.id);
                if (node) {
                    this.#ctx.beginPath();
                    this.#ctx.arc(
                        node.x,
                        node.y,
                        View.INITIAL_NODE_RADIUS +
                            View.HIGHLIGHT_PADDING / View.viewState.zoom,
                        0,
                        Math.PI * 2
                    );
                    this.#ctx.fillStyle = View.COLOR_SELECTION;
                    this.#ctx.fill();
                }
            } else if (sel.type === "edge") {
                const edge = graph
                    .getGraph()
                    .edges.find((e) => e.id === sel.id);
                if (edge) {
                    const fromNode = graph.findNodeById(edge.source);
                    const toNode = graph.findNodeById(edge.target);
                    if (!fromNode || !toNode) return;
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(fromNode.x, fromNode.y);
                    this.#ctx.lineTo(toNode.x, toNode.y);
                    this.#ctx.strokeStyle = View.COLOR_SELECTION;
                    this.#setLineWidth(View.LINE_WIDTH_HIGHLIGHT);
                    this.#ctx.stroke();
                }
            }
        });
    }

    /**
     * 绘制用于预览新节点创建的“幽灵节点”。
     */
    #drawGhostNode() {
        if (
            View.viewState.ghostNodePos &&
            View.viewState.currentMode === "edit"
        ) {
            this.#ctx.beginPath();
            this.#ctx.arc(
                View.viewState.ghostNodePos.x,
                View.viewState.ghostNodePos.y,
                View.INITIAL_NODE_RADIUS,
                0,
                Math.PI * 2
            );
            this.#ctx.strokeStyle = View.COLOR_GHOST;
            this.#setLineWidth(View.LINE_WIDTH_DEFAULT);
            this.#ctx.stroke();
        }
    }

    /**
     * 绘制从节点拖拽出以创建边的引导线。
     */
    #drawDragLine() {
        if (
            View.viewState.dragging.isActive &&
            View.viewState.dragging.isIntentional &&
            View.viewState.dragging.type === "edge" &&
            View.viewState.dragging.currentPos
        ) {
            let startPos = View.viewState.dragging.startPos;
            if (View.viewState.dragging.fromNode) {
                startPos = {
                    x: View.viewState.dragging.fromNode.x,
                    y: View.viewState.dragging.fromNode.y,
                };
            }

            let endPos = View.viewState.dragging.currentPos;
            if (
                View.viewState.hoveredElement &&
                View.viewState.hoveredElement.type === "node"
            ) {
                const node = graph.findNodeById(
                    View.viewState.hoveredElement.id
                );
                if (node) endPos = { x: node.x, y: node.y };
            } else if (View.viewState.ghostNodePos) {
                endPos = View.viewState.ghostNodePos;
            }

            this.#ctx.beginPath();
            this.#ctx.moveTo(startPos.x, startPos.y);
            this.#ctx.lineTo(endPos.x, endPos.y);
            this.#ctx.strokeStyle = View.COLOR_DRAGLINE;
            this.#setLineWidth(View.LINE_WIDTH_DEFAULT);
            this.#ctx.stroke();
        }
    }

    /**
     * 绘制框选时的矩形选框。
     */
    #drawSelectionBox() {
        if (
            View.viewState.dragging.isActive &&
            View.viewState.dragging.type === "box" &&
            View.viewState.dragging.isIntentional &&
            View.viewState.dragging.currentPos
        ) {
            const { startPos, currentPos } = View.viewState.dragging;
            this.#ctx.fillStyle = View.COLOR_SELECTION_BOX_FILL;
            this.#ctx.strokeStyle = View.COLOR_SELECTION_BOX_STROKE;
            this.#setLineWidth(View.LINE_WIDTH_SELECTION_BOX);
            const rectX = Math.min(startPos.x, currentPos.x);
            const rectY = Math.min(startPos.y, currentPos.y);
            const rectW = Math.abs(startPos.x - currentPos.x);
            const rectH = Math.abs(startPos.y - currentPos.y);
            this.#ctx.fillRect(rectX, rectY, rectW, rectH);
            this.#ctx.strokeRect(rectX, rectY, rectW, rectH);
        }
    }

    /**
     * 绘制求解模式下解法的高亮提示。
     */
    #drawSolutionHighlight() {
        if (
            View.viewState.currentMode !== "solver" ||
            !solverState.solution.hasSolution
        )
            return;
        solverState.solution.nodesToPress.forEach((nodeId) => {
            const node = graph.findNodeById(nodeId);
            if (node) {
                this.#ctx.beginPath();
                this.#ctx.arc(
                    node.x,
                    node.y,
                    View.INITIAL_NODE_RADIUS +
                        View.HIGHLIGHT_PADDING / View.viewState.zoom,
                    0,
                    Math.PI * 2
                );
                this.#ctx.strokeStyle = View.COLOR_SOLUTION;
                this.#setLineWidth(View.LINE_WIDTH_HIGHLIGHT);
                this.#ctx.stroke();
            }
        });
    }

    // ===================================================================
    // ==========================   辅助函数   ============================
    // ===================================================================

    /**
     * 设置当前上下文的线宽，并根据缩放级别进行调整以保持视觉宽度不变。
     * @param {number} width - 期望的视觉线宽（像素）。
     */
    #setLineWidth(width) {
        this.#ctx.lineWidth = width / View.viewState.zoom;
    }

    /**
     * 缩放画布和所有元素。
     * @param {number} factor - 缩放因子。
     */
    zoom(factor) {
        const oldZoom = View.viewState.zoom;
        const newZoom = Math.max(
            View.MIN_GRID_SPACING / View.INITIAL_GRID_SPACING,
            Math.min(
                View.MAX_GRID_SPACING / View.INITIAL_GRID_SPACING,
                oldZoom * factor
            )
        );

        if (Math.abs(newZoom - oldZoom) < 1e-9) return;

        const rect = this.#canvasHTML.getBoundingClientRect();
        const center = { x: rect.width / 2, y: rect.height / 2 };

        const worldPos = {
            x: (center.x - View.viewState.viewOffset.x) / oldZoom,
            y: (center.y - View.viewState.viewOffset.y) / oldZoom,
        };

        View.viewState.viewOffset.x = center.x - worldPos.x * newZoom;
        View.viewState.viewOffset.y = center.y - worldPos.y * newZoom;
        View.viewState.zoom = newZoom;
    }

    /**
     * 重置视图状态（用于清空画布）。
     */
    resetView() {
        View.viewState.selectedElements = [];
        View.viewState.viewOffset = { x: 0, y: 0 };
        View.viewState.hoveredElement = null;
        View.viewState.ghostNodePos = null;
    }

    /**
     * 获取鼠标在画布“世界坐标”中的位置。
     * @param {MouseEvent} event - 鼠标事件对象。
     * @returns {{x: number, y: number}} 鼠标在画布内的“世界”坐标。
     */
    getMousePos(event) {
        const rect = this.#canvasHTML.getBoundingClientRect();
        return {
            x:
                (event.clientX - rect.left - View.viewState.viewOffset.x) /
                View.viewState.zoom,
            y:
                (event.clientY - rect.top - View.viewState.viewOffset.y) /
                View.viewState.zoom,
        };
    }

    /**
     * 获取指定坐标位置的元素（节点或边）。
     * @param {{x: number, y: number}} pos - 画布上的坐标。
     * @returns {{type: string, element: Node | Edge} | null} 找到的元素信息或null。
     */
    getElementAtPos(pos) {
        const { nodes, edges } = graph.getGraph();
        // 节点优先
        for (let i = nodes.length - 1; i >= 0; i--) {
            const node = nodes[i];
            const dist = Math.sqrt(
                (pos.x - node.x) ** 2 + (pos.y - node.y) ** 2
            );
            if (dist <= View.INITIAL_NODE_RADIUS)
                return { type: "node", element: node };
        }
        // 再检查边
        for (let i = edges.length - 1; i >= 0; i--) {
            const edge = edges[i];
            const fromNode = graph.findNodeById(edge.source);
            const toNode = graph.findNodeById(edge.target);
            if (!fromNode || !toNode) continue;
            const distSq = pointToSegmentDistSq(pos, fromNode, toNode);
            if (distSq < (View.EDGE_CLICK_TOLERANCE / View.viewState.zoom) ** 2)
                return { type: "edge", element: edge };
        }
        return null;
    }

    /**
     * 获取指定矩形框内的所有元素。
     * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形框坐标。
     * @returns {Array<{type: string, id: string}>}
     */
    getElementsInBox(rect) {
        const elements = [];
        const { nodes, edges } = graph.getGraph();

        nodes.forEach((node) => {
            if (nodeIntersectsRect(node, View.INITIAL_NODE_RADIUS, rect)) {
                elements.push({ type: "node", id: node.id });
            }
        });

        edges.forEach((edge) => {
            const fromNode = graph.findNodeById(edge.source);
            const toNode = graph.findNodeById(edge.target);
            const toleranceSq =
                (View.EDGE_CLICK_TOLERANCE / View.viewState.zoom) ** 2;
            if (
                fromNode &&
                toNode &&
                edgeIntersectsRect(fromNode, toNode, toleranceSq, rect)
            ) {
                if (!elements.find((el) => el.id === edge.id)) {
                    elements.push({ type: "edge", id: edge.id });
                }
            }
        });

        return elements;
    }

    /**
     * 计算“幽灵节点”的吸附位置。
     * @param {{x: number, y: number}} pos - 鼠标当前坐标。
     * @returns {{x: number, y: number} | null} 吸附点坐标或null。
     */
    calculateGhostNodePos(pos) {
        if (View.viewState.currentMode !== "edit") return null;
        const snappedPos = this.snapToGrid(pos);
        const dist = Math.sqrt(
            (pos.x - snappedPos.x) ** 2 + (pos.y - snappedPos.y) ** 2
        );
        const nodeExists = graph.hasNodeAt(snappedPos);
        return dist <= View.INITIAL_NODE_RADIUS && !nodeExists
            ? snappedPos
            : null;
    }

    /**
     * 将坐标吸附到最近的网格点。
     * @param {{x: number, y: number}} pos - 原始坐标。
     * @returns {{x: number, y: number}} 吸附后的坐标。
     */
    snapToGrid({ x, y }) {
        const S = View.INITIAL_GRID_SPACING;
        if (View.viewState.canvasLayout === "square") {
            const points = [
                { x: Math.round(x / S) * S, y: Math.round(y / S) * S },
                {
                    x: Math.round(x / S - 0.5) * S + 0.5 * S,
                    y: Math.round(y / S - 0.5) * S + 0.5 * S,
                },
            ];
            return points.reduce((closest, p) =>
                (x - p.x) ** 2 + (y - p.y) ** 2 <
                (x - closest.x) ** 2 + (y - closest.y) ** 2
                    ? p
                    : closest
            );
        }
        if (View.viewState.canvasLayout === "triangular") {
            const h = (S * Math.sqrt(3)) / 2;
            const row = Math.floor(y / h);
            let candidates = [];
            for (let r_offset = -1; r_offset <= 1; r_offset++) {
                const r = row + r_offset;
                const staggerOffset = (r % 2) * (S / 2);
                const col = Math.floor((x - staggerOffset) / S);
                for (let c_offset = -1; c_offset <= 1; c_offset++) {
                    const c = col + c_offset;
                    const rhombusX = c * S + staggerOffset;
                    const rhombusY = r * h;
                    candidates.push(
                        { x: rhombusX + S / 2, y: rhombusY },
                        { x: rhombusX, y: rhombusY + h },
                        { x: rhombusX + S, y: rhombusY + h },
                        { x: rhombusX + S / 2, y: rhombusY + (2 * h) / 3 },
                        { x: rhombusX + S / 2, y: rhombusY + h + h / 3 }
                    );
                }
            }
            return candidates.reduce((closest, p) =>
                (x - p.x) ** 2 + (y - p.y) ** 2 <
                (x - closest.x) ** 2 + (y - closest.y) ** 2
                    ? p
                    : closest
            );
        }
        return { x, y };
    }
}

const canvasView = new CanvasView();
export default canvasView;

// ===================================================================
// ======================   Selection utils   ========================
// ===================================================================

/**
 * 检查一个圆形节点是否与一个矩形相交。
 * @private
 * @param {Node} node - 要检查的节点对象。
 * @param {number} r - 节点半径。
 * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形选框。
 * @returns {boolean} 如果相交则返回 true。
 */
function nodeIntersectsRect(node, r, rect) {
    const { x: cx, y: cy } = node;
    const { x1, y1, x2, y2 } = rect;
    const testX = Math.max(x1, Math.min(cx, x2));
    const testY = Math.max(y1, Math.min(cy, y2));
    const distX = cx - testX;
    const distY = cy - testY;
    const distanceSq = distX * distX + distY * distY;
    return distanceSq <= r * r;
}

/**
 * 检查一条边（线段）是否与一个矩形相交, 包含容差。
 * @private
 * @param {Node} node1 - 边的起始节点。
 * @param {Node} node2 - 边的结束节点。
 * @param {number} toleranceSq - 容差平方。
 * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形选框。
 * @returns {boolean} 如果相交则返回 true。
 */
function edgeIntersectsRect(node1, node2, toleranceSq, rect) {
    // 1. 首先检查是否存在直接的几何相交，这能处理选框穿过边的情况。
    if (edgeIntersectsRectGeometrically(node1, node2, rect)) {
        return true;
    }

    // 2. 如果不相交，再检查它们之间的距离是否在容差范围内。
    //    这能处理选框与边“擦肩而过”的情况。
    const p1 = { x: node1.x, y: node1.y };
    const p2 = { x: node2.x, y: node2.y };

    // 检查从线段端点到矩形的距离
    if (pointToRectDistSq(p1, rect) < toleranceSq) {
        return true;
    }
    if (pointToRectDistSq(p2, rect) < toleranceSq) {
        return true;
    }

    // 检查从矩形顶点到线段的距离
    const corners = [
        { x: rect.x1, y: rect.y1 },
        { x: rect.x2, y: rect.y1 },
        { x: rect.x2, y: rect.y2 },
        { x: rect.x1, y: rect.y2 },
    ];
    for (const corner of corners) {
        if (pointToSegmentDistSq(corner, p1, p2) < toleranceSq) {
            return true;
        }
    }

    return false;
}

/**
 * 检查一条边（线段）是否与一个矩形几何相交（无容差）。
 * @private
 * @param {Node} node1 - 边的起始节点。
 * @param {Node} node2 - 边的结束节点。
 * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形选框。
 * @returns {boolean} 如果相交则返回 true。
 */
function edgeIntersectsRectGeometrically(node1, node2, rect) {
    const p1 = { x: node1.x, y: node1.y };
    const p2 = { x: node2.x, y: node2.y };
    const { x1, y1, x2, y2 } = rect;

    // 检查是否有任一端点在矩形内部
    if (
        (p1.x >= x1 && p1.x <= x2 && p1.y >= y1 && p1.y <= y2) ||
        (p2.x >= x1 && p2.x <= x2 && p2.y >= y1 && p2.y <= y2)
    ) {
        return true;
    }

    // 检查线段是否与矩形的任一边相交
    const rectSides = [
        [
            { x: x1, y: y1 },
            { x: x2, y: y1 },
        ],
        [
            { x: x2, y: y1 },
            { x: x2, y: y2 },
        ],
        [
            { x: x1, y: y2 },
            { x: x2, y: y2 },
        ],
        [
            { x: x1, y: y1 },
            { x: x1, y: y2 },
        ],
    ];

    for (const side of rectSides) {
        if (lineSegmentIntersectsLineSegment(p1, p2, side[0], side[1])) {
            return true;
        }
    }
    return false;
}

/**
 * 检查两个线段是否相交。
 * @private
 * @param {{x: number, y: number}} p1 - 第一个线段的起点。
 * @param {{x: number, y: number}} p2 - 第一个线段的终点。
 * @param {{x: number, y: number}} p3 - 第二个线段的起点。
 * @param {{x: number, y: number}} p4 - 第二个线段的终点。
 * @returns {boolean} 如果相交则返回 true。
 */
function lineSegmentIntersectsLineSegment(p1, p2, p3, p4) {
    const { x: x1, y: y1 } = p1;
    const { x: x2, y: y2 } = p2;
    const { x: x3, y: y3 } = p3;
    const { x: x4, y: y4 } = p4;

    const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (den === 0) return false;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

    return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * 计算点到矩形的最近距离的平方。
 * @private
 * @param {{x: number, y: number}} p - 点。
 * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形。
 * @returns {number} 距离的平方。
 */
function pointToRectDistSq(p, rect) {
    const dx = Math.max(rect.x1 - p.x, 0, p.x - rect.x2);
    const dy = Math.max(rect.y1 - p.y, 0, p.y - rect.y2);
    return dx * dx + dy * dy;
}

/**
 * 计算点到线段的最近距离的平方。
 * @private
 * @param {{x: number, y: number}} p - 点。
 * @param {{x: number, y: number}} a - 线段的起点。
 * @param {{x: number, y: number}} b - 线段的终点。
 * @returns {number} 距离的平方。
 */
function pointToSegmentDistSq(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        // a and b are the same point
        return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const closestX = a.x + t * dx;
    const closestY = a.y + t * dy;
    return (p.x - closestX) ** 2 + (p.y - closestY) ** 2;
}
