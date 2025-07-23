/**
 * @file 全局行为处理器
 * @description 负责处理由UI（如控制台按钮）触发的全局命令。
 */

import * as View from "../view/view.js";
import graph from "../model/graph.js";
import canvasView from "../view/canvas.js";
import solver, { solverState } from "../model/solver.js";
import historyManager, {
    DeleteElementsCommand,
    InvertStateCommand,
} from "./history.js";

export const commands = {
    // --- Mode Switching ---

    /**
     * 切换到编辑模式。
     */
    switchToEditMode() {
        View.viewState.currentMode = "edit";
        graph.resetToInitialState(); // Resets game state, keeps initial state
    },

    /**
     * 切换到求解模式，并触发初始求解。
     */
    switchToSolverMode() {
        View.viewState.currentMode = "solver";
        View.viewState.selectedElements = [];
        View.viewState.hoveredElement = null;
        this.restartPuzzle(); // 这会触发初始求解
    },

    /**
     * 切换画布布局。
     * 如果画布非空，此操作会清空画布和历史记录。
     * @param {string} newLayout - 'square' 或 'triangular'
     */
    changeLayout(newLayout) {
        if (View.viewState.canvasLayout === newLayout) return;

        graph.clearGraph();
        historyManager.clear();
        canvasView.resetView();

        View.viewState.canvasLayout = newLayout;
    },

    // --- Canvas and Element Manipulation ---

    /**
     * 放大画布。
     */
    zoomIn() {
        canvasView.zoom(View.ZOOM_FACTOR);
    },

    /**
     * 缩小画布。
     */
    zoomOut() {
        canvasView.zoom(1 / View.ZOOM_FACTOR);
    },

    /**
     * 清空画布上的所有节点和边。
     */
    clearCanvas() {
        const allElements = graph.getGraph();
        if (allElements.nodes.length === 0 && allElements.edges.length === 0)
            return;

        const command = new DeleteElementsCommand({
            nodes: [...allElements.nodes],
            edges: [...allElements.edges],
        });
        command.redo();
        historyManager.register(command);
        canvasView.resetView();
    },

    /**
     * 删除所有选中的元素。
     */
    deleteSelectedElements() {
        const selectedIds = new Set(
            View.viewState.selectedElements.map((sel) => sel.id)
        );
        if (selectedIds.size === 0) return;

        // 找到所有将被删除的节点，包括隐式删除的边。
        const selectedNodeIds = new Set(
            View.viewState.selectedElements
                .filter((sel) => sel.type === "node")
                .map((sel) => sel.id)
        );

        const allEdgesInGraph = graph.getGraph().edges;
        const implicitlyDeletedEdgeIds = allEdgesInGraph
            .filter(
                (edge) =>
                    selectedNodeIds.has(edge.source) ||
                    selectedNodeIds.has(edge.target)
            )
            .map((edge) => edge.id);

        const allIdsToDelete = new Set([
            ...selectedIds,
            ...implicitlyDeletedEdgeIds,
        ]);

        // 获取所有将被删除的元素的完整数据。
        const elementsToDelete = graph.getElementsByIds(allIdsToDelete);

        // 创建包含所有将被删除元素的命令。
        const command = new DeleteElementsCommand(elementsToDelete);
        command.redo();
        historyManager.register(command);
    },

    /**
     * 反转所有选中节点的初始状态。
     */
    invertSelection() {
        const selectedNodeIds = View.viewState.selectedElements
            .filter((sel) => sel.type === "node")
            .map((sel) => sel.id);
        if (selectedNodeIds.length === 0) return;

        const command = new InvertStateCommand(selectedNodeIds);
        command.redo();
        historyManager.register(command);
    },

    /**
     * 取消所有元素的选择。
     */
    deselectAll() {
        View.viewState.selectedElements = [];
    },

    // --- History Actions ---

    /**
     * 撤销上一步操作。
     */
    undo() {
        if (View.viewState.currentMode !== "edit") return;
        historyManager.undo();
    },

    /**
     * 重做上一步操作。
     */
    redo() {
        if (View.viewState.currentMode !== "edit") return;
        historyManager.redo();
    },

    // --- Solver Actions ---

    /**
     * 从当前盘面状态开始求解。
     * @param {string | null} algorithm - 求解算法 ('any' 或 'min_weight')，为 null 时使用当前算法。
     */
    solveCurrentPuzzle(algorithm = null) {
        if (algorithm) solverState.algorithm = algorithm;
        solver.setSolution();
    },

    /**
     * 重置求解模式的盘面到初始状态，并重新求解。
     */
    restartPuzzle() {
        graph.resetToInitialState();
        solver.setMatrixInfo();
        solver.setSolution();
    },
};
