/**
 * @file 全局行为处理器
 * @description 负责处理由UI（如控制台按钮）触发的全局命令。
 */

import * as View from "../view/view.js";
import { ModeType, getZoomRatio } from "../view/view.js";
import graph, { graphState, GridType } from "../model/graph.js";
import canvasView from "../view/canvas.js";
import solver, { solverState } from "../model/solver.js";
import historyManager, {
    DeleteElementsCommand,
    InitInvertCommand,
    InitTurnOffCommand,
} from "./history.js";
import { dataSerializer } from "../model/dataSerializer.js";

export const commands = {
    // --- Mode Switching ---

    /**
     * 切换到编辑模式。
     */
    switchToEditMode() {
        View.viewState.currentMode = ModeType.EDIT;
        graph.resetToInitialState(); // Resets game state, keeps initial state
    },

    /**
     * 切换到求解模式，并触发初始求解。
     */
    switchToSolverMode() {
        View.viewState.currentMode = ModeType.SOLVER;
        View.viewState.selectedElements = [];
        View.viewState.hoveredElement = null;
        commands.restartPuzzle(); // 这会触发初始求解
    },

    /**
     * 切换画布布局。
     * 如果画布非空，此操作会清空画布和历史记录。
     * @param {GridType} newLayout
     */
    changeLayout(newLayout) {
        if (graphState.grid === newLayout) return;

        graph.clearGraph();
        historyManager.clear();
        canvasView.resetView();

        graphState.grid = newLayout;
    },

    // --- Canvas and Element Manipulation ---

    /**
     * 放大画布。
     * @returns {boolean} 操作是否成功执行。
     */
    zoomIn() {
        return canvasView.zoomLevelChange(1);
    },

    /**
     * 缩小画布。
     * @returns {boolean} 操作是否成功执行。
     */
    zoomOut() {
        return canvasView.zoomLevelChange(-1);
    },

    /**
     * 删除所有选中的元素。
     * @returns {boolean} - 操作是否成功执行。
     */
    deleteSelectedElements() {
        const selectedIds = new Set(
            View.viewState.selectedElements.map((sel) => sel.id)
        );
        if (selectedIds.size === 0) return false;

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
        return true;
    },

    /**
     * 反转所有选中节点的初始状态。
     */
    initInvertSelection() {
        const selectedNodeIds = View.viewState.selectedElements
            .filter((sel) => sel.type === "node")
            .map((sel) => sel.id);
        if (selectedNodeIds.length === 0) return;

        const command = new InitInvertCommand(selectedNodeIds);
        command.redo();
        historyManager.register(command);
    },

    /**
     * 将所有选中节点的初始状态设置为关闭。
     */
    initTurnOffSelection() {
        const selectedNodeIds = View.viewState.selectedElements
            .filter((sel) => sel.type === "node")
            .map((sel) => sel.id);
        if (selectedNodeIds.length === 0) return;

        const command = new InitTurnOffCommand(selectedNodeIds);
        command.redo();
        historyManager.register(command);
    },

    /**
     * 选中所有元素。
     * @returns {boolean} - 操作是否成功执行。
     */
    selectAll() {
        if (graph.isEmpty()) return false;

        const { nodes, edges } = graph.getGraph();

        const selectedNodes = nodes.map((node) => ({
            type: "node",
            id: node.id,
        }));
        const selectedEdges = edges.map((edge) => ({
            type: "edge",
            id: edge.id,
        }));

        View.viewState.selectedElements = [...selectedNodes, ...selectedEdges];
        return true;
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
     * @returns {boolean} - 操作是否成功执行。
     */
    undo() {
        if (View.viewState.currentMode !== ModeType.EDIT) return false;
        return historyManager.undo();
    },

    /**
     * 重做上一步操作。
     * @returns {boolean} - 操作是否成功执行。
     */
    redo() {
        if (View.viewState.currentMode !== ModeType.EDIT) return false;
        return historyManager.redo();
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

    // --- Data Management ---

    /**
     * 将图的当前状态序列化并返回一个Base64编码的字符串。
     * @returns {string} - 编码后的图数据。
     */
    exportGraph() {
        try {
            const data = dataSerializer.serialize();
            const utf8Bytes = new TextEncoder().encode(data);
            const binaryString = String.fromCodePoint(...utf8Bytes);
            const encoded = btoa(binaryString);
            return encoded;
        } catch (error) {
            console.error("Failed to export graph:", error);
            throw new Error("Failed to export graph data.");
        }
    },

    /**
     * 从一个Base64编码的字符串导入图的状态。
     * @param {string} base64String
     */
    importGraph(base64String) {
        if (!base64String || !base64String.trim()) {
            View.viewState.infoMessage = {
                text: "Import failed: Input is empty.",
                timestamp: Date.now(),
                error: true,
            };
            return;
        }

        try {
            // 解码 Base64 并处理可能的 Unicode 字符
            const binaryString = atob(base64String);
            const utf8Bytes = Uint8Array.from(binaryString, (m) =>
                m.codePointAt(0)
            );
            const content = new TextDecoder().decode(utf8Bytes);

            dataSerializer.deserialize(content);
            historyManager.clear();
            canvasView.resetView(); // 重置缩放和平移

            // 自动将视图中心平移到导入图形的重心
            const bounds = canvasView.getGraphBounds();
            if (bounds) {
                const graphWidth = bounds.maxX - bounds.minX;
                const graphHeight = bounds.maxY - bounds.minY;
                const graphCenterX = bounds.minX + graphWidth / 2;
                const graphCenterY = bounds.minY + graphHeight / 2;

                const canvas = document.getElementById("canvas-html");
                const viewWidth = canvas.clientWidth;
                const viewHeight = canvas.clientHeight;

                // 计算偏移量，使图形中心与视图中心对齐
                View.viewState.viewOffset.x =
                    viewWidth / 2 - graphCenterX * getZoomRatio();
                View.viewState.viewOffset.y =
                    viewHeight / 2 - graphCenterY * getZoomRatio();
            }
        } catch (error) {
            console.error("Failed to import graph:", error);
            throw new Error("Import failed: Invalid data format.");
        }
    },
};
