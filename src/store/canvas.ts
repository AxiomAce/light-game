/**
 * @file 视图核心模块（Svelte Store 版本）
 * @description 封装所有与视图相关的状态、常量和操作函数。
 */

import { get } from "svelte/store";
import { getGraphWorldPosBounds } from "../service/canvas-graphSpatial";
import { GraphElementType, ModeType } from "../types/types";
import { createEnhancedStore } from "../util/createEnhancedStore";
import { graph } from "./graph";

// ===================================================================
// ========================   Constants   ============================
// ===================================================================

export const MIN_ZOOM_LEVEL = -5; // 表示极限的缩放的等级
export const MAX_ZOOM_LEVEL = 5; // 表示极限的缩放的等级
export const ZOOM_FACTOR = 1.2; // 每次缩放操作的因子

export const GRID_SPACING = 120; // 网格的初始间距
export const WIDTH_GRID_PRIMARY = 1; // 主网格线宽度
export const WIDTH_GRID_SECONDARY = 0.5; // 次要网格线宽度
export const WIDTH_SELECTION_BOX = 1; // 框选区域的边框宽度

export const NODE_RADIUS = 12; // 节点的初始半径
export const WIDTH_NODE_STROKE_INNER = 2; // 节点内部边框宽度
export const WIDTH_NODE_HIGHLIGHT_PADDING = 3; // 高亮效果在节点外的额外宽度
export const WIDTH_NODE_SOLUTION_PADDING = 5; // 高亮效果在求解节点外的额外宽度

export const WIDTH_EDGE = 2; // 边的宽度
export const WIDTH_EDGE_HIGHLIGHT = 6; // 边的高亮宽度

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

// ===================================================================
// =======================   View Store   ============================
// ===================================================================

export interface CanvasState {
  viewClientOffset: { x: number; y: number }; // 画布的平移偏移量
  zoomLevel: number; // 画布的缩放等级
  currentMode: ModeType; // 当前应用模式: 'edit' 或 'solver'
  selectedElementIds: Set<string>; // 当前选中的元素数组 { type, id }
}

const initialState: CanvasState = {
  viewClientOffset: { x: 0, y: 0 },
  zoomLevel: 0,
  currentMode: ModeType.EDIT,
  selectedElementIds: new Set(),
};

export const canvas = createEnhancedStore({
  sources: initialState,

  dependencies: [graph],

  deriveds: ($s) => ({
    zoomRatio: Math.pow(ZOOM_FACTOR, $s.zoomLevel),
    canZoomIn: $s.zoomLevel < MAX_ZOOM_LEVEL,
    canZoomOut: $s.zoomLevel > MIN_ZOOM_LEVEL,
    selectedElements: graph.getElementsByIds($s.selectedElementIds),
    selectedNodeIds: new Set(
      graph
        .getElementsByIds($s.selectedElementIds)
        .filter((el) => el.type === GraphElementType.NODE)
        .map((el) => el.element.id)
    ),
  }),

  methods: ({ update, set, getStore }) => ({
    // ===================================================================
    // =========================   Mutators   ============================
    // ===================================================================

    reset() {
      set(initialState);
    },

    resetView() {
      update((s) => ({
        ...s,
        selectedElements: [],
        viewClientOffset: { x: 0, y: 0 },
      }));
    },

    setCurrentMode(mode: ModeType) {
      update((s) => ({ ...s, currentMode: mode }));
    },

    setViewClientOffset(offset: { x: number; y: number }) {
      update((s) => ({ ...s, viewClientOffset: { x: offset.x, y: offset.y } }));
    },

    setZoomLevel(level: number) {
      update((s) => ({ ...s, zoomLevel: level }));
    },

    setSelectedElementsByIds(ids: Set<string>) {
      update((s) => ({
        ...s,
        selectedElementIds: ids,
      }));
    },

    addSelectedElementsByIds(ids: Set<string>) {
      update((s) => ({
        ...s,
        selectedElementIds: new Set([...s.selectedElementIds, ...ids]),
      }));
    },

    removeSelectedElementsByIds(ids: Set<string>) {
      update((s) => ({
        ...s,
        selectedElementIds: new Set(
          [...s.selectedElementIds].filter((id) => !ids.has(id))
        ),
      }));
    },

    /**
     * 将视图中心平移到导入 Graph 的重心。
     * @param canvasClientRect 画布的矩形区域。
     */
    centerViewOnGraph(canvasClientRect: { width: number; height: number }) {
      // 自动将视图中心平移到导入图形的重心
      const bounds = getGraphWorldPosBounds();
      if (bounds) {
        const graphWorldWidth = bounds.maxX - bounds.minX;
        const graphWorldHeight = bounds.maxY - bounds.minY;
        const graphWorldCenterX = bounds.minX + graphWorldWidth / 2;
        const graphWorldCenterY = bounds.minY + graphWorldHeight / 2;

        // 计算偏移量，使图形中心与视图中心对齐
        const $s = getStore();
        const zr = $s.zoomRatio;
        const vx = canvasClientRect.width / 2 - graphWorldCenterX * zr;
        const vy = canvasClientRect.height / 2 - graphWorldCenterY * zr;

        update((s) => ({ ...s, viewClientOffset: { x: vx, y: vy } }));
      }
    },

    /**
     * 缩放画布和所有元素。
     * @param delta 缩放等级变化量。
     * @param canvasClientRect 画布的矩形区域。
     * @returns 操作是否成功执行。
     */
    zoomLevelChange(
      delta: number,
      canvasClientRect: { width: number; height: number }
    ): boolean {
      const $s = getStore();
      const oldZoomRatio = $s.zoomRatio;

      if (!($s.zoomLevel < MAX_ZOOM_LEVEL) && delta > 0) return false;
      if (!($s.zoomLevel > MIN_ZOOM_LEVEL) && delta < 0) return false;

      let newZoomLevel = $s.zoomLevel + delta;
      newZoomLevel = Math.max(MIN_ZOOM_LEVEL, newZoomLevel);
      newZoomLevel = Math.min(MAX_ZOOM_LEVEL, newZoomLevel);

      const newZoomRatio = Math.pow(ZOOM_FACTOR, newZoomLevel);
      const rectCenterClientPos = {
        x: canvasClientRect.width / 2,
        y: canvasClientRect.height / 2,
      } as const;

      const zoomCenterWorldPos = {
        x: (rectCenterClientPos.x - $s.viewClientOffset.x) / oldZoomRatio,
        y: (rectCenterClientPos.y - $s.viewClientOffset.y) / oldZoomRatio,
      };

      update((s) => ({
        ...s,
        zoomLevel: newZoomLevel,
        viewClientOffset: {
          x: rectCenterClientPos.x - zoomCenterWorldPos.x * newZoomRatio,
          y: rectCenterClientPos.y - zoomCenterWorldPos.y * newZoomRatio,
        },
      }));

      return true;
    },
  }),
});
