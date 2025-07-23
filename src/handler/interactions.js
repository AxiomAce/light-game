/**
 * @file 画布直接交互处理器
 * @description 整合所有与画布直接交互相关的逻辑，如拖拽、平移、点选等。
 */

import * as View from "../view/view.js";
import graph from "../model/graph.js";
import canvasView from "../view/canvas.js";
import { commands } from "./commands.js";
import { solverState } from "../model/solver.js";
import historyManager, {
    AddElementsCommand,
    InvertStateCommand,
} from "./history.js";

// ===================================================================
// ========================= Pan Handler =============================
// ===================================================================

export const panHandler = {
    /**
     * 处理鼠标按下事件以开始平移。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleMouseDown(e) {
        View.viewState.dragging.isActive = true;
        View.viewState.dragging.type = "pan";
        View.viewState.dragging.startPos = { x: e.clientX, y: e.clientY };
        View.viewState.dragging.startViewOffset = {
            ...View.viewState.viewOffset,
        };
        canvasView.setCursor("grabbing");
    },
    /**
     * 处理鼠标移动事件以执行平移。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleMouseMove(e) {
        if (View.viewState.dragging.type !== "pan") return;
        const dx = e.clientX - View.viewState.dragging.startPos.x;
        const dy = e.clientY - View.viewState.dragging.startPos.y;
        View.viewState.viewOffset.x =
            View.viewState.dragging.startViewOffset.x + dx;
        View.viewState.viewOffset.y =
            View.viewState.dragging.startViewOffset.y + dy;
    },
    /**
     * 处理鼠标松开事件以结束平移。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleMouseUp(e) {
        canvasView.setCursor(e.altKey ? "grab" : "default");
    },
    /**
     * 处理鼠标滚轮事件以进行平移。
     * @param {WheelEvent} e - 滚轮事件对象。
     */
    handleWheel(e) {
        e.preventDefault();
        View.viewState.viewOffset.x -= e.deltaX;
        View.viewState.viewOffset.y -= e.deltaY;
    },
    /**
     * 处理键盘按下事件（如Alt键）以改变光标。
     * @param {KeyboardEvent} e - 键盘事件对象。
     */
    handleKeyDown(e) {
        if (e.key === "Alt" && !View.viewState.dragging.isActive) {
            canvasView.setCursor("grab");
        }
    },
    /**
     * 处理键盘松开事件（如Alt键）以恢复光标。
     * @param {KeyboardEvent} e - 键盘事件对象。
     */
    handleKeyUp(e) {
        if (e.key === "Alt" && !View.viewState.dragging.isActive) {
            canvasView.setCursor("default");
        }
    },
};

// ===================================================================
// ====================== Edit Mode Handler ==========================
// ===================================================================

export const editModeHandler = {
    /**
     * 处理编辑模式下的鼠标按下事件。
     * 根据点击位置（空白、节点、幽灵节点）初始化不同的拖拽操作。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleMouseDown(e) {
        if (e.button !== 0) return;
        const pos = canvasView.getMousePos(e);

        const clickedElementInfo = canvasView.getElementAtPos(pos);
        // 1. 在按下时保持悬停高亮
        if (clickedElementInfo) {
            View.viewState.hoveredElement = {
                type: clickedElementInfo.type,
                id: clickedElementInfo.element.id,
            };
        } else {
            View.viewState.hoveredElement = null;
        }

        View.viewState.boxSelectionHovered = []; // 在开始拖拽时清空
        const isMultiSelect = e.metaKey || e.ctrlKey;

        View.viewState.dragging = {
            isActive: true,
            isIntentional: false,
            startPos: pos,
            currentPos: pos,
            fromNode: null,
            newlyCreatedElements: { nodes: [], edges: [] },
        };

        if (View.viewState.ghostNodePos) {
            // 从“幽灵节点”开始拖拽以创建节点和边
            View.viewState.dragging.type = "edge";
            const newNode = graph.addNode(
                View.viewState.ghostNodePos.x,
                View.viewState.ghostNodePos.y
            );
            View.viewState.dragging.fromNode = newNode;
            View.viewState.dragging.newlyCreatedElements.nodes.push(newNode);
            if (!isMultiSelect) {
                View.viewState.selectedElements = [
                    { type: "node", id: newNode.id },
                ];
            } else {
                View.viewState.selectedElements.push({
                    type: "node",
                    id: newNode.id,
                });
            }
            View.viewState.ghostNodePos = null;
        } else if (clickedElementInfo) {
            // 从一个已存在的元素开始点击
            if (clickedElementInfo.type === "node") {
                // 从节点开始拖拽以创建边
                View.viewState.dragging.type = "edge";
                View.viewState.dragging.fromNode = clickedElementInfo.element;
            }
            // 如果点击的是边，则不设置拖拽类型，将其作为一次“点击”处理
        } else {
            // 从空白区域开始拖拽以进行框选
            View.viewState.dragging.type = "box";

            // 2. 如果不是多选，立即清除现有选择
            if (!isMultiSelect) {
                View.viewState.selectedElements = [];
            }
        }
    },

    /**
     * 处理编辑模式下的鼠标移动事件。
     * 负责更新拖拽状态、预览效果（如拖拽线、框选区域）和悬停高亮。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleMouseMove(e) {
        const pos = canvasView.getMousePos(e);

        if (View.viewState.dragging.isActive) {
            if (View.viewState.dragging.type === "pan") return;

            View.viewState.dragging.currentPos = pos;
            if (
                !View.viewState.dragging.isIntentional &&
                Math.sqrt(
                    (pos.x - View.viewState.dragging.startPos.x) ** 2 +
                        (pos.y - View.viewState.dragging.startPos.y) ** 2
                ) >= View.DRAG_THRESHOLD
            ) {
                View.viewState.dragging.isIntentional = true;
            }

            if (View.viewState.dragging.type === "edge") {
                const target = canvasView.getElementAtPos(pos);
                if (
                    target &&
                    target.type === "node" &&
                    target.element.id !== View.viewState.dragging.fromNode?.id
                ) {
                    View.viewState.hoveredElement = {
                        type: "node",
                        id: target.element.id,
                    };
                    View.viewState.ghostNodePos = null;
                } else {
                    View.viewState.hoveredElement = null;
                    View.viewState.ghostNodePos =
                        canvasView.calculateGhostNodePos(pos);
                }
            } else if (
                View.viewState.dragging.type === "box" &&
                View.viewState.dragging.isIntentional
            ) {
                const { startPos, currentPos } = View.viewState.dragging;
                const r = {
                    x1: Math.min(startPos.x, currentPos.x),
                    y1: Math.min(startPos.y, currentPos.y),
                    x2: Math.max(startPos.x, currentPos.x),
                    y2: Math.max(startPos.y, currentPos.y),
                };
                View.viewState.hoveredElement = null; // 框选时不应有单个元素悬停
                View.viewState.boxSelectionHovered =
                    canvasView.getElementsInBox(r);
            }
        } else {
            // Hover logic when not dragging
            const target = canvasView.getElementAtPos(pos);
            View.viewState.hoveredElement = target
                ? { type: target.type, id: target.element.id }
                : null;
            View.viewState.ghostNodePos = target
                ? null
                : canvasView.calculateGhostNodePos(pos);
        }
    },

    /**
     * 处理编辑模式下的鼠标松开事件。
     * 根据拖拽意图（拖拽或单击）完成相应的操作，如创建元素或更新选择。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleMouseUp(e) {
        if (e.button !== 0) {
            return;
        }

        const {
            isIntentional,
            type,
            fromNode,
            newlyCreatedElements,
            startPos,
            currentPos,
        } = View.viewState.dragging;

        if (isIntentional) {
            // --- End of a DRAG operation ---
            if (type === "edge") {
                let toNode = null;
                if (
                    View.viewState.hoveredElement &&
                    View.viewState.hoveredElement.type === "node"
                ) {
                    toNode = graph.findNodeById(
                        View.viewState.hoveredElement.id
                    );
                } else if (View.viewState.ghostNodePos) {
                    toNode = graph.addNode(
                        View.viewState.ghostNodePos.x,
                        View.viewState.ghostNodePos.y
                    );
                    newlyCreatedElements.nodes.push(toNode);
                }

                if (fromNode && toNode && fromNode.id !== toNode.id) {
                    const newEdge = graph.addEdge(fromNode.id, toNode.id);
                    if (newEdge) {
                        newlyCreatedElements.edges.push(newEdge);
                        View.viewState.selectedElements = [
                            { type: "edge", id: newEdge.id },
                            { type: "node", id: fromNode.id },
                            { type: "node", id: toNode.id },
                        ];
                    }
                }
                if (
                    newlyCreatedElements.nodes.length > 0 ||
                    newlyCreatedElements.edges.length > 0
                ) {
                    historyManager.register(
                        new AddElementsCommand(newlyCreatedElements)
                    );
                }
            } else if (type === "box") {
                const r = {
                    x1: Math.min(startPos.x, currentPos.x),
                    y1: Math.min(startPos.y, currentPos.y),
                    x2: Math.max(startPos.x, currentPos.x),
                    y2: Math.max(startPos.y, currentPos.y),
                };
                const elementsInBox = canvasView.getElementsInBox(r);

                if (e.metaKey || e.ctrlKey) {
                    const existingIds = new Set(
                        View.viewState.selectedElements.map((s) => s.id)
                    );
                    elementsInBox.forEach((el) => {
                        if (!existingIds.has(el.id))
                            View.viewState.selectedElements.push(el);
                    });
                } else {
                    View.viewState.selectedElements = elementsInBox;
                }
            }
        } else {
            // --- End of a CLICK operation ---
            const isMultiSelect = e.metaKey || e.ctrlKey;

            if (
                newlyCreatedElements.nodes.length > 0 &&
                newlyCreatedElements.edges.length === 0
            ) {
                historyManager.register(
                    new AddElementsCommand(newlyCreatedElements)
                );
            } else {
                const clickedElementInfo = canvasView.getElementAtPos(startPos);

                if (clickedElementInfo) {
                    const clickedEl = {
                        type: clickedElementInfo.type,
                        id: clickedElementInfo.element.id,
                    };
                    const isSelected = View.viewState.selectedElements.some(
                        (s) => s.id === clickedEl.id
                    );

                    if (isMultiSelect) {
                        if (isSelected) {
                            View.viewState.selectedElements =
                                View.viewState.selectedElements.filter(
                                    (s) => s.id !== clickedEl.id
                                );
                        } else {
                            View.viewState.selectedElements.push(clickedEl);
                        }
                    } else {
                        if (
                            !isSelected ||
                            View.viewState.selectedElements.length > 1
                        ) {
                            View.viewState.selectedElements = [clickedEl];
                        }
                    }
                } else {
                    if (!isMultiSelect) {
                        commands.deselectAll();
                    }
                }
            }
        }

        View.viewState.hoveredElement = null;
        View.viewState.ghostNodePos = null;
        View.viewState.boxSelectionHovered = [];
    },

    /**
     * 处理编辑模式下的右键菜单事件，用于反转节点初始状态。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleContextMenu(e) {
        e.preventDefault();
        const clickedElementInfo = canvasView.getElementAtPos(
            canvasView.getMousePos(e)
        );
        if (clickedElementInfo && clickedElementInfo.type === "node") {
            const nodeId = clickedElementInfo.element.id;
            const command = new InvertStateCommand([nodeId]);
            command.redo();
            historyManager.register(command);
        }
    },
};

// ===================================================================
// ====================== Solver Mode Handler ========================
// ===================================================================

export const solverModeHandler = {
    /**
     * 处理求解模式下的单击事件。
     * @param {MouseEvent} e - 鼠标事件对象。
     */
    handleClick(e) {
        const pos = canvasView.getMousePos(e);
        const target = canvasView.getElementAtPos(pos);
        if (target && target.type === "node") {
            const clickedNodeId = target.element.id;
            const wasInSolution =
                solverState.solution.hasSolution &&
                solverState.solution.nodesToPress.includes(clickedNodeId);

            // Handler -> Model
            graph.toggleNodeAndNeighbors(clickedNodeId);

            if (solverState.solution.hasSolution) {
                if (wasInSolution) {
                    solverState.solution.nodesToPress =
                        solverState.solution.nodesToPress.filter(
                            (id) => id !== clickedNodeId
                        );
                } else {
                    commands.solveCurrentPuzzle(); // Re-solve from new state
                }
            }
        }
    },
};
