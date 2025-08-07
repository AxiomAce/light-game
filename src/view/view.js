/**
 * @file 视图核心模块
 * @description 封装所有与视图相关的状态、常量和操作函数。
 */

import consoleView from "./console.js";
import inspectorView from "./inspector.js";
import { gridToPixel } from "./canvas.js";
import { graphState } from "../model/graph.js";

/**
 * @typedef {import('../model/graph.js').Node} Node
 * @typedef {import('../model/graph.js').Edge} Edge
 */

// ===================================================================
// ========================   Constants   ============================
// ===================================================================

export const INITIAL_NODE_RADIUS = 12; // 节点的初始半径
export const INITIAL_GRID_SPACING = 120; // 网格的初始间距
export const MIN_ZOOM_LEVEL = -5; // 表示极限的缩放的等级
export const MAX_ZOOM_LEVEL = 5; // 表示极限的缩放的等级
export const ZOOM_FACTOR = 1.2; // 每次缩放操作的因子
export const EDGE_CLICK_TOLERANCE = 5; // 边的点击容差范围（像素）
export const DRAG_THRESHOLD = 12; // 识别为拖拽操作的最小距离阈值

export const COLOR_BACKGROUND = "rgb(255, 255, 255)"; // 画布背景色
export const COLOR_GRID_PRIMARY = "rgb(224, 224, 224)"; // 主网格线颜色
export const COLOR_GRID_SECONDARY = "rgb(224, 224, 224)"; // 次要网格线颜色（如对角线）
export const COLOR_STROKE_DEFAULT = "rgb(0, 0, 0)"; // 元素默认边框颜色
export const COLOR_NODE_ON = "rgb(240, 225, 48)"; // 节点激活（亮灯）颜色
export const COLOR_NODE_OFF = "rgb(105, 105, 105)"; // 节点非激活（灭灯）颜色
export const COLOR_SELECTION = "rgba(136, 136, 136, 0.6)"; // 元素被选中时的高亮颜色
export const COLOR_HOVER = "rgba(216, 216, 216, 0.6)"; // 鼠标悬停在元素上时的高亮颜色
export const COLOR_GHOST = "rgba(204, 204, 204, 0.6)"; // “幽灵节点”的颜色
export const COLOR_DRAGLINE = "rgba(204, 204, 204, 0.6)"; // 拖拽引导线的颜色
export const COLOR_SOLUTION = "rgba(0, 230, 118, 0.6)"; // 求解成功时高亮节点的颜色
export const COLOR_SELECTION_BOX_FILL = "rgba(136, 136, 136, 0.2)"; // 框选区域的填充颜色
export const COLOR_SELECTION_BOX_STROKE = "rgba(105, 105, 105, 0.8)"; // 框选区域的边框颜色

export const LINE_WIDTH_DEFAULT = 2; // 元素默认边框宽度
export const LINE_WIDTH_GRID_PRIMARY = 1; // 主网格线宽度
export const LINE_WIDTH_GRID_SECONDARY = 0.5; // 次要网格线宽度
export const LINE_WIDTH_HIGHLIGHT = 6; // 高亮边框的宽度
export const LINE_WIDTH_SELECTION_BOX = 1; // 框选区域的边框宽度
export const HIGHLIGHT_PADDING = 4; // 高亮效果在节点外的额外宽度

/**
 * 定义应用模式的类型枚举
 * @readonly
 * @enum {string}
 */
export const ModeType = Object.freeze({
    EDIT: "edit",
    SOLVER: "solver",
});

/**
 * 定义拖拽操作的类型枚举
 * @readonly
 * @enum {string}
 */
export const DraggingType = Object.freeze({
    NULL: "null",
    PRESSED: "pressed", // 按下节点但未拖拽
    EDGE_DRAG: "edge-drag", // 拖拽创建边
    BOX_DRAG: "box-drag", // 框选
    PAN_DRAG: "pan-drag", // 平移
});

// ===================================================================
// =======================   View States   ===========================
// ===================================================================

const state = {
    viewOffset: { x: 0, y: 0 }, // 画布的平移偏移量
    zoomLevel: 0, // 画布的缩放等级
    mousePos: { x: 0, y: 0 }, // 鼠标在画布内的“世界坐标”
    currentMode: ModeType.EDIT, // 当前应用模式: 'edit' 或 'solver'
    selectedElements: [], // 当前选中的元素数组 { type, id }
    dragging: {
        // TODO: 可以根据状态图来重新设计
        type: DraggingType.NULL, // 拖拽类型
        startPos: null, // 拖拽起始的世界坐标
        fromNode: null, // 创建边时的起始节点 (类型: Node | null)
        newlyCreatedElements: { nodes: [], edges: [] }, // 本次拖拽中新创建的元素
        startViewOffset: { x: 0, y: 0 }, // 开始平移时的初始画布偏移
        provisionalCommand: null, // 本次拖拽中临时的、可替换的命令
    },
};

/*
 * 通过Proxy实现视图状态的响应式更新
 * 当视图状态发生变化时，自动更新控制台和查看器
 */
const handler = {
    get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value === "object" && value !== null) {
            return new Proxy(value, handler);
        }
        return value;
    },
    set(target, property, value, receiver) {
        const success = Reflect.set(target, property, value, receiver);
        if (success) {
            consoleView.update();
            inspectorView.update();
        }
        return success;
    },
};

export const viewState = new Proxy(state, handler);

// ===================================================================
// ========================   Utility   ==============================
// ===================================================================

export function isNotDragging() {
    return (
        viewState.dragging.type === DraggingType.NULL ||
        viewState.dragging.type === DraggingType.PRESSED
    );
}

export function getFromNodePos() {
    if (viewState.dragging.fromNode) {
        return gridToPixel(viewState.dragging.fromNode, graphState.grid);
    }
    return null;
}

export function getZoomRatio() {
    return Math.pow(ZOOM_FACTOR, viewState.zoomLevel);
}

export function canZoomIn() {
    return viewState.zoomLevel < MAX_ZOOM_LEVEL;
}

export function canZoomOut() {
    return viewState.zoomLevel > MIN_ZOOM_LEVEL;
}

// TODO: 这是临时实现，用于判断模态框是否可见
export function isModalVisible() {
    return !document
        .getElementById("modal-overlay-html")
        .classList.contains("hidden");
}

// ===================================================================
// ====================   Event Listeners   ==========================
// ===================================================================

const mousePosUpdateHandler = {
    /**
     * 更新鼠标在画布世界坐标系中的位置
     * @param {MouseEvent} e - 鼠标事件对象
     */
    handleMouseMove(e) {
        const rect = document
            .getElementById("canvas-html")
            .getBoundingClientRect();
        viewState.mousePos = {
            x:
                (e.clientX - rect.left - viewState.viewOffset.x) /
                getZoomRatio(),
            y: (e.clientY - rect.top - viewState.viewOffset.y) / getZoomRatio(),
        };
    },
};

// 实时更新鼠标在画布世界坐标系中的位置
window.addEventListener("mousemove", (e) => {
    mousePosUpdateHandler.handleMouseMove(e);
});
