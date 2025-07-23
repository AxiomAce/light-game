/**
 * @file 视图核心模块
 * @description 封装所有与视图相关的状态、常量和操作函数。
 */

import consoleView from "./console.js";
import inspectorView from "./inspector.js";

/**
 * @typedef {import('../model/graph.js').Node} Node
 * @typedef {import('../model/graph.js').Edge} Edge
 */

// ===================================================================
// ========================   Constants   ============================
// ===================================================================

export const INITIAL_NODE_RADIUS = 12; // 节点的初始半径
export const INITIAL_GRID_SPACING = 120; // 网格的初始间距
export const MIN_GRID_SPACING = 20; // 网格的最小间距（缩放时）
export const MAX_GRID_SPACING = 200; // 网格的最大间距（缩放时）
export const ZOOM_FACTOR = 1.2; // 每次缩放操作的因子
export const EDGE_CLICK_TOLERANCE = 5; // 边的点击容差范围（像素）
export const DRAG_THRESHOLD = 5; // 识别为拖拽操作的最小距离阈值

export const COLOR_BACKGROUND = "rgb(255, 255, 255)"; // 画布背景色
export const COLOR_GRID_PRIMARY = "rgb(224, 224, 224)"; // 主网格线颜色
export const COLOR_GRID_SECONDARY = "rgb(224, 224, 224)"; // 次要网格线颜色（如对角线）
export const COLOR_STROKE_DEFAULT = "rgb(0, 0, 0)"; // 元素默认边框颜色
export const COLOR_NODE_ON = "rgb(240, 225, 48)"; // 节点激活（亮灯）颜色
export const COLOR_NODE_OFF = "rgb(105, 105, 105)"; // 节点非激活（灭灯）颜色
export const COLOR_SELECTION = "rgb(136, 136, 136)"; // 元素被选中时的高亮颜色
export const COLOR_HOVER = "rgb(224, 224, 224)"; // 鼠标悬停在元素上时的高亮颜色
export const COLOR_GHOST = "rgb(204, 204, 204)"; // “幽灵节点”的颜色
export const COLOR_DRAGLINE = "rgb(204, 204, 204)"; // 拖拽引导线的颜色
export const COLOR_SOLUTION = "rgb(0, 230, 118)"; // 求解成功时高亮节点的颜色
export const COLOR_SELECTION_BOX_FILL = "rgba(136, 136, 136, 0.2)"; // 框选区域的填充颜色
export const COLOR_SELECTION_BOX_STROKE = "rgba(105, 105, 105, 0.8)"; // 框选区域的边框颜色

export const LINE_WIDTH_DEFAULT = 2; // 元素默认边框宽度
export const LINE_WIDTH_GRID_PRIMARY = 1; // 主网格线宽度
export const LINE_WIDTH_GRID_SECONDARY = 0.5; // 次要网格线宽度
export const LINE_WIDTH_HIGHLIGHT = 6; // 高亮边框的宽度
export const LINE_WIDTH_SELECTION_BOX = 1; // 框选区域的边框宽度
export const HIGHLIGHT_PADDING = 4; // 高亮效果在节点外的额外宽度

// ===================================================================
// =======================   View States   ===========================
// ===================================================================

const state = {
    viewOffset: { x: 0, y: 0 }, // 画布的平移偏移量
    zoom: 1, // 画布的缩放级别
    currentMode: "edit", // 当前应用模式: 'edit' 或 'solver'
    canvasLayout: "square", // 画布布局: 'square' 或 'triangular'
    selectedElements: [], // 当前选中的元素数组 { type, id }
    hoveredElement: null, // 当前鼠标悬停的元素 { type, id }
    ghostNodePos: null, // "幽灵节点"的预览位置 {x, y}
    boxSelectionHovered: [], // 框选时临时悬停的元素
    dragging: {
        isActive: false, // 是否正在进行拖拽操作
        isIntentional: false, // 拖拽距离是否已超过阈值
        type: null, // 拖拽类型: 'edge', 'box', 或 'pan'
        startPos: null, // 拖拽起始的世界坐标
        currentPos: null, // 拖拽当前的事件坐标
        fromNode: null, // 创建边时的起始节点 (类型: Node | null)
        newlyCreatedElements: { nodes: [], edges: [] }, // 本次拖拽中新创建的元素
        startViewOffset: { x: 0, y: 0 }, // 开始平移时的初始画布偏移
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
