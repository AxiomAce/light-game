/**
 * @file 历史记录管理器
 * @description 负责实现撤销和重做功能，基于命令模式。
 */

import { createEnhancedStore } from "../util/createEnhancedStore";
import { graph } from "./graph";
import { canvas } from "./canvas";
import { ModeType, type Node, type GraphElement } from "../types/types";
import { get } from "svelte/store";

// ===================================================================
// ========================   Constants   ============================
// ===================================================================

const MAX_HISTORY_SIZE = 200; // 历史记录上限

// ===================================================================
// =====================   History Store   ===========================
// ===================================================================

const initialSources = {
  /** 撤销栈。*/
  undoStack: [] as Command[],
  /** 重做栈。*/
  redoStack: [] as Command[],
};

export const history = createEnhancedStore({
  sources: initialSources,

  dependencies: [],

  deriveds: ($s) => ({
    canUndo: $s.undoStack.length > 0,
    canRedo: $s.redoStack.length > 0,
  }),

  methods: ({ update, set, getStore }) => ({
    // ===================================================================
    // =========================   Mutators   ============================
    // ===================================================================

    /**
     * 注册一个新执行的命令。
     * 这会清空重做栈，并根据需要裁剪历史记录。
     * @param command - 已执行的命令对象。
     */
    register(command: Command) {
      update((s) => {
        const appended = [...s.undoStack, command];
        const trimmed = appended.slice(
          Math.max(0, appended.length - MAX_HISTORY_SIZE)
        );
        return { undoStack: trimmed, redoStack: [] };
      });
    },

    /**
     * 撤销上一步操作。
     * @returns 操作是否成功。
     */
    undo(): boolean {
      const $s = getStore();
      if (
        $s.undoStack.length === 0 ||
        get(canvas).currentMode !== ModeType.EDIT
      ) {
        return false;
      }
      const command = $s.undoStack[$s.undoStack.length - 1];
      command.undo();
      update((s) => ({
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, command],
      }));
      return true;
    },

    /**
     * 重做上一步被撤销的操作。
     * @returns 操作是否成功。
     */
    redo(): boolean {
      const $s = getStore();
      if ($s.redoStack.length === 0) return false;
      const command = $s.redoStack[$s.redoStack.length - 1];
      command.redo();
      update((s) => ({
        undoStack: [...s.undoStack, command],
        redoStack: s.redoStack.slice(0, -1),
      }));
      return true;
    },

    /**
     * 弹出并返回最后一个撤销命令，但不将其放入重做栈。
     * @returns 最后一个撤销命令；若无则返回 undefined。
     */
    popUndoWithoutRedo(): Command | undefined {
      const $s = getStore();
      if ($s.undoStack.length === 0) return undefined;
      const command = $s.undoStack[$s.undoStack.length - 1];
      update((s) => ({
        undoStack: s.undoStack.slice(0, -1),
        redoStack: s.redoStack,
      }));
      return command;
    },

    /**
     * 清空所有历史记录。
     */
    clear() {
      set(initialSources);
    },
  }),
});
export default history;

// ===================================================================
// =====================   Command Classes   =========================
// ===================================================================

// --- Command Base Class ---

/**
 * @class Command
 * @description 所有命令对象的基类，定义了执行和撤销操作的接口。
 */
export class Command {
  /**
   * 撤销此命令。
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  undo(): void {}
  /**
   * 重新执行（重做）此命令。
   */
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  redo(): void {}
}

// --- Concrete Commands ---

/**
 * @class AddElementsCommand
 * @description 添加元素的命令。
 */
export class AddElementsCommand extends Command {
  private elements: GraphElement[];

  /**
   * @param elements - 要添加的元素。
   */
  constructor(elements: GraphElement[]) {
    super();
    this.elements = elements;
  }

  /**
   * 撤销添加操作，即删除这些元素。
   */
  override undo() {
    const elementIds = new Set(this.elements.map((el) => el.element.id));
    graph.deleteElementsByIds(elementIds);
    canvas.removeSelectedElementsByIds(elementIds);
  }

  /**
   * 重做添加操作，即恢复这些元素并选中它们。
   */
  override redo() {
    graph.restoreElements(this.elements);
    const elementIds = new Set(this.elements.map((el) => el.element.id));
    canvas.setSelectedElementsByIds(elementIds);
  }
}

/**
 * @class DeleteElementsCommand
 * @description 删除元素的命令。
 */
export class DeleteElementsCommand extends Command {
  private elements: GraphElement[];

  /**
   * @param elements - 要删除的元素的完整数据。
   */
  constructor(elements: GraphElement[]) {
    super();
    this.elements = elements;
  }

  /**
   * 撤销删除操作，即恢复这些元素并选中它们。
   */
  override undo() {
    graph.restoreElements(this.elements);
    canvas.setSelectedElementsByIds(
      new Set(this.elements.map((el) => el.element.id))
    );
  }

  /**
   * 重做删除操作。
   */
  override redo() {
    const elementIds = new Set(this.elements.map((el) => el.element.id));
    graph.deleteElementsByIds(elementIds);
    canvas.setSelectedElementsByIds(new Set());
  }
}

/**
 * @class InitInvertCommand
 * @description 反转节点初始状态的命令。
 */
export class InitInvertCommand extends Command {
  private nodeIds: Set<string>;

  /**
   * @param nodeIds 要反转状态的节点ID数组。
   */
  constructor(nodeIds: Set<string>) {
    super();
    this.nodeIds = nodeIds;
  }

  /**
   * 撤销反转操作，即再次反转。
   */
  override undo() {
    this.nodeIds.forEach((id) => graph.toggleNodeInitialOnById(id));
  }

  /**
   * 重做反转操作。
   */
  override redo() {
    this.nodeIds.forEach((id) => graph.toggleNodeInitialOnById(id));
  }
}

/**
 * @class InitTurnOffCommand
 * @description 将所有选中节点的初始状态设置为关闭的命令
 */
export class InitTurnOffCommand extends Command {
  private nodeIds: Set<string>;
  private previousStates: Map<string, boolean>;

  /**
   * @param nodeIds - 要设置状态的节点ID数组。
   */
  constructor(nodeIds: Set<string>) {
    super();
    this.nodeIds = nodeIds;
    const previousStates = new Map(); // 存储修改前的状态
    nodeIds.forEach((id) => {
      const node = graph.getNodeById(id);
      if (node) {
        previousStates.set(id, node.initialOn);
      }
    });
    this.previousStates = previousStates;
  }

  /**
   * 撤销操作，恢复节点的原始初始状态。
   */
  override undo() {
    const updates: Array<Pick<Node, "id" | "initialOn">> = [];
    this.nodeIds.forEach((id) => {
      if (this.previousStates.has(id)) {
        updates.push({ id, initialOn: this.previousStates.get(id)! });
      }
    });
    if (updates.length > 0) {
      graph.setNodesInitialOnByIds(updates);
    }
  }

  /**
   * 重做操作，将所有选中节点的初始状态设置为关闭。
   */
  override redo() {
    const updates: Array<Pick<Node, "id" | "initialOn">> = [];
    this.nodeIds.forEach((id) => {
      updates.push({ id, initialOn: false });
    });
    if (updates.length > 0) {
      graph.setNodesInitialOnByIds(updates);
    }
  }
}
