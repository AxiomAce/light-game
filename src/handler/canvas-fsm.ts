/**
 * @file 交互状态机（XState）
 * @description 基于 local-document.md 中的状态转移图，实现“编辑模式”与“平移”的状态机。
 */

import { get, readable } from "svelte/store";
import { and, assign, createActor, setup } from "xstate";
import { gridPos2WorldPos } from "../service/canvas-geometry";
import {
  calculateGhostNodePos,
  getElementAtPos,
  getElementsInBox,
} from "../service/canvas-graphSpatial";
import { canvas, NODE_RADIUS } from "../store/canvas";
import { graph } from "../store/graph";
import history, {
  AddElementsCommand,
  InitInvertCommand,
} from "../store/history";
import { solver } from "../store/solver";
import {
  type Edge,
  edgeToElement,
  GraphElementType,
  ModeType,
  type Node,
  nodeToElement,
} from "../types/types";

// =====================================================================
// =========================== 类型定义 =================================
// =====================================================================

// 已移动到下方的统一类型定义中

type MachineContext =
  | {
      type: "DEFAULT";
    }
  | {
      type: "FROM_NODE";
      fromNode: Node;
      isFromNodeNewlyCreated: boolean;
    }
  | {
      type: "FROM_EMPTY_AREA";
      startWorldPos: { x: number; y: number };
    }
  | {
      type: "PANNING";
      startMouseClientPos: { x: number; y: number };
      startViewClientOffset: { x: number; y: number };
    };

type MachineEvent =
  | {
      category: "KEY_EVENT";
      type: "ALT_DOWN" | "ALT_UP" | "ESC_DOWN";
    }
  | {
      category: "MOUSE_EVENT";
      type: "LEFT_MOUSE_DOWN" | "MOUSE_MOVE" | "LEFT_MOUSE_UP" | "CONTEXT_MENU";
      mouseClientPos: { x: number; y: number };
      mouseWorldPos: { x: number; y: number };
      altKey: boolean;
      ctrlKey: boolean;
      metaKey: boolean;
    };

/**
 * 合并后的状态机枚举定义。
 * 包含了原来的 pan 和 edit 状态机的所有状态。
 */

export enum MachineState {
  Idle = "idle",
  PreparePanning = "prepare_panning",
  Panning = "panning",
  PressedOnNode = "pressed_on_node",
  DraggingFromNode = "dragging_from_node",
  BoxSelecting = "box_selecting",
}

// =====================================================================
// ========================== 合并状态机 ================================
// =====================================================================

export const canvasMachine = setup({
  types: {
    context: {} as MachineContext,
    events: {} as MachineEvent,
  },

  guards: {
    /**
     * 判断当前是否处于编辑模式。
     */
    isEditMode: () => {
      return get(canvas).currentMode === ModeType.EDIT;
    },

    /**
     * 判断当前是否处于求解模式。
     */
    isSolverMode: () => {
      return get(canvas).currentMode === ModeType.SOLVER;
    },

    /**
     * 判断事件是否处于按下 Alt 的状态。
     * 用于限定仅在按下 Alt 键时允许进入/维持平移状态。
     */
    isAltKeyPressed: ({ event }) => {
      if (event.category !== "MOUSE_EVENT") return false;
      return event.altKey;
    },

    /**
     * 判断当前鼠标是否位于可创建的"幽灵节点"位置。
     */
    isOverGhostNode: ({ event }) => {
      if (event.category !== "MOUSE_EVENT") return false;
      return !!calculateGhostNodePos(event.mouseWorldPos);
    },

    /**
     * 判断当前鼠标是否位于已有的节点或边上。
     */
    isOverExistingElement: ({ event }) => {
      if (event.category !== "MOUSE_EVENT") return false;
      return !!getElementAtPos(event.mouseWorldPos);
    },

    /**
     * 判断从上下文中的起点节点开始，鼠标是否已拖拽超过阈值（视为进入拖拽态）。
     */
    hasDraggedBeyondThresholdFromContextNode: ({ context, event }) => {
      if (event.category !== "MOUSE_EVENT") return false;
      if (context.type !== "FROM_NODE") return false;
      const center = gridPos2WorldPos(context.fromNode);
      const pos = event.mouseWorldPos;
      const dx = pos.x - center.x;
      const dy = pos.y - center.y;
      return Math.sqrt(dx * dx + dy * dy) > NODE_RADIUS;
    },
  },

  actions: {
    // ========================== Common ============================
    clearContext: assign({
      type: "DEFAULT" as const,
    }),

    /**
     * 记录开始平移时的指针位置与初始视图偏移量，以便后续根据位移差进行平移。
     */
    storePanStartInfo: assign(({ event }) => {
      if (event.category !== "MOUSE_EVENT") return {};
      return {
        type: "PANNING" as const,
        startMouseClientPos: event.mouseClientPos,
        startViewClientOffset: { ...get(canvas).viewClientOffset },
      };
    }),

    /**
     * 根据当前指针位置与起始位置的差值，实时更新画布视图偏移量，实现平移效果。
     */
    panViewWithPointerDelta: ({ context, event }) => {
      if (event.category !== "MOUSE_EVENT") return;
      if (context.type !== "PANNING") return;
      const dx = event.mouseClientPos.x - context.startMouseClientPos.x;
      const dy = event.mouseClientPos.y - context.startMouseClientPos.y;
      canvas.setViewClientOffset({
        x: context.startViewClientOffset.x + dx,
        y: context.startViewClientOffset.y + dy,
      });
    },

    // ========================= Edit Mode ==========================

    deselectAll: () => {
      canvas.setSelectedElementsByIds(new Set());
    },

    /**
     * 在幽灵节点位置创建新节点、添加到历史记录、处理选择逻辑
     * 根据多选状态（metaKey/ctrlKey）决定是追加选择还是替换选择，
     * 并设置上下文状态为 FROM_NODE，标记该节点为新创建。
     */
    handleNewNodeCreationSelectionHistory: assign(({ event }) => {
      if (event.category !== "MOUSE_EVENT") return {};
      const pos = event.mouseWorldPos;
      const ghost = calculateGhostNodePos(pos)!;
      const newNode = graph.addNode(ghost.gridX, ghost.gridY, ghost.type)!;

      const cmd = new AddElementsCommand([nodeToElement(newNode)]);
      history.register(cmd);

      const isMulti = event.metaKey || event.ctrlKey;
      if (isMulti) {
        canvas.addSelectedElementsByIds(new Set([newNode.id]));
      } else {
        canvas.setSelectedElementsByIds(new Set([newNode.id]));
      }

      return {
        type: "FROM_NODE" as const,
        fromNode: newNode,
        isFromNodeNewlyCreated: true,
      };
    }),

    /**
     * 处理点击已有元素（节点/边）的选择逻辑
     * 根据多选状态（metaKey/ctrlKey）和当前选择状态决定是添加、移除还是替换选择。
     * 如果点击的是节点，设置上下文状态为 FROM_NODE；如果是边，设置为 DEFAULT。
     */
    handleExistingElementSelection: assign(({ event }) => {
      if (event.category !== "MOUSE_EVENT") return {};
      const pos = event.mouseWorldPos;
      const clicked = getElementAtPos(pos)!;
      const isMulti = event.metaKey || event.ctrlKey;

      const isSelected = get(canvas).selectedElementIds.has(clicked.element.id);

      if (isMulti) {
        if (isSelected) {
          canvas.removeSelectedElementsByIds(new Set([clicked.element.id]));
        } else {
          canvas.addSelectedElementsByIds(new Set([clicked.element.id]));
        }
      } else {
        canvas.setSelectedElementsByIds(new Set([clicked.element.id]));
      }

      if (clicked.type === GraphElementType.NODE) {
        return {
          type: "FROM_NODE" as const,
          fromNode: clicked.element,
          isFromNodeNewlyCreated: false,
        };
      } else {
        // 点击边时，不进行任何操作
        return {
          type: "DEFAULT" as const,
        };
      }
    }),

    /**
     * 准备框选操作：在空白区域按下鼠标时的初始化
     * 若非多选模式则清空当前选择，设置上下文状态为 FROM_EMPTY_AREA 并记录起始位置。
     */
    prepareBoxSelectionDragFromEmptyArea: assign(({ event }) => {
      if (event.category !== "MOUSE_EVENT") return {};
      const pos = event.mouseWorldPos;
      const isMulti = event.metaKey || event.ctrlKey;
      if (!isMulti) {
        canvas.setSelectedElementsByIds(new Set());
      }
      return {
        type: "FROM_EMPTY_AREA" as const,
        startWorldPos: pos,
      };
    }),

    /**
     * 在上下文菜单触发时（右键），反转点击节点的初始状态并记录历史。
     */
    invertInitialStateOnContextMenu: ({ event }) => {
      if (event.category !== "MOUSE_EVENT") return;
      const clicked = getElementAtPos(event.mouseWorldPos);
      if (clicked && clicked.type === GraphElementType.NODE) {
        const nodeId = clicked.element.id;
        const cmd = new InitInvertCommand(new Set([nodeId]));
        cmd.redo();
        history.register(cmd);
      }
    },

    /**
     * 完成从节点拖拽的操作：创建边、记录历史、更新选择
     * - 检测拖拽终点，如果是节点或幽灵节点位置则创建目标节点
     * - 在起始节点和目标节点之间创建边（如果不存在）
     * - 将所有新创建的元素注册到历史记录中
     * - 根据多选状态更新最终的选择集合
     */
    finalizeNodeEdgeCreationSelectionHistory: ({ context, event }) => {
      if (event.category !== "MOUSE_EVENT") return;
      if (context.type !== "FROM_NODE") return;
      const isMulti = event.metaKey || event.ctrlKey;
      const endPos = event.mouseWorldPos;

      const fromNodeInfo = {
        node: context.fromNode,
        isNewlyCreated: context.isFromNodeNewlyCreated,
      };
      let toNodeInfo: {
        node: Node;
        isNewlyCreated: boolean;
      } | null = null;
      let edgeInfo: {
        edge: Edge;
        isNewlyCreated: boolean;
      } | null = null;

      const elementAtEnd = getElementAtPos(endPos);
      const ghostAtEnd = calculateGhostNodePos(endPos);
      if (elementAtEnd?.type === GraphElementType.NODE) {
        // 目标节点是已有的节点
        toNodeInfo = { node: elementAtEnd.element, isNewlyCreated: false };
      } else if (ghostAtEnd) {
        // 目标节点是新创建的节点
        const newNodeB = graph.addNode(
          ghostAtEnd.gridX,
          ghostAtEnd.gridY,
          ghostAtEnd.type
        )!;
        toNodeInfo = { node: newNodeB, isNewlyCreated: true };
      } else {
        // 目标节点不存在
        toNodeInfo = null;
      }

      // 尝试创建边
      if (toNodeInfo && fromNodeInfo.node.id !== toNodeInfo.node.id) {
        const existingEdge = graph.getEdgeBySourceAndTargetIds(
          fromNodeInfo.node.id,
          toNodeInfo.node.id
        );
        if (existingEdge) {
          // 创建的边是已有的边
          edgeInfo = { edge: existingEdge, isNewlyCreated: false };
        } else {
          // 创建的边是新增的边
          const newEdge = graph.addEdge(
            fromNodeInfo.node.id,
            toNodeInfo.node.id
          )!;
          edgeInfo = { edge: newEdge, isNewlyCreated: true };
        }
      } else {
        // 目标节点不存在或和起始节点相同
        edgeInfo = null;
      }

      // 新创建的元素
      const newElements = [];
      if (fromNodeInfo.isNewlyCreated) {
        newElements.push(nodeToElement(fromNodeInfo.node));
      }
      if (toNodeInfo && toNodeInfo.isNewlyCreated) {
        newElements.push(nodeToElement(toNodeInfo.node));
      }
      if (edgeInfo && edgeInfo.isNewlyCreated) {
        newElements.push(edgeToElement(edgeInfo.edge));
      }

      // 统一注册新创建元素的 history
      if (fromNodeInfo.isNewlyCreated) {
        history.popUndoWithoutRedo();
      }
      const cmd = new AddElementsCommand(newElements);
      history.register(cmd);

      // 统一选中新创建元素
      const newIds = new Set(newElements.map((el) => el.element.id));
      if (isMulti) {
        canvas.addSelectedElementsByIds(newIds);
      } else {
        canvas.setSelectedElementsByIds(newIds);
      }
    },

    /**
     * 完成框选操作：计算选择区域并更新选择集合
     * 根据起始位置和当前位置计算矩形选择区域，获取区域内的所有元素。
     * 若处于多选模式则追加到现有选择；否则替换当前选择（仅当有元素被选中时）。
     */
    finalizeBoxSelection: ({ context, event }) => {
      if (event.category !== "MOUSE_EVENT") return;
      if (context.type !== "FROM_EMPTY_AREA") return;
      const isMulti = event.metaKey || event.ctrlKey;
      const endPos = event.mouseWorldPos;
      const startPos = context.startWorldPos;

      const rect = {
        x1: Math.min(startPos.x, endPos.x),
        y1: Math.min(startPos.y, endPos.y),
        x2: Math.max(startPos.x, endPos.x),
        y2: Math.max(startPos.y, endPos.y),
      };
      const elements = getElementsInBox(rect);
      const newIds = new Set(elements.map((el) => el.element.id));
      if (isMulti) {
        canvas.addSelectedElementsByIds(newIds);
      } else if (newIds.size > 0) {
        canvas.setSelectedElementsByIds(newIds);
      }
    },

    // ========================= Solver Mode =========================

    handleSolverModeLeftMouseDown: ({ event }) => {
      if (event.category !== "MOUSE_EVENT") return;
      const pos = event.mouseWorldPos;
      const target = getElementAtPos(pos);
      if (target && target.type === GraphElementType.NODE) {
        const clickedNodeId = target.element.id;
        const current = get(solver);
        const wasInSolution =
          current.solution.hasSolution &&
          current.solution.nodesToPress.includes(clickedNodeId);

        graph.toggleNodeAndNeighborsOnById(clickedNodeId);

        if (get(solver).solution.hasSolution) {
          if (wasInSolution) {
            solver.removeNodeFromSolution(clickedNodeId);
          } else {
            solver.setSolution(); // 从新状态重新求解
          }
        }
      }
    },
  },
}).createMachine({
  /** @xstate-layout N4IgpgJg5mDOIC5QGMCGA7Abq2A6AlhADZgDEAggDIAqA+gCIDyA6gHIDaADALqKgAOAe1j4ALvkHo+IAB6IAjJwDMATlyqAHAFZOAFi26A7FoBsGpQBoQAT0QmTh3Ls4n5J3StcAmTi4C+flZoWDgExGQAwoys1ACiABp0ALKxrACqXLxIIEIi4pLScggmSpy4nIa6SoqGXvKGyhpWtgi1WrgOGl7uboZdXroBQRjYeIQkpLEAyhEMLBw80rliElLZRe5qhvIeqr5uKkq6zXZeal5eWvJaKjrOF0MgwaNhE5SxAGLJjGlTsXNsTJLYQrArrBTKNSaO4GYxmSw2BRdXA6XycLxKExaLTbExeR7PULjMjvL60JI-P4AjjyLICEH5NagIqKVTqFTaPSw0zmE4ILx9XC3aoVdGHWoEkZE8KkUnfX7-JiArx0nIM1aFCFs6Fcow8hEtDTuXDaQ4XAwmTgaTgqSUhMYyuXkymK+bsJSq5aMzUILTIrSqNzYjRuAVePkBry4Qy1TgGDT3OqGO0vfgAJzA-FQGdoWfQ6Hw6Cgss+8qpSoWnvVYOZClx6i8XXk1tcXV0JgjDSFAZcYsqvnxgSeUrw6cz2bAuYwBaLFBotDSAAUgdkvRrwQgdi4nPojvVDCpdBiVHzXCYhS4fLtLY3BkPCaPp4XixSFc6AGqxFf0vLr2v8vQNFwHwlB8VxnA0bY+Q8IDQPcUpDxuUMU1CPMZ2LJ1XypJdvzVX8a1kOs3AbJsW2bAYO0RYoHCcFw3A8bxfBMFDH3zZ8SzJLD-hw2lgXwplCM3Yx5GjHFrXkeRugGJoqIY3BrjxAYVAxXQjyUFjcDHWBYEgWhJFodBBAgMguI-L9FlXasBJZPEgLRS1cRUZQtD5Op2ixJQrkkjQnI5I8NK0nSID09ADKMklS2dN8cIsn9QWshR5BUNQVCSw9PFAjRtEolp5GqIVko5bZ6nqXcAozbTdP0wzjMmGZqVwtcCJZRp5NSgx22qEM+TyqM0V8VKLm2UwNIgNNUCgKBn1oAAzNNBAAWzC2rMJdBdl1ivD4p9a4lEcLodEPRQ-UUcMqIAWjKANDquVTKnbQxQNG8bJumubFuWshplmCtGqsnanJE9FGwMHZDHcHLEAuHcdjxXQdiOPanvvEdcAAI0EGRaB0khkHEWdVuijaq34na4OjLFhLcewQ2OKjwaA5xXFu9tBuYlH7XRzHsbAXH8eLb6Gs2pqEs3Pb3NMJRPJuGCzpabZHCc7wYJKWpk0eGq4GkB8+O2jcA10FFAyxE68VqPlzqy8pPJqbFHsqI0NOJXXvQ3Gn1GxUxsWuE8qK6Rw8rysxzFDAVyvHHM0OfF2-0E3bDcham+iNVRDFPPEG0bJQuicqXHY51MnyLGPmqh1l5PMWoEaPSHfWS6MDxvLkrVU8PKuC6rwpL0Wt3PHF7GbAM9w5Vzrg6a6pbOTrbmeiapqLWb5qWzXu59Opmx3I9akOa0BVrtzx5t7zfITQdhk5jGsZxsA8ejyzSY3XalCNvLs9qBxLhk+XD3Uf2MXBxSDgAgBCAA */
  id: "canvas",
  initial: MachineState.Idle,
  context: {
    type: "DEFAULT",
  },
  states: {
    // 合并后的空闲状态：处理所有可能的初始交互
    [MachineState.Idle]: {
      entry: ["clearContext"],
      on: {
        // ========================== Common ============================
        // 键盘事件：Alt 键按下进入平移准备状态
        ALT_DOWN: {
          target: MachineState.PreparePanning,
        },
        // ========================= Edit Mode ==========================
        // 右键菜单：反转节点初始状态（保持原逻辑）
        CONTEXT_MENU: {
          guard: "isEditMode",
          actions: ["invertInitialStateOnContextMenu"],
        },
        ESC_DOWN: {
          guard: "isEditMode",
          actions: ["deselectAll"],
        },
        // 鼠标按下事件：可能是编辑或平移操作
        LEFT_MOUSE_DOWN: [
          // T1: 在幽灵节点上按下
          {
            guard: and(["isOverGhostNode", "isEditMode"]),
            target: MachineState.PressedOnNode,
            actions: ["handleNewNodeCreationSelectionHistory"],
          },
          // T2: 在已有节点/边上按下
          {
            guard: and(["isOverExistingElement", "isEditMode"]),
            target: MachineState.PressedOnNode,
            actions: ["handleExistingElementSelection"],
          },
          // T3: 在空白区域按下（可能是框选或平移）
          {
            guard: "isEditMode",
            target: MachineState.BoxSelecting,
            actions: ["prepareBoxSelectionDragFromEmptyArea"],
          },
          // ========================= Solver Mode =========================
          {
            guard: "isSolverMode",
            actions: ["handleSolverModeLeftMouseDown"],
          },
        ],
      },
    },

    // ========================== Common ============================

    // 平移准备状态：按住 Alt 键但未开始拖拽
    [MachineState.PreparePanning]: {
      on: {
        LEFT_MOUSE_DOWN: {
          target: MachineState.Panning,
          actions: ["storePanStartInfo"],
        },
        ALT_UP: {
          target: MachineState.Idle,
        },
      },
    },

    // 平移状态：正在拖拽画布
    [MachineState.Panning]: {
      on: {
        MOUSE_MOVE: {
          actions: ["panViewWithPointerDelta"],
        },
        LEFT_MOUSE_UP: [
          {
            guard: "isAltKeyPressed",
            target: MachineState.PreparePanning,
          },
          {
            target: MachineState.Idle,
          },
        ],
        // ALT_UP 在 panning 状态下被忽略
      },
    },

    // ========================= Edit Mode ==========================

    // 编辑状态：按下节点
    [MachineState.PressedOnNode]: {
      on: {
        MOUSE_MOVE: {
          guard: "hasDraggedBeyondThresholdFromContextNode",
          target: MachineState.DraggingFromNode,
        },
        LEFT_MOUSE_UP: {
          target: MachineState.Idle,
        },
        ESC_DOWN: {
          target: MachineState.Idle,
        },
      },
    },

    // 编辑状态：从节点拖拽
    [MachineState.DraggingFromNode]: {
      on: {
        LEFT_MOUSE_UP: {
          target: MachineState.Idle,
          actions: ["finalizeNodeEdgeCreationSelectionHistory"],
        },
        ESC_DOWN: {
          target: MachineState.Idle,
        },
      },
    },

    // 编辑状态：框选
    [MachineState.BoxSelecting]: {
      on: {
        LEFT_MOUSE_UP: {
          target: MachineState.Idle,
          actions: ["finalizeBoxSelection"],
        },
        ESC_DOWN: {
          target: MachineState.Idle,
        },
      },
    },
  },
});

// =====================================================================
// ======================= 导出状态机实例 ===============================
// =====================================================================

export const canvasMachineActor = createActor(canvasMachine);
export const canvasMachineStore = readable(
  canvasMachineActor.getSnapshot(),
  (set) => {
    const sub = canvasMachineActor.subscribe((snapshot) => set(snapshot));
    return () => sub.unsubscribe();
  }
);

// =====================================================================
// ======================= DEBUG 打印状态转移日志 ========================
// =====================================================================

// 仅在开发环境下启用调试日志
if (import.meta.env.DEV) {
  // 打印状态转移日志
  let __canvasPrevState = canvasMachineActor.getSnapshot().value;
  canvasMachineActor.subscribe((snapshot) => {
    if (__canvasPrevState !== snapshot.value) {
      const prev = String(__canvasPrevState);
      const next = String(snapshot.value);
      console.log(`[FSM][canvas] ${prev} -> ${next}`);
      console.log(snapshot.context);

      __canvasPrevState = snapshot.value;
    }
  });

  // 打印事件日志
  const __originalCanvasSend = canvasMachineActor.send.bind(canvasMachineActor);
  canvasMachineActor.send = function (event: MachineEvent) {
    const { type: eventType, ...eventData } = event;

    if (eventType !== "MOUSE_MOVE") {
      console.log(`[FSM][canvas][Event] ${eventType}`, eventData);
    }
    return __originalCanvasSend(event);
  };
}

// =====================================================================
// ========================== 启动/停止入口 ==============================
// =====================================================================

export function startInteractionMachines() {
  canvasMachineActor.start();
}
