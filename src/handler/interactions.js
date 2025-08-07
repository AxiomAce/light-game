/**
 * @file 画布直接交互处理器
 * @description 整合所有与画布直接交互相关的逻辑，如拖拽、平移、点选等。
 */

import * as View from "../view/view.js";
import { DraggingType, ModeType } from "../view/view.js";
import graph from "../model/graph.js";
import canvasView from "../view/canvas.js";
import { commands } from "./commands.js";
import { solverState } from "../model/solver.js";
import historyManager, {
    AddElementsCommand,
    InitInvertCommand,
} from "./history.js";

// ===================================================================
// ========================= Pan Handler =============================
// ===================================================================

export const panHandler = {
    /**
     * 处理鼠标按下事件以开始平移。
     * @param {MouseEvent} e - 鼠标事件对象。
     * @returns {boolean}
     */
    handleMouseDown(e) {
        if (!e.altKey) return false;

        View.viewState.dragging.type = DraggingType.PAN_DRAG;
        View.viewState.dragging.startPos = { x: e.clientX, y: e.clientY };
        View.viewState.dragging.startViewOffset = {
            ...View.viewState.viewOffset,
        };
        canvasView.setCursor("grabbing");
        return true;
    },
    /**
     * 处理鼠标移动事件以执行平移。
     * @param {MouseEvent} e - 鼠标事件对象。
     * @returns {boolean}
     */
    handleMouseMove(e) {
        if (View.viewState.dragging.type !== DraggingType.PAN_DRAG) return false;

        const dx = e.clientX - View.viewState.dragging.startPos.x;
        const dy = e.clientY - View.viewState.dragging.startPos.y;
        View.viewState.viewOffset.x =
            View.viewState.dragging.startViewOffset.x + dx;
        View.viewState.viewOffset.y =
            View.viewState.dragging.startViewOffset.y + dy;
        return true;
    },
    /**
     * 处理鼠标松开事件以结束平移。
     * @param {MouseEvent} e - 鼠标事件对象。
     * @returns {boolean}
     */
    handleMouseUp(e) {
        if (View.viewState.dragging.type !== DraggingType.PAN_DRAG) return false;

        canvasView.setCursor(e.altKey ? "grab" : "default");
        View.viewState.dragging.type = DraggingType.NULL;
        return true;
    },
    /**
     * 处理鼠标滚轮事件以进行平移。
     * @param {WheelEvent} e - 滚轮事件对象。
     * @returns {boolean}
     */
    handleWheel(e) {
        e.preventDefault();
        View.viewState.viewOffset.x -= e.deltaX;
        View.viewState.viewOffset.y -= e.deltaY;
        return true;
    },
    /**
     * 处理键盘按下事件（如Alt键）以改变光标。
     * @param {KeyboardEvent} e - 键盘事件对象。
     * @returns {boolean}
     */
    handleKeyDown(e) {
        if (e.key === "Alt" && View.viewState.dragging.type === DraggingType.NULL) {
            canvasView.setCursor("grab");
            return true;
        }
        return false;
    },
    /**
     * 处理键盘松开事件（如Alt键）以恢复光标。
     * @param {KeyboardEvent} e - 键盘事件对象。
     * @returns {boolean}
     */
    handleKeyUp(e) {
        if (e.key === "Alt" && View.viewState.dragging.type === DraggingType.NULL) {
            canvasView.setCursor("default");
            return true;
        }
        return false;
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
     * @returns {boolean}
     */
    handleMouseDown(e) {
        if (View.viewState.currentMode !== ModeType.EDIT) return false;
        if (e.button !== 0) return false;

        const pos = View.viewState.mousePos;
        const clickedElementInfo = canvasView.getElementAtPos(pos);
        const ghostNodePos = canvasView.calculateGhostNodePos(pos);
        const isMultiSelect = e.metaKey || e.ctrlKey;

        View.viewState.dragging = {
            type: DraggingType.NULL,
            startPos: pos,
            fromNode: null,
            newlyCreatedElements: { nodes: [], edges: [] },
            startViewOffset: { x: 0, y: 0 },
            provisionalCommand: null,
        };

        if (ghostNodePos) {
            // T1: 在“幽灵节点”上按下
            View.viewState.dragging.type = DraggingType.PRESSED;
            const newNode = graph.addNode(
                ghostNodePos.gridX,
                ghostNodePos.gridY,
                ghostNodePos.type
            );
            View.viewState.dragging.fromNode = newNode;
            View.viewState.dragging.newlyCreatedElements.nodes.push(newNode);

            // 立即注册一个临时的“创建节点”命令，以便“撤销”按钮能立刻更新
            const command = new AddElementsCommand({
                nodes: [newNode],
                edges: [],
            });
            historyManager.register(command);
            View.viewState.dragging.provisionalCommand = command;

            if (isMultiSelect) {
                View.viewState.selectedElements.push({ type: "node", id: newNode.id });
            } else {
                View.viewState.selectedElements = [{ type: "node", id: newNode.id }];
            }
        } else if (clickedElementInfo) {
            // T2: 在“已有节点”或边上按下
            const clickedEl = {
                type: clickedElementInfo.type,
                id: clickedElementInfo.element.id,
            };
            const isSelected = View.viewState.selectedElements.some((s) => s.id === clickedEl.id);

            if (isMultiSelect) {
                if (isSelected) {
                    View.viewState.selectedElements = View.viewState.selectedElements.filter((s) => s.id !== clickedEl.id);
                } else {
                    View.viewState.selectedElements.push(clickedEl);
                }
            } else {
                if (!isSelected || View.viewState.selectedElements.length > 1) {
                    View.viewState.selectedElements = [clickedEl];
                }
            }

            if (clickedElementInfo.type === "node") {
                View.viewState.dragging.type = DraggingType.PRESSED;
                View.viewState.dragging.fromNode = clickedElementInfo.element;
            } else {
                View.viewState.dragging.type = DraggingType.NULL;
            }
        } else {
            // T3: 在“空白区域”上按下
            View.viewState.dragging.type = DraggingType.BOX_DRAG;
            if (!isMultiSelect) {
                View.viewState.selectedElements = [];
            }
        }
        return true;
    },

    /**
     * 处理编辑模式下的鼠标移动事件。
     * 负责更新拖拽状态、预览效果（如拖拽线、框选区域）和悬停高亮。
     * @param {MouseEvent} e - 鼠标事件对象。
     * @returns {boolean}
     */
    handleMouseMove(e) {
        // 如果不是在编辑模式下，或者没有在进行拖拽操作，则不处理
        if (
            View.viewState.currentMode !== ModeType.EDIT ||
            View.viewState.dragging.type === DraggingType.NULL ||
            View.viewState.dragging.type === DraggingType.PAN_DRAG
        ) {
            return false;
        }

        const pos = View.viewState.mousePos;
        if (
            View.viewState.dragging.type === DraggingType.PRESSED &&
            View.getFromNodePos() &&
            Math.sqrt(
                (pos.x - View.getFromNodePos().x) ** 2 +
                (pos.y - View.getFromNodePos().y) ** 2
            ) >= View.DRAG_THRESHOLD
        ) {
            View.viewState.dragging.type = DraggingType.EDGE_DRAG;

            // T6 note: If starting a drag from a node in multiselect,
            // ensure the source node is selected. This handles the case where
            // the initial click DESELECTED it.
            const { fromNode } = View.viewState.dragging;
            const isMultiSelect = e.metaKey || e.ctrlKey;
            if (isMultiSelect && fromNode) {
                const isSelected = View.viewState.selectedElements.some((s) => s.id === fromNode.id);
                if (!isSelected) {
                    View.viewState.selectedElements.push({ type: 'node', id: fromNode.id });
                }
            }
        }
        return true;
    },

    /**
     * 处理编辑模式下的鼠标松开事件。
     * 根据拖拽意图（拖拽或单击）完成相应的操作，如创建元素或更新选择。
     * @param {MouseEvent} e - 鼠标事件对象。
     * @returns {boolean}
     */
    handleMouseUp(e) {
        // 如果不是在编辑模式下，或者没有在进行拖拽操作，则不处理
        if (
            View.viewState.currentMode !== ModeType.EDIT ||
            View.viewState.dragging.type === DraggingType.NULL ||
            View.viewState.dragging.type === DraggingType.PAN_DRAG
        ) {
            return false;
        }
        if (e.button !== 0) return false;

        const {
            type,
            fromNode,
            newlyCreatedElements,
            startPos,
            provisionalCommand,
        } = View.viewState.dragging;
        const isMultiSelect = e.metaKey || e.ctrlKey;

        // 仅当是“有意图的”拖拽（即拖拽边超过阈值或进行框选）时，才执行拖拽结束的逻辑
        if (type === DraggingType.EDGE_DRAG || type === DraggingType.BOX_DRAG) {
            // --- End of a DRAG operation ---
            if (type === DraggingType.EDGE_DRAG) {
                const endPos = View.viewState.mousePos;
                const toElementInfo = canvasView.getElementAtPos(endPos);
                const ghostNodeAtEnd = canvasView.calculateGhostNodePos(endPos);
                let toNode = null;

                if (toElementInfo?.type === "node") {
                    toNode = graph.findNodeById(toElementInfo.element.id);
                } else if (ghostNodeAtEnd) {
                    toNode = graph.addNode(
                        ghostNodeAtEnd.gridX,
                        ghostNodeAtEnd.gridY,
                        ghostNodeAtEnd.type
                    );
                    newlyCreatedElements.nodes.push(toNode);
                }

                if (fromNode && toNode && fromNode.id !== toNode.id) {
                    // T10, T11: A real edge is created.
                    if (provisionalCommand) {
                        // 由于拖拽产生了更复杂的操作（如创建了边），
                        // 我们需要先撤销临时的“仅创建节点”命令，
                        // 稍后会注册一个包含所有变化的完整命令。
                        historyManager.popUndoWithoutRedo();
                    }

                    const newEdge = graph.addEdge(fromNode.id, toNode.id);
                    if (newEdge) {
                        newlyCreatedElements.edges.push(newEdge);
                        const newElementsToSelect = [
                            { type: "node", id: fromNode.id },
                            { type: "node", id: toNode.id },
                            { type: "edge", id: newEdge.id },
                        ];

                        if (isMultiSelect) {
                            const existingIds = new Set(View.viewState.selectedElements.map((s) => s.id));
                            newElementsToSelect.forEach((el) => {
                                if (!existingIds.has(el.id)) {
                                    View.viewState.selectedElements.push(el);
                                }
                            });
                        } else {
                            View.viewState.selectedElements = newElementsToSelect;
                        }
                    }
                }

                if (newlyCreatedElements.nodes.length > 0 || newlyCreatedElements.edges.length > 0) {
                    historyManager.register(new AddElementsCommand(newlyCreatedElements));
                }
            } else if (type === DraggingType.BOX_DRAG) {
                // T12: End of box selection
                const r = {
                    x1: Math.min(startPos.x, View.viewState.mousePos.x),
                    y1: Math.min(startPos.y, View.viewState.mousePos.y),
                    x2: Math.max(startPos.x, View.viewState.mousePos.x),
                    y2: Math.max(startPos.y, View.viewState.mousePos.y),
                };
                const elementsInBox = canvasView.getElementsInBox(r);

                if (isMultiSelect) {
                    const existingIds = new Set(View.viewState.selectedElements.map((s) => s.id));
                    elementsInBox.forEach((el) => {
                        if (!existingIds.has(el.id)) {
                            View.viewState.selectedElements.push(el);
                        }
                    });
                } else {
                    View.viewState.selectedElements = elementsInBox;
                }
            }
        }

        // Final cleanup
        View.viewState.dragging.provisionalCommand = null;
        View.viewState.dragging.type = DraggingType.NULL;
        return true;
    },

    /**
     * 处理编辑模式下的右键菜单事件，用于反转节点初始状态。
     * @param {MouseEvent} e - 鼠标事件对象。
     * @returns {boolean}
     */
    handleContextMenu(e) {
        if (View.viewState.currentMode !== ModeType.EDIT) return false;
        e.preventDefault();
        const clickedElementInfo = canvasView.getElementAtPos(View.viewState.mousePos);
        if (clickedElementInfo && clickedElementInfo.type === "node") {
            const nodeId = clickedElementInfo.element.id;
            const command = new InitInvertCommand([nodeId]);
            command.redo();
            historyManager.register(command);
        }
        return true;
    },
};

// ===================================================================
// ====================== Solver Mode Handler ========================
// ===================================================================

export const solverModeHandler = {
    /**
     * 处理求解模式下的鼠标按下事件。
     * @param {MouseEvent} e - 鼠标事件对象。
     * @returns {boolean}
     */
    handleMouseDown(e) {
        if (View.viewState.currentMode !== ModeType.SOLVER) return false;
        if (e.button !== 0) return false;

        const pos = View.viewState.mousePos;
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
        return true;
    },
};

// ===================================================================
// ======================= Shortcut Handler ==========================
// ===================================================================

/**
 * 处理器，用于处理不与特定UI按钮关联的全局键盘快捷键。
 */
export const shortcutHandler = {
    /**
     * 处理键盘按下事件。
     * @param {KeyboardEvent} e - 键盘事件对象。
     * @returns {boolean} - 如果事件被消耗，则返回true。
     */
    handleKeyDown(e) {
        // 如果模态框可见，则禁用所有全局键盘快捷键。
        // 模态框本身负责处理其自身的按键事件（如“Escape”）。
        if (View.isModalVisible()) {
            return false;
        }
        // --- Edit Mode Shortcuts ---
        if (View.viewState.currentMode === ModeType.EDIT) {
            // Escape: 取消选择
            if (e.key === "Escape") {
                if (View.viewState.selectedElements.length > 0) {
                    commands.deselectAll();
                    return true;
                }
            }
        }

        return false; // 未消耗事件
    },
};