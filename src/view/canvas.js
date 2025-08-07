/**
 * @file Canvas绘图模块
 * @description 封装所有与Canvas 2D上下文直接交互的绘图函数，负责渲染应用的视觉表现。
 * 绘制策略：在界面主循环中不停循环调用draw()函数。
 */

import graph, { NodeType, graphState, GridType } from "../model/graph.js";
import * as View from "./view.js";
import {
    DraggingType,
    ModeType,
    canZoomIn,
    canZoomOut,
    getZoomRatio,
} from "./view.js";
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
    /** @type {CanvasRenderingContext2D} 2D上下文 */
    #ctx;
    /** @type {HTMLCanvasElement} 画布的DOM元素 */
    #canvasHTML;

    /**
     * 初始化Canvas模块。
     */
    init() {
        this.#canvasHTML = /** @type {HTMLCanvasElement} */ (
            document.getElementById("canvas-html")
        );
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
        this.#ctx.scale(getZoomRatio(), getZoomRatio());

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
        const S = View.INITIAL_GRID_SPACING;

        // 计算当前视口的世界坐标范围
        const viewXStart = -View.viewState.viewOffset.x / getZoomRatio();
        const viewYStart = -View.viewState.viewOffset.y / getZoomRatio();
        const viewXEnd = viewXStart + rect.width / getZoomRatio();
        const viewYEnd = viewYStart + rect.height / getZoomRatio();

        if (graphState.grid === GridType.SQUARE) {
            // --- 绘制正方形网格 ---
            // 计算可见区域需要绘制的网格线范围，并增加一些余量以确保完全覆盖
            const gridX_min = Math.floor(viewXStart / S) - 1;
            const gridX_max = Math.ceil(viewXEnd / S) + 1;
            const gridY_min = Math.floor(viewYStart / S) - 1;
            const gridY_max = Math.ceil(viewYEnd / S) + 1;

            // 绘制主网格线 (垂直和水平)
            this.#ctx.strokeStyle = View.COLOR_GRID_PRIMARY;
            this.#setLineWidth(View.LINE_WIDTH_GRID_PRIMARY);
            this.#ctx.beginPath();

            // 绘制所有可见的垂直线
            for (let gridX = gridX_min; gridX <= gridX_max; gridX++) {
                const p = gridToPixel(
                    {
                        gridX: gridX,
                        gridY: 0,
                        type: NodeType.SQUARE_VERTEX,
                    },
                    GridType.SQUARE
                );
                this.#ctx.moveTo(p.x, viewYStart);
                this.#ctx.lineTo(p.x, viewYEnd);
            }
            // 绘制所有可见的水平线
            for (let gridY = gridY_min; gridY <= gridY_max; gridY++) {
                const p = gridToPixel(
                    {
                        gridX: 0,
                        gridY: gridY,
                        type: NodeType.SQUARE_VERTEX,
                    },
                    GridType.SQUARE
                );
                this.#ctx.moveTo(viewXStart, p.y);
                this.#ctx.lineTo(viewXEnd, p.y);
            }
            this.#ctx.stroke();

            // 绘制次要网格线 (对角线)
            this.#ctx.strokeStyle = View.COLOR_GRID_SECONDARY;
            this.#setLineWidth(View.LINE_WIDTH_GRID_SECONDARY);
            this.#ctx.beginPath();

            for (let gridY = gridY_min; gridY < gridY_max; gridY++) {
                for (let gridX = gridX_min; gridX < gridX_max; gridX++) {
                    const p_tl = gridToPixel(
                        {
                            gridX: gridX,
                            gridY: gridY,
                            type: NodeType.SQUARE_VERTEX,
                        },
                        GridType.SQUARE
                    );
                    const p_tr = { x: p_tl.x + S, y: p_tl.y };
                    const p_bl = { x: p_tl.x, y: p_tl.y + S };
                    const p_br = { x: p_tl.x + S, y: p_tl.y + S };

                    // 绘制两条对角线
                    this.#ctx.moveTo(p_tl.x, p_tl.y);
                    this.#ctx.lineTo(p_br.x, p_br.y);
                    this.#ctx.moveTo(p_tr.x, p_tr.y);
                    this.#ctx.lineTo(p_bl.x, p_bl.y);
                }
            }
            this.#ctx.stroke();
        } else if (graphState.grid === GridType.TRIANGULAR) {
            // --- 绘制三角形网格 ---
            const h = (S * Math.sqrt(3)) / 2; // 等边三角形的高度
            // 计算可见区域需要绘制的网格线范围，并增加一些余量以确保完全覆盖
            const gridY_min = Math.floor(viewYStart / h) - 1;
            const gridY_max = Math.ceil(viewYEnd / h) + 1;
            const gridX_min = Math.floor(viewXStart / S) - 2;
            const gridX_max = Math.ceil(viewXEnd / S) + 2;

            // 绘制主网格线 (构成所有三角形的边)
            this.#ctx.strokeStyle = View.COLOR_GRID_PRIMARY;
            this.#setLineWidth(View.LINE_WIDTH_GRID_PRIMARY);
            this.#ctx.beginPath();

            for (let gridY = gridY_min; gridY < gridY_max; gridY++) {
                for (let gridX = gridX_min; gridX < gridX_max; gridX++) {
                    // 将每个逻辑顶点(gridX, gridY)视为一个朝上(▲)三角形的顶尖
                    const p_tip = gridToPixel(
                        {
                            gridX: gridX,
                            gridY: gridY,
                            type: NodeType.TRIANGLE_VERTEX,
                        },
                        GridType.TRIANGULAR
                    );

                    // 从顶尖的几何位置推导出底部的两个顶点
                    const p_base_L = { x: p_tip.x - S / 2, y: p_tip.y + h };
                    const p_base_R = { x: p_tip.x + S / 2, y: p_tip.y + h };

                    // 绘制这个朝上三角形的三个边
                    this.#ctx.moveTo(p_tip.x, p_tip.y);
                    this.#ctx.lineTo(p_base_L.x, p_base_L.y);
                    this.#ctx.lineTo(p_base_R.x, p_base_R.y);
                    this.#ctx.closePath();
                }
            }
            this.#ctx.stroke();

            // 绘制次要网格线 (从三角形中心到其顶点)
            this.#ctx.strokeStyle = View.COLOR_GRID_SECONDARY;
            this.#setLineWidth(View.LINE_WIDTH_GRID_SECONDARY);
            this.#ctx.beginPath();

            // 遍历所有可见的网格单元，为每个朝上和朝下的三角形绘制中心连线
            for (let gridY = gridY_min; gridY < gridY_max; gridY++) {
                for (let gridX = gridX_min; gridX < gridX_max; gridX++) {
                    // --- 1. 处理以 (gridX, gridY) 为顶尖的朝上(▲)三角形 ---
                    const p_tip = gridToPixel(
                        {
                            gridX: gridX,
                            gridY: gridY,
                            type: NodeType.TRIANGLE_VERTEX,
                        },
                        GridType.TRIANGULAR
                    );
                    const p_base_L = { x: p_tip.x - S / 2, y: p_tip.y + h };
                    const p_base_R = { x: p_tip.x + S / 2, y: p_tip.y + h };
                    // ▲ 三角形的重心在顶尖下方 2/3 高度处
                    const p_center_up = {
                        x: p_tip.x,
                        y: p_tip.y + (2 * h) / 3,
                    };

                    // 绘制从中心到三个顶点的连线
                    this.#ctx.moveTo(p_center_up.x, p_center_up.y);
                    this.#ctx.lineTo(p_tip.x, p_tip.y);
                    this.#ctx.moveTo(p_center_up.x, p_center_up.y);
                    this.#ctx.lineTo(p_base_L.x, p_base_L.y);
                    this.#ctx.moveTo(p_center_up.x, p_center_up.y);
                    this.#ctx.lineTo(p_base_R.x, p_base_R.y);

                    // --- 2. 处理与上述▲三角形相邻的朝下(▼)三角形 ---
                    // 这个▼三角形由两个相邻的顶尖和它们共享的底边顶点构成
                    const v1 = p_tip;
                    const v2 = gridToPixel(
                        {
                            gridX: gridX + 1,
                            gridY: gridY,
                            type: NodeType.TRIANGLE_VERTEX,
                        },
                        GridType.TRIANGULAR
                    );
                    const v3 = p_base_R; // (p_tip.x + S/2, p_tip.y + h)
                    // ▼ 三角形的重心在其几何中心
                    const p_center_down = {
                        x: p_tip.x + S / 2,
                        y: p_tip.y + h / 3,
                    };

                    // 绘制从中心到三个顶点的连线
                    this.#ctx.moveTo(p_center_down.x, p_center_down.y);
                    this.#ctx.lineTo(v1.x, v1.y);
                    this.#ctx.moveTo(p_center_down.x, p_center_down.y);
                    this.#ctx.lineTo(v2.x, v2.y);
                    this.#ctx.moveTo(p_center_down.x, p_center_down.y);
                    this.#ctx.lineTo(v3.x, v3.y);
                }
            }
            this.#ctx.stroke();
        }
    }

    /**
     * 绘制所有节点，根据模式显示不同状态。
     */
    #drawNodes() {
        graph.getGraph().nodes.forEach((node) => {
            const pos = gridToPixel(node, graphState.grid);
            this.#ctx.beginPath();
            this.#ctx.arc(
                pos.x,
                pos.y,
                View.INITIAL_NODE_RADIUS,
                0,
                Math.PI * 2
            );
            this.#ctx.fillStyle = (
                View.viewState.currentMode === ModeType.SOLVER
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

            const fromPos = gridToPixel(fromNode, graphState.grid);
            const toPos = gridToPixel(toNode, graphState.grid);

            this.#ctx.beginPath();
            this.#ctx.moveTo(fromPos.x, fromPos.y);
            this.#ctx.lineTo(toPos.x, toPos.y);
            this.#ctx.strokeStyle = View.COLOR_STROKE_DEFAULT;
            this.#setLineWidth(View.LINE_WIDTH_DEFAULT);
            this.#ctx.stroke();
        });
    }

    /**
     * 绘制鼠标悬停在元素上时的高亮效果。
     */
    #drawHoverHighlight() {
        if (View.viewState.currentMode !== ModeType.EDIT) return;

        // --- 获取需要高亮的元素 ---
        let elementsToHighlight = [];
        if (View.viewState.dragging.type === DraggingType.BOX_DRAG) {
            // 框选时的高亮
            const { startPos } = View.viewState.dragging;
            const endPos = View.viewState.mousePos;
            const rect = {
                x1: Math.min(startPos.x, endPos.x),
                y1: Math.min(startPos.y, endPos.y),
                x2: Math.max(startPos.x, endPos.x),
                y2: Math.max(startPos.y, endPos.y),
            };
            elementsToHighlight = this.getElementsInBox(rect);
        } else if (
            View.viewState.dragging.type === DraggingType.NULL ||
            View.viewState.dragging.type === DraggingType.PRESSED ||
            View.viewState.dragging.type === DraggingType.EDGE_DRAG
        ) {
            // 空闲或拖拽创建边时的高亮
            const hoveredElement = this.getElementAtPos(
                View.viewState.mousePos
            );
            if (hoveredElement) {
                // 不高亮选中的节点（因为选中时会高亮）
                if (
                    View.viewState.selectedElements.some(
                        (s) => s.id === hoveredElement.element.id
                    )
                ) {
                    // DO NOTHING
                } else {
                    elementsToHighlight.push({
                        type: hoveredElement.type,
                        id: hoveredElement.element.id,
                    });
                }
            }
        }

        // --- 绘制高亮效果 ---
        elementsToHighlight.forEach((el) => {
            if (el.type === "node") {
                const node = graph.findNodeById(el.id);
                if (node) {
                    const pos = gridToPixel(node, graphState.grid);
                    this.#ctx.beginPath();
                    this.#ctx.arc(
                        pos.x,
                        pos.y,
                        View.INITIAL_NODE_RADIUS +
                            View.HIGHLIGHT_PADDING / getZoomRatio(),
                        0,
                        Math.PI * 2
                    );
                    this.#ctx.fillStyle = View.COLOR_HOVER;
                    this.#ctx.fill();
                }
            } else if (el.type === "edge") {
                // Creating an edge does not highlight hovered edges.
                if (
                    View.viewState.dragging.type !== DraggingType.PRESSED &&
                    View.viewState.dragging.type !== DraggingType.EDGE_DRAG
                ) {
                    const edge = graph
                        .getGraph()
                        .edges.find((e) => e.id === el.id);
                    if (edge) {
                        const fromNode = graph.findNodeById(edge.source);
                        const toNode = graph.findNodeById(edge.target);
                        if (!fromNode || !toNode) return;
                        const fromPos = gridToPixel(fromNode, graphState.grid);
                        const toPos = gridToPixel(toNode, graphState.grid);
                        this.#ctx.beginPath();
                        this.#ctx.moveTo(fromPos.x, fromPos.y);
                        this.#ctx.lineTo(toPos.x, toPos.y);
                        this.#ctx.strokeStyle = View.COLOR_HOVER;
                        this.#setLineWidth(View.LINE_WIDTH_HIGHLIGHT);
                        this.#ctx.stroke();
                    }
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
                    const pos = gridToPixel(node, graphState.grid);
                    this.#ctx.beginPath();
                    this.#ctx.arc(
                        pos.x,
                        pos.y,
                        View.INITIAL_NODE_RADIUS +
                            View.HIGHLIGHT_PADDING / getZoomRatio(),
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
                    const fromPos = gridToPixel(fromNode, graphState.grid);
                    const toPos = gridToPixel(toNode, graphState.grid);
                    this.#ctx.beginPath();
                    this.#ctx.moveTo(fromPos.x, fromPos.y);
                    this.#ctx.lineTo(toPos.x, toPos.y);
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
        if (View.viewState.currentMode !== ModeType.EDIT) return;

        // 幽灵节点只在非拖拽或拖拽创建边时显示
        const { type } = View.viewState.dragging;
        if (
            type !== DraggingType.NULL &&
            type !== DraggingType.PRESSED &&
            type !== DraggingType.EDGE_DRAG
        ) {
            return;
        }

        const ghostNodePos = this.calculateGhostNodePos(
            View.viewState.mousePos
        );
        if (ghostNodePos) {
            const pos = gridToPixel(ghostNodePos, graphState.grid);
            this.#ctx.beginPath();
            this.#ctx.arc(
                pos.x,
                pos.y,
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
        if (View.viewState.dragging.type === DraggingType.EDGE_DRAG) {
            let startPos;
            if (View.viewState.dragging.fromNode) {
                startPos = gridToPixel(
                    View.viewState.dragging.fromNode,
                    graphState.grid
                );
            } else {
                startPos = View.viewState.dragging.startPos;
            }

            let endPos = View.viewState.mousePos;
            const hoveredElement = this.getElementAtPos(endPos);
            const ghostNodePos = this.calculateGhostNodePos(endPos);

            if (hoveredElement && hoveredElement.type === "node") {
                const node = graph.findNodeById(hoveredElement.element.id);
                if (node) endPos = gridToPixel(node, graphState.grid);
            } else if (ghostNodePos) {
                endPos = gridToPixel(ghostNodePos, graphState.grid);
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
        if (View.viewState.dragging.type === DraggingType.BOX_DRAG) {
            const { startPos } = View.viewState.dragging;
            const endPos = View.viewState.mousePos;
            this.#ctx.fillStyle = View.COLOR_SELECTION_BOX_FILL;
            this.#ctx.strokeStyle = View.COLOR_SELECTION_BOX_STROKE;
            this.#setLineWidth(View.LINE_WIDTH_SELECTION_BOX);
            const rectX = Math.min(startPos.x, endPos.x);
            const rectY = Math.min(startPos.y, endPos.y);
            const rectW = Math.abs(startPos.x - endPos.x);
            const rectH = Math.abs(startPos.y - endPos.y);
            this.#ctx.fillRect(rectX, rectY, rectW, rectH);
            this.#ctx.strokeRect(rectX, rectY, rectW, rectH);
        }
    }

    /**
     * 绘制求解模式下解法的高亮提示。
     */
    #drawSolutionHighlight() {
        if (
            View.viewState.currentMode !== ModeType.SOLVER ||
            !solverState.solution.hasSolution
        )
            return;
        solverState.solution.nodesToPress.forEach((nodeId) => {
            const node = graph.findNodeById(nodeId);
            if (node) {
                const pos = gridToPixel(node, graphState.grid);
                this.#ctx.beginPath();
                this.#ctx.arc(
                    pos.x,
                    pos.y,
                    View.INITIAL_NODE_RADIUS +
                        View.LINE_WIDTH_HIGHLIGHT / getZoomRatio(),
                    0,
                    Math.PI * 2
                );
                this.#ctx.fillStyle = View.COLOR_SOLUTION;
                this.#ctx.fill();
            }
        });
    }

    // ===================================================================
    // ==========================   绘制辅助   ============================
    // ===================================================================

    /**
     * 设置当前上下文的线宽，并根据缩放级别进行调整以保持视觉宽度不变。
     * @param {number} width - 期望的视觉线宽（像素）。
     */
    #setLineWidth(width) {
        this.#ctx.lineWidth = width / getZoomRatio();
    }

    /**
     * 缩放画布和所有元素。
     * @param {number} delta - 缩放等级变化量。
     * @returns {boolean} 操作是否成功执行。
     */
    zoomLevelChange(delta) {
        const oldZoomRatio = getZoomRatio();

        // TODO
        if (!canZoomIn() && delta > 0) return false;
        if (!canZoomOut() && delta < 0) return false;

        let newZoomLevel = View.viewState.zoomLevel + delta;
        newZoomLevel = Math.max(View.MIN_ZOOM_LEVEL, newZoomLevel);
        newZoomLevel = Math.min(View.MAX_ZOOM_LEVEL, newZoomLevel);
        View.viewState.zoomLevel = newZoomLevel;

        const newZoomRatio = getZoomRatio();

        const rect = this.#canvasHTML.getBoundingClientRect();
        const center = { x: rect.width / 2, y: rect.height / 2 };

        const worldPos = {
            x: (center.x - View.viewState.viewOffset.x) / oldZoomRatio,
            y: (center.y - View.viewState.viewOffset.y) / oldZoomRatio,
        };

        View.viewState.viewOffset.x = center.x - worldPos.x * newZoomRatio;
        View.viewState.viewOffset.y = center.y - worldPos.y * newZoomRatio;
        return true;
    }

    /**
     * 重置视图状态（用于清空画布）。
     */
    resetView() {
        View.viewState.selectedElements = [];
        View.viewState.viewOffset = { x: 0, y: 0 };
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
            const nodePos = gridToPixel(node, graphState.grid);
            const dist = Math.sqrt(
                (pos.x - nodePos.x) ** 2 + (pos.y - nodePos.y) ** 2
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
            const fromPos = gridToPixel(fromNode, graphState.grid);
            const toPos = gridToPixel(toNode, graphState.grid);
            const distSq = pointToSegmentDistSq(pos, fromPos, toPos);
            if (distSq < (View.EDGE_CLICK_TOLERANCE / getZoomRatio()) ** 2)
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
            const nodePos = gridToPixel(node, graphState.grid);
            if (
                nodeCircleIntersectsRect(
                    nodePos,
                    View.INITIAL_NODE_RADIUS,
                    rect
                )
            ) {
                elements.push({ type: "node", id: node.id });
            }
        });

        edges.forEach((edge) => {
            const fromNode = graph.findNodeById(edge.source);
            const toNode = graph.findNodeById(edge.target);
            const fromPos = gridToPixel(fromNode, graphState.grid);
            const toPos = gridToPixel(toNode, graphState.grid);
            const toleranceSq =
                (View.EDGE_CLICK_TOLERANCE / getZoomRatio()) ** 2;
            if (
                fromNode &&
                toNode &&
                edgeIntersectsRect(fromPos, toPos, toleranceSq, rect)
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
     * @returns {{gridX: number, gridY: number, type: number} | null} 吸附点坐标或null。
     */
    calculateGhostNodePos(pos) {
        if (View.viewState.currentMode !== ModeType.EDIT) return null;
        const snappedGridPos = pixelToGrid(pos, graphState.grid);
        if (!snappedGridPos) return null;

        const snappedPixelPos = gridToPixel(snappedGridPos, graphState.grid);
        const dist = Math.sqrt(
            (pos.x - snappedPixelPos.x) ** 2 + (pos.y - snappedPixelPos.y) ** 2
        );
        const nodeExists = graph.hasNodeAtGridPos(snappedGridPos);
        return dist <= View.INITIAL_NODE_RADIUS && !nodeExists
            ? snappedGridPos
            : null;
    }

    /**
     * 计算并返回图中所有节点的像素坐标边界。
     * @returns {{minX: number, minY: number, maxX: number, maxY: number} | null}
     */
    getGraphBounds() {
        const { nodes } = graph.getGraph();
        if (nodes.length === 0) return null;

        const bounds = {
            minX: Infinity,
            minY: Infinity,
            maxX: -Infinity,
            maxY: -Infinity,
        };

        nodes.forEach((node) => {
            const pos = gridToPixel(node, graphState.grid);
            bounds.minX = Math.min(bounds.minX, pos.x);
            bounds.maxX = Math.max(bounds.maxX, pos.x);
            bounds.minY = Math.min(bounds.minY, pos.y);
            bounds.maxY = Math.max(bounds.maxY, pos.y);
        });

        return bounds;
    }
}

const canvasView = new CanvasView();
export default canvasView;

// ===================================================================
// =======================   Selection utils   =======================
// ===================================================================

/**
 * 检查一个圆形节点是否与一个矩形相交。
 * @private
 * @param {{x: number, y: number}} center - 圆心坐标。
 * @param {number} r - 圆的半径。
 * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形选框。
 * @returns {boolean} 如果相交则返回 true。
 */
function nodeCircleIntersectsRect(center, r, rect) {
    const { x: cx, y: cy } = center;
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
 * @param {{x: number, y: number}} pos1 - 线段的起点坐标。
 * @param {{x: number, y: number}} pos2 - 线段的终点坐标。
 * @param {number} toleranceSq - 容差平方。
 * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形选框。
 * @returns {boolean} 如果相交则返回 true。
 */
function edgeIntersectsRect(pos1, pos2, toleranceSq, rect) {
    // 1. 首先检查是否存在直接的几何相交，这能处理选框穿过边的情况。
    if (edgeIntersectsRectGeometrically(pos1, pos2, rect)) {
        return true;
    }

    // 2. 如果不相交，再检查它们之间的距离是否在容差范围内。
    //    这能处理选框与边“擦肩而过”的情况。
    const p1 = { x: pos1.x, y: pos1.y };
    const p2 = { x: pos2.x, y: pos2.y };

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
 * @param {{x: number, y: number}} pos1 - 线段的起点坐标。
 * @param {{x: number, y: number}} pos2 - 线段的终点坐标。
 * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 矩形选框。
 * @returns {boolean} 如果相交则返回 true。
 */
function edgeIntersectsRectGeometrically(pos1, pos2, rect) {
    const p1 = { x: pos1.x, y: pos1.y };
    const p2 = { x: pos2.x, y: pos2.y };
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

// ===================================================================
// ====================   Grid -- Pixel utils   ======================
// ===================================================================

/**
 * 将抽象网格坐标转换为像素坐标。
 * @param {{gridX: number, gridY: number, type: NodeType}} gridPos - 抽象坐标。
 * @param {GridType} grid - 当前的网格类型。
 * @returns {{x: number, y: number}} 像素坐标。
 */
export function gridToPixel(gridPos, grid) {
    const S = View.INITIAL_GRID_SPACING;
    const { gridX, gridY, type } = gridPos;

    if (grid === GridType.SQUARE) {
        if (type === NodeType.SQUARE_VERTEX) {
            return { x: gridX * S, y: gridY * S };
        }
        if (type === NodeType.SQUARE_CENTER) {
            return { x: (gridX + 0.5) * S, y: (gridY + 0.5) * S };
        }
    }

    if (grid === GridType.TRIANGULAR) {
        const h = (S * Math.sqrt(3)) / 2;

        if (type === NodeType.TRIANGLE_VERTEX) {
            const staggerOffset = (gridY % 2) * (S / 2);
            return { x: gridX * S + staggerOffset, y: gridY * h };
        }
        // For centers, first calculate their anchor vertex's position
        const staggerOffset = (gridY % 2) * (S / 2);
        const vertexX = gridX * S + staggerOffset;
        const vertexY = gridY * h;

        if (type === NodeType.TRIANGLE_UP_CENTER) {
            // Anchored to its top tip vertex (gridX,gridY)
            return { x: vertexX, y: vertexY - (2 * h) / 3 };
        }
        if (type === NodeType.TRIANGLE_DOWN_CENTER) {
            // Anchored to its bottom tip vertex (gridX,gridY)
            return { x: vertexX, y: vertexY + (2 * h) / 3 };
        }
    }
    // Fallback
    return { x: 0, y: 0 };
}

/**
 * 将像素坐标吸附到最近的网格点，返回抽象网格坐标。
 * @param {{x: number, y: number}} pos - 原始坐标。
 * @param {GridType} grid - 当前的网格类型。
 * @returns {{gridX: number, gridY: number, type: NodeType} | null} 吸附后的抽象坐标。
 */
function pixelToGrid(pos, grid) {
    const S = View.INITIAL_GRID_SPACING;
    const { x, y } = pos;

    if (grid === GridType.SQUARE) {
        const candidates = [
            // 顶点
            {
                gridX: Math.round(x / S),
                gridY: Math.round(y / S),
                type: NodeType.SQUARE_VERTEX,
            },
            // 中心点
            {
                gridX: Math.floor(x / S),
                gridY: Math.floor(y / S),
                type: NodeType.SQUARE_CENTER,
            },
        ];

        return candidates
            .map((p) => ({
                point: p,
                distSq:
                    (x - gridToPixel(p, grid).x) ** 2 +
                    (y - gridToPixel(p, grid).y) ** 2,
            }))
            .reduce((closest, p) => (p.distSq < closest.distSq ? p : closest))
            .point;
    }

    if (grid === GridType.TRIANGULAR) {
        const h = (S * Math.sqrt(3)) / 2;
        let candidates = [];

        // --- Case 1: Guess candidate vertices ---
        const gridY_est_vert = Math.round(y / h);
        for (let gridY_offset = -1; gridY_offset <= 1; gridY_offset++) {
            const gridY = gridY_est_vert + gridY_offset;
            const staggerOffset = (gridY % 2) * (S / 2);
            const gridX_est = Math.round((x - staggerOffset) / S);
            for (let gridX_offset = -1; gridX_offset <= 1; gridX_offset++) {
                const gridX = gridX_est + gridX_offset;
                candidates.push({
                    gridX: gridX,
                    gridY: gridY,
                    type: NodeType.TRIANGLE_VERTEX,
                });
            }
        }

        // --- Case 2: Guess candidate up-centers (▲) ---
        const gridY_est_up = Math.round((y + (2 * h) / 3) / h);
        for (let gridY_offset = -1; gridY_offset <= 1; gridY_offset++) {
            const gridY = gridY_est_up + gridY_offset;
            const staggerOffset = (gridY % 2) * (S / 2);
            const gridX_est = Math.round((x - staggerOffset) / S);
            for (let gridX_offset = -1; gridX_offset <= 1; gridX_offset++) {
                const gridX = gridX_est + gridX_offset;
                candidates.push({
                    gridX: gridX,
                    gridY: gridY,
                    type: NodeType.TRIANGLE_UP_CENTER,
                });
            }
        }

        // --- Case 3: Guess candidate down-centers (▼) ---
        const gridY_est_down = Math.round((y - (2 * h) / 3) / h);
        for (let gridY_offset = -1; gridY_offset <= 1; gridY_offset++) {
            const gridY = gridY_est_down + gridY_offset;
            const staggerOffset = (gridY % 2) * (S / 2);
            const gridX_est = Math.round((x - staggerOffset) / S);
            for (let gridX_offset = -1; gridX_offset <= 1; gridX_offset++) {
                const gridX = gridX_est + gridX_offset;
                candidates.push({
                    gridX: gridX,
                    gridY: gridY,
                    type: NodeType.TRIANGLE_DOWN_CENTER,
                });
            }
        }

        // Find the best candidate among all collected types
        return candidates
            .map((p) => ({
                point: p,
                distSq:
                    (pos.x - gridToPixel(p, grid).x) ** 2 +
                    (pos.y - gridToPixel(p, grid).y) ** 2,
            }))
            .reduce((closest, p) => (p.distSq < closest.distSq ? p : closest))
            .point;
    }
    return null;
}