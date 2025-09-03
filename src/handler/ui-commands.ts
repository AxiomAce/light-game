/**
 * @file 全局行为处理器
 * @description 负责处理由UI（如控制台按钮）触发的全局命令。
 */

import { Err, Ok, Result, fromThrowable } from "neverthrow";
import { get } from "svelte/store";
import { graphSerializer } from "../service/graph-serializer";
import { canvas } from "../store/canvas";
import { graph } from "../store/graph";
import history, {
  DeleteElementsCommand,
  InitInvertCommand,
  InitTurnOffCommand,
} from "../store/history";
import solver from "../store/solver";
import {
  AlgorithmType,
  GraphElementType,
  GridType,
  ModeType,
} from "../types/types";

export const commands = {
  // --- Common Commands ---

  /** 放大画布。
   * @returns 操作是否成功执行。
   */
  zoomIn(): boolean {
    return canvas.zoomLevelChange(1, getCanvasClientRect());
  },

  /** 缩小画布。
   * @returns 操作是否成功执行。
   */
  zoomOut(): boolean {
    return canvas.zoomLevelChange(-1, getCanvasClientRect());
  },

  /**
   * 切换到编辑模式。
   * @returns 操作是否成功执行。
   */
  switchToEditMode(): boolean {
    canvas.setCurrentMode(ModeType.EDIT);
    graph.resetNodesOnToInitialOn(); // Resets game state, keeps initial state
    return true;
  },

  /**
   * 切换到求解模式，并触发初始求解。
   * @returns 操作是否成功执行。
   */
  switchToSolverMode(): boolean {
    canvas.setCurrentMode(ModeType.SOLVER);
    canvas.setSelectedElementsByIds(new Set());
    commands.restartPuzzle(); // 这会触发初始求解
    return true;
  },

  /**
   * 切换画布布局。
   * 如果画布非空，此操作会清空画布和历史记录。
   * @param newLayout 新的网格布局。
   * @returns 操作是否成功执行。
   */
  changeLayout(newLayout: GridType): boolean {
    if (get(graph).grid === newLayout) return false;

    graph.clear();
    history.clear();
    // 重置缩放和平移
    canvas.resetView();

    graph.setGrid(newLayout);
    return true;
  },

  // --- Edit Mode Commands ---

  /**
   * 删除所有选中的元素。
   * @returns 操作是否成功执行。
   */
  deleteSelectedElements(): boolean {
    const selectedIds = new Set(
      get(canvas).selectedElements.map((sel) => sel.element.id)
    );
    if (selectedIds.size === 0) return false;

    // 找到所有将被删除的节点，包括隐式删除的边。
    const selectedNodeIds = new Set(
      get(canvas)
        .selectedElements.filter((sel) => sel.type === GraphElementType.NODE)
        .map((sel) => sel.element.id)
    );

    const allEdgesInGraph = get(graph).edges;
    const implicitlyDeletedEdgeIds = allEdgesInGraph
      .filter(
        (edge) =>
          selectedNodeIds.has(edge.source) || selectedNodeIds.has(edge.target)
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
    history.register(command);
    return true;
  },

  /** 反转所有选中节点的初始状态。
   * @returns 操作是否成功执行。
   */
  initInvertSelection(): boolean {
    const selectedNodeIds = get(canvas).selectedNodeIds;
    if (selectedNodeIds.size === 0) return false;

    const command = new InitInvertCommand(selectedNodeIds);
    command.redo();
    history.register(command);
    return true;
  },

  /** 将所有选中节点的初始状态设置为关闭。
   * @returns 操作是否成功执行。
   */
  initTurnOffSelection(): boolean {
    const selectedNodeIds = get(canvas).selectedNodeIds;
    if (selectedNodeIds.size === 0) return false;

    const command = new InitTurnOffCommand(selectedNodeIds);
    command.redo();
    history.register(command);
    return true;
  },

  /** 选中所有元素。
   * @returns 操作是否成功执行。
   */
  selectAll(): boolean {
    if (get(graph).isEmpty) return false;

    const { nodes, edges } = get(graph);

    const selectedIds = new Set([
      ...nodes.map((node) => node.id),
      ...edges.map((edge) => edge.id),
    ]);

    canvas.setSelectedElementsByIds(selectedIds);
    return true;
  },

  // --- History Commands ---

  /** 撤销上一步操作。
   * @returns 操作是否成功执行。
   */
  undo(): boolean {
    if (get(canvas).currentMode !== ModeType.EDIT) return false;
    return history.undo();
  },

  /** 重做上一步操作。
   * @returns 操作是否成功执行。
   */
  redo(): boolean {
    if (get(canvas).currentMode !== ModeType.EDIT) return false;
    return history.redo();
  },

  // --- Solver Commands ---

  /**
   * 从当前盘面状态开始求解。
   * @param algorithm 求解算法 ('any' 或 'min_weight')，为 null 时使用当前算法。
   * @returns 操作是否成功执行。
   */
  solveCurrentPuzzleBy(algorithm: AlgorithmType): boolean {
    solver.setAlgorithm(algorithm);
    solver.setSolution();
    return true;
  },

  /** 重置求解模式的盘面到初始状态，并重新求解。
   * @returns 操作是否成功执行。
   */
  restartPuzzle(): boolean {
    graph.resetNodesOnToInitialOn();
    solver.setMatrixInfo();
    solver.setSolution();
    return true;
  },

  // --- Data Persistence Commands ---

  /** 将图的当前状态序列化并返回一个Base64编码的字符串。
   * @returns 编码后的图数据。
   */
  exportGraph(): string {
    const data = graphSerializer.serialize(get(graph));
    const utf8Bytes = new TextEncoder().encode(data);
    const binaryString = String.fromCodePoint(...utf8Bytes);
    const encoded = btoa(binaryString);
    return encoded;
  },

  /** 从一个Base64编码的字符串导入图的状态。
   * @param base64String 输入的 Base64 字符串。
   * @returns 如果导入成功，返回 null；如果导入失败，返回错误信息。
   */
  importGraph(base64String: string): Result<void, string> {
    // 解码 Base64 并处理可能的 Unicode 字符
    const contentResult = fromThrowable(
      () => {
        const binaryString = atob(base64String);
        const utf8Bytes = Uint8Array.from(
          binaryString,
          (m) => m.codePointAt(0) || 0
        );
        const content = new TextDecoder().decode(utf8Bytes);
        return content;
      },
      (e) => e as Error
    )();
    if (contentResult.isErr()) {
      return new Err("Invalid Base64 string.");
    }
    const content = contentResult.value;

    const newStateResult = graphSerializer.deserialize(content);
    if (newStateResult.isErr()) {
      return new Err(newStateResult.error);
    }
    const newState = newStateResult.value;

    graph.load(newState);
    history.clear();
    canvas.resetView();
    canvas.centerViewOnGraph(getCanvasClientRect());

    return new Ok(undefined);
  },
};

// ===================================================================
// ======================  Component Accessor   ======================
// ===================================================================

function getCanvasClientRect(): { width: number; height: number } {
  const canvasEl = document.getElementById("canvas-html") as HTMLCanvasElement;
  if (!canvasEl) return { width: 0, height: 0 };
  return canvasEl.getBoundingClientRect();
}
