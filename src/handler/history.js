/**
 * @file 历史记录管理器
 * @description 负责实现撤销和重做功能，基于命令模式。
 */

import graph from "../model/graph.js";
import { viewState } from "../view/view.js";
import consoleView from "../view/console.js";

/**
 * @typedef {import('../model/graph.js').Node} Node
 * @typedef {import('../model/graph.js').Edge} Edge
 */

// ===================================================================
// ========================   Constants   ============================
// ===================================================================

const MAX_HISTORY_SIZE = 200; // 历史记录上限

// ===================================================================
// =====================   Command Classes   =========================
// ===================================================================

// --- Command Base Class ---

/**
 * @class Command
 * @description 所有命令对象的基类，定义了执行和撤销操作的接口。
 */
class Command {
    /**
     * 撤销此命令。
     */
    undo() {}
    /**
     * 重新执行（重做）此命令。
     */
    redo() {}
}

// --- Concrete Commands ---

/**
 * @class AddElementsCommand
 * @description 添加元素的命令。
 * @extends Command
 */
export class AddElementsCommand extends Command {
    /**
     * @param {{nodes: Node[], edges: Edge[]}} elements - 要添加的元素。
     */
    constructor(elements) {
        super();
        this.elements = elements; // { nodes: [Node], edges: [Edge] }
        this.elementIds = new Set([
            ...elements.nodes.map((n) => n.id),
            ...elements.edges.map((e) => e.id),
        ]);
    }

    /**
     * 撤销添加操作，即删除这些元素。
     */
    undo() {
        graph.deleteElements(this.elementIds);
        viewState.selectedElements = viewState.selectedElements.filter(
            (sel) => !this.elementIds.has(sel.id)
        );
    }

    /**
     * 重做添加操作，即恢复这些元素并选中它们。
     */
    redo() {
        graph.restoreElements(this.elements);
        viewState.selectedElements = [
            ...this.elements.nodes.map((n) => ({ type: "node", id: n.id })),
            ...this.elements.edges.map((e) => ({ type: "edge", id: e.id })),
        ];
    }
}

/**
 * @class DeleteElementsCommand
 * @description 删除元素的命令。
 * @extends Command
 */
export class DeleteElementsCommand extends Command {
    /**
     * @param {{nodes: Node[], edges: Edge[]}} elements - 要删除的元素的完整数据。
     */
    constructor(elements) {
        super();
        this.elements = elements; // { nodes: [Node], edges: [Edge] }
        this.elementIds = new Set([
            ...elements.nodes.map((n) => n.id),
            ...elements.edges.map((e) => e.id),
        ]);
    }

    /**
     * 撤销删除操作，即恢复这些元素并选中它们。
     */
    undo() {
        graph.restoreElements(this.elements);
        viewState.selectedElements = [
            ...this.elements.nodes.map((n) => ({ type: "node", id: n.id })),
            ...this.elements.edges.map((e) => ({ type: "edge", id: e.id })),
        ];
    }

    /**
     * 重做删除操作。
     */
    redo() {
        graph.deleteElements(this.elementIds);
        viewState.selectedElements = [];
    }
}

/**
 * @class InvertStateCommand
 * @description 反转节点初始状态的命令。
 * @extends Command
 */
export class InvertStateCommand extends Command {
    /**
     * @param {string[]} nodeIds - 要反转状态的节点ID数组。
     */
    constructor(nodeIds) {
        super();
        this.nodeIds = nodeIds;
    }

    /**
     * 撤销反转操作，即再次反转。
     */
    undo() {
        this.nodeIds.forEach((id) => graph.toggleInitialState(id));
    }

    /**
     * 重做反转操作。
     */
    redo() {
        this.nodeIds.forEach((id) => graph.toggleInitialState(id));
    }
}

// ===================================================================
// =====================   History States   ==========================
// ===================================================================

const state = {
    undoStack: [],
    redoStack: [],
};

/**
 * 检查一个值是否为“纯粹”的JavaScript对象。
 * @param {*} value - 要检查的值。
 * @returns {boolean}
 */
function isPlainObject(value) {
    if (Object.prototype.toString.call(value) !== "[object Object]") {
        return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === null || prototype.constructor === Object;
}

/*
 * 通过Proxy实现历史状态的响应式更新
 * 当历史状态发生变化时，自动更新控制台
 */
const handler = {
    get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);

        // 如果正在访问数组的修改方法，返回一个包装函数以触发UI更新
        if (
            Array.isArray(target) &&
            typeof value === "function" &&
            ["push", "pop", "shift", "unshift", "splice"].includes(property)
        ) {
            return function (...args) {
                const result = value.apply(target, args);
                consoleView.update(); // 自动更新UI
                return result;
            };
        }

        // 如果值是纯对象或数组，则递归地返回其代理版本
        if (
            value &&
            typeof value === "object" &&
            (Array.isArray(value) || isPlainObject(value))
        ) {
            return new Proxy(value, handler);
        }

        return value;
    },
    set(target, property, value, receiver) {
        const success = Reflect.set(target, property, value, receiver);
        if (success) {
            // 历史状态的变化仅影响控制台视图（撤销/重做按钮的状态）
            consoleView.update();
        }
        return success;
    },
};

const historyState = new Proxy(state, handler);

// ===================================================================
// =====================   History Manager   =========================
// ===================================================================

/**
 * @class HistoryManager
 * @description 历史记录管理器，提供用于注册、撤销和重做命令的API。
 * 它通过操作响应式的 historyState 来间接触发UI更新。
 */
class HistoryManager {
    /**
     * 注册一个新执行的命令。
     * 这会清空重做栈，并根据需要裁剪历史记录。
     * @param {Command} command - 已执行的命令对象。
     */
    register(command) {
        historyState.undoStack.push(command);
        if (historyState.undoStack.length > MAX_HISTORY_SIZE) {
            historyState.undoStack.shift(); // 移除最旧的记录
        }
        historyState.redoStack = [];
    }

    /**
     * 撤销上一步操作。
     * @returns {boolean}
     */
    undo() {
        if (!this.canUndo() || viewState.currentMode !== "edit") return false;

        const command = historyState.undoStack.pop();
        command.undo();
        historyState.redoStack.push(command);

        return true;
    }

    /**
     * 重做上一步被撤销的操作。
     * @returns {boolean}
     */
    redo() {
        if (!this.canRedo()) return false;
        const command = historyState.redoStack.pop();
        command.redo();
        historyState.undoStack.push(command);
        return true;
    }

    /**
     * 弹出并返回最后一个撤销命令，但不将其放入重做栈。
     * @returns {Command | undefined}
     */
    popUndoWithoutRedo() {
        if (!this.canUndo()) return undefined;
        return historyState.undoStack.pop();
    }

    /**
     * 清空所有历史记录。
     */
    clear() {
        historyState.undoStack = [];
        historyState.redoStack = [];
    }

    /**
     * 检查是否可以执行撤销操作。
     * @returns {boolean}
     */
    canUndo() {
        return historyState.undoStack.length > 0;
    }

    /**
     * 检查是否可以执行重做操作。
     * @returns {boolean}
     */
    canRedo() {
        return historyState.redoStack.length > 0;
    }
}

const historyManager = new HistoryManager();
export default historyManager;
