/**
 * @file Canvas绘图模块
 * @description 封装所有与Canvas 2D上下文直接交互的绘图函数，负责渲染应用的视觉表现。
 * 绘制策略：在界面主循环中不停循环调用 draw() 函数。
 * NOTE: 本文件在 WorldPos 坐标系下进行计算
 */

import { get } from "svelte/store";
import { canvasMachineStore, MachineState } from "../../handler/canvas-fsm";
import { gridPos2WorldPos } from "../../service/canvas-geometry";
import {
  calculateGhostNodePos,
  getElementAtPos,
  getElementsInBox,
} from "../../service/canvas-graphSpatial";
import {
  canvas,
  COLOR_BACKGROUND,
  COLOR_DRAGLINE,
  COLOR_GHOST,
  COLOR_GRID_PRIMARY,
  COLOR_GRID_SECONDARY,
  COLOR_HOVER,
  COLOR_NODE_OFF,
  COLOR_NODE_ON,
  COLOR_SELECTION,
  COLOR_SELECTION_BOX_FILL,
  COLOR_SELECTION_BOX_STROKE,
  COLOR_SOLUTION,
  COLOR_STROKE_DEFAULT,
  GRID_SPACING,
  NODE_RADIUS,
  WIDTH_EDGE,
  WIDTH_EDGE_HIGHLIGHT,
  WIDTH_GRID_PRIMARY,
  WIDTH_GRID_SECONDARY,
  WIDTH_NODE_HIGHLIGHT_PADDING,
  WIDTH_NODE_SOLUTION_PADDING,
  WIDTH_NODE_STROKE_INNER,
  WIDTH_SELECTION_BOX,
} from "../../store/canvas";
import { graph } from "../../store/graph";
import { solver } from "../../store/solver";
import {
  GraphElementType,
  GridType,
  ModeType,
  NodeType,
  type GraphElement,
} from "../../types/types";

/**
 * @class CanvasRenderer
 * @description 负责管理Canvas 2D上下文，并提供绘图API。仅负责渲染，不做DOM样式副作用。
 */
export class CanvasRenderer {
  /** 2D上下文 */
  #ctx!: CanvasRenderingContext2D;
  /** 画布的DOM元素 */
  #canvasEl!: HTMLCanvasElement;

  /** 初始化Canvas模块。*/
  constructor(canvasEl: HTMLCanvasElement) {
    this.#canvasEl = canvasEl;
    this.#ctx = this.#canvasEl.getContext("2d")!;
  }

  /** 设置画布尺寸以匹配设备像素比，并适应窗口大小。*/
  setupCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.#canvasEl.getBoundingClientRect();
    this.#canvasEl.width = Math.max(1, Math.floor(rect.width * dpr));
    this.#canvasEl.height = Math.max(1, Math.floor(rect.height * dpr));
    // 重置为单位矩阵再按 dpr 缩放，避免多次累积
    this.#ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.#ctx.scale(dpr, dpr);
  }

  // ===================================================================
  // ========================   绘制 canvas   ===========================
  // ===================================================================

  /** 主渲染函数，按预定顺序调用所有独立的绘图函数。*/
  draw(mouseWorldPos: { x: number; y: number }) {
    const rect = this.#canvasEl.getBoundingClientRect();
    // Fill background first, in screen space
    this.#ctx.fillStyle = COLOR_BACKGROUND;
    this.#ctx.fillRect(rect.x, rect.y, rect.width, rect.height);

    this.#ctx.save();
    this.#ctx.translate(
      get(canvas).viewClientOffset.x,
      get(canvas).viewClientOffset.y
    );
    this.#ctx.scale(get(canvas).zoomRatio, get(canvas).zoomRatio);

    this.#isolateWrapper(() => this.#drawBackground(rect));
    this.#isolateWrapper(() => this.#drawHoverHighlight(mouseWorldPos));
    this.#isolateWrapper(() => this.#drawSelectionHighlights());
    this.#isolateWrapper(() => this.#drawSolutionHighlight());
    this.#isolateWrapper(() => this.#drawEdges());
    this.#isolateWrapper(() => this.#drawDragLine(mouseWorldPos));
    this.#isolateWrapper(() => this.#drawGhostNode(mouseWorldPos));
    this.#isolateWrapper(() => this.#drawSelectionBox(mouseWorldPos));
    this.#isolateWrapper(() => this.#drawNodes());

    this.#ctx.restore();
  }

  /**
   * 绘制画布背景和网格线。
   */
  #drawBackground(rect: DOMRect) {
    const S = GRID_SPACING;

    // 计算当前视口的世界坐标范围
    const viewXStart = -get(canvas).viewClientOffset.x / get(canvas).zoomRatio;
    const viewYStart = -get(canvas).viewClientOffset.y / get(canvas).zoomRatio;
    const viewXEnd = viewXStart + rect.width / get(canvas).zoomRatio;
    const viewYEnd = viewYStart + rect.height / get(canvas).zoomRatio;

    if (get(graph).grid === GridType.SQUARE) {
      // --- 绘制正方形网格 ---
      const gridX_min = Math.floor(viewXStart / S) - 1;
      const gridX_max = Math.ceil(viewXEnd / S) + 1;
      const gridY_min = Math.floor(viewYStart / S) - 1;
      const gridY_max = Math.ceil(viewYEnd / S) + 1;

      // 绘制主网格线 (垂直和水平)
      this.#ctx.strokeStyle = COLOR_GRID_PRIMARY;
      this.#setAbsoluteLineWidth(WIDTH_GRID_PRIMARY);
      this.#ctx.beginPath();

      // 绘制所有可见的垂直线
      for (let gridX = gridX_min; gridX <= gridX_max; gridX++) {
        const p = gridPos2WorldPos({
          gridX: gridX,
          gridY: 0,
          type: NodeType.SQUARE_VERTEX,
        });
        this.#ctx.moveTo(p.x, viewYStart);
        this.#ctx.lineTo(p.x, viewYEnd);
      }
      // 绘制所有可见的水平线
      for (let gridY = gridY_min; gridY <= gridY_max; gridY++) {
        const p = gridPos2WorldPos({
          gridX: 0,
          gridY: gridY,
          type: NodeType.SQUARE_VERTEX,
        });
        this.#ctx.moveTo(viewXStart, p.y);
        this.#ctx.lineTo(viewXEnd, p.y);
      }
      this.#ctx.stroke();

      // 绘制次要网格线 (对角线)
      this.#ctx.strokeStyle = COLOR_GRID_SECONDARY;
      this.#setAbsoluteLineWidth(WIDTH_GRID_SECONDARY);
      this.#ctx.beginPath();

      for (let gridY = gridY_min; gridY < gridY_max; gridY++) {
        for (let gridX = gridX_min; gridX < gridX_max; gridX++) {
          const p_tl = gridPos2WorldPos({
            gridX: gridX,
            gridY: gridY,
            type: NodeType.SQUARE_VERTEX,
          });
          const p_tr = { x: p_tl.x + S, y: p_tl.y };
          const p_bl = { x: p_tl.x, y: p_tl.y + S };
          const p_br = { x: p_tl.x + S, y: p_tl.y + S };

          // 绘制两条对角线
          this.#ctx.moveTo(p_tl.x, p_tl.y);
          this.#ctx.lineTo(p_br.x, p_br.y);
          this.#ctx.moveTo(p_tr.x, p_tr.y);
          this.#ctx.lineTo(p_bl.x, p_bl.y);
        }
      }
      this.#ctx.stroke();
    } else if (get(graph).grid === GridType.TRIANGULAR) {
      // --- 绘制三角形网格 ---
      const h = (S * Math.sqrt(3)) / 2; // 等边三角形的高度
      const gridY_min = Math.floor(viewYStart / h) - 1;
      const gridY_max = Math.ceil(viewYEnd / h) + 1;
      const gridX_min = Math.floor(viewXStart / S) - 2;
      const gridX_max = Math.ceil(viewXEnd / S) + 2;

      // 绘制主网格线 (构成所有三角形的边)
      this.#ctx.strokeStyle = COLOR_GRID_PRIMARY;
      this.#setAbsoluteLineWidth(WIDTH_GRID_PRIMARY);
      this.#ctx.beginPath();

      for (let gridY = gridY_min; gridY < gridY_max; gridY++) {
        for (let gridX = gridX_min; gridX < gridX_max; gridX++) {
          // 将每个逻辑顶点(gridX, gridY)视为一个朝上(▲)三角形的顶尖
          const p_tip = gridPos2WorldPos({
            gridX: gridX,
            gridY: gridY,
            type: NodeType.TRIANGLE_VERTEX,
          });

          // 从顶尖的几何位置推导出底部的两个顶点
          const p_base_L = { x: p_tip.x - S / 2, y: p_tip.y + h };
          const p_base_R = { x: p_tip.x + S / 2, y: p_tip.y + h };

          // 绘制这个朝上三角形的三个边
          this.#ctx.moveTo(p_tip.x, p_tip.y);
          this.#ctx.lineTo(p_base_L.x, p_base_L.y);
          this.#ctx.lineTo(p_base_R.x, p_base_R.y);
          this.#ctx.closePath();
        }
      }
      this.#ctx.stroke();

      // 绘制次要网格线 (从三角形中心到其顶点)
      this.#ctx.strokeStyle = COLOR_GRID_SECONDARY;
      this.#setAbsoluteLineWidth(WIDTH_GRID_SECONDARY);
      this.#ctx.beginPath();

      for (let gridY = gridY_min; gridY < gridY_max; gridY++) {
        for (let gridX = gridX_min; gridX < gridX_max; gridX++) {
          // --- 1. 处理以 (gridX, gridY) 为顶尖的朝上(▲)三角形 ---
          const p_tip = gridPos2WorldPos({
            gridX: gridX,
            gridY: gridY,
            type: NodeType.TRIANGLE_VERTEX,
          });
          const p_base_L = { x: p_tip.x - S / 2, y: p_tip.y + h };
          const p_base_R = { x: p_tip.x + S / 2, y: p_tip.y + h };
          // ▲ 三角形的重心在顶尖下方 2/3 高度处
          const p_center_up = { x: p_tip.x, y: p_tip.y + (2 * h) / 3 };

          // 绘制从中心到三个顶点的连线
          this.#ctx.moveTo(p_center_up.x, p_center_up.y);
          this.#ctx.lineTo(p_tip.x, p_tip.y);
          this.#ctx.moveTo(p_center_up.x, p_center_up.y);
          this.#ctx.lineTo(p_base_L.x, p_base_L.y);
          this.#ctx.moveTo(p_center_up.x, p_center_up.y);
          this.#ctx.lineTo(p_base_R.x, p_base_R.y);

          // --- 2. 处理与上述▲三角形相邻的朝下(▼)三角形 ---
          const p_center_down = { x: p_tip.x + S / 2, y: p_tip.y + h / 3 };
          const v1 = p_tip;
          const v2 = gridPos2WorldPos({
            gridX: gridX + 1,
            gridY: gridY,
            type: NodeType.TRIANGLE_VERTEX,
          });
          const v3 = p_base_R;

          this.#ctx.moveTo(p_center_down.x, p_center_down.y);
          this.#ctx.lineTo(v1.x, v1.y);
          this.#ctx.moveTo(p_center_down.x, p_center_down.y);
          this.#ctx.lineTo(v2.x, v2.y);
          this.#ctx.moveTo(p_center_down.x, p_center_down.y);
          this.#ctx.lineTo(v3.x, v3.y);
        }
      }
      this.#ctx.stroke();
    }
  }

  /** 绘制所有节点，根据模式显示不同状态。*/
  #drawNodes() {
    get(graph).nodes.forEach((node) => {
      const pos = gridPos2WorldPos(node);

      // 绘制节点圆形
      this.#ctx.beginPath();
      this.#ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
      this.#ctx.fillStyle = (
        get(canvas).currentMode === ModeType.SOLVER ? node.on : node.initialOn
      )
        ? COLOR_NODE_ON
        : COLOR_NODE_OFF;
      this.#ctx.fill();

      // 绘制节点边框 (位于圆内部，保持视觉宽度不变)
      this.#ctx.beginPath();
      this.#ctx.arc(
        pos.x,
        pos.y,
        NODE_RADIUS - WIDTH_NODE_STROKE_INNER / 2,
        0,
        Math.PI * 2
      );
      this.#ctx.strokeStyle = COLOR_STROKE_DEFAULT;
      this.#setScalingLineWidth(WIDTH_NODE_STROKE_INNER);
      this.#ctx.stroke();
    });
  }

  /** 绘制所有边。*/
  #drawEdges() {
    get(graph).edges.forEach((edge) => {
      const fromNode = graph.getNodeById(edge.source);
      const toNode = graph.getNodeById(edge.target);
      if (!fromNode || !toNode) return;

      const fromPos = gridPos2WorldPos(fromNode);
      const toPos = gridPos2WorldPos(toNode);

      this.#ctx.beginPath();
      this.#ctx.moveTo(fromPos.x, fromPos.y);
      this.#ctx.lineTo(toPos.x, toPos.y);
      this.#ctx.strokeStyle = COLOR_STROKE_DEFAULT;
      this.#setScalingLineWidth(WIDTH_EDGE);
      this.#ctx.stroke();
    });
  }

  /** 绘制用于预览新节点创建的“幽灵节点”。*/
  #drawGhostNode(mouseWorldPos: { x: number; y: number }) {
    if (get(canvas).currentMode !== ModeType.EDIT) return;

    // 幽灵节点显示由状态机 phase 决定
    const phase = get(canvasMachineStore).value;
    const showGhost =
      phase === MachineState.Idle ||
      phase === MachineState.PressedOnNode ||
      phase === MachineState.DraggingFromNode;
    if (!showGhost) return;

    const ghostNodePos = calculateGhostNodePos(mouseWorldPos);
    if (ghostNodePos) {
      const pos = gridPos2WorldPos(ghostNodePos);
      this.#ctx.beginPath();
      this.#ctx.arc(
        pos.x,
        pos.y,
        NODE_RADIUS + WIDTH_NODE_HIGHLIGHT_PADDING / 2,
        0,
        Math.PI * 2
      );
      this.#ctx.strokeStyle = COLOR_GHOST;
      this.#setScalingLineWidth(WIDTH_NODE_HIGHLIGHT_PADDING);
      this.#ctx.stroke();
    }
  }

  /** 绘制从节点拖拽出以创建边的引导线。*/
  #drawDragLine(mouseWorldPos: { x: number; y: number }) {
    const snap = get(canvasMachineStore);
    const phase = snap.value;
    const isEdgePhase = phase === MachineState.DraggingFromNode;
    if (!isEdgePhase || snap.context.type !== "FROM_NODE") return;

    let startPos: { x: number; y: number } | undefined;
    const ctx = snap.context;
    startPos = gridPos2WorldPos(ctx.fromNode);

    let endPos = mouseWorldPos;
    const hoveredElement = getElementAtPos(endPos);
    const ghostNodePos = calculateGhostNodePos(endPos);

    if (hoveredElement && hoveredElement.type === GraphElementType.NODE) {
      const node = hoveredElement.element;
      endPos = gridPos2WorldPos(node);
    } else if (ghostNodePos) {
      endPos = gridPos2WorldPos(ghostNodePos);
    }

    this.#ctx.beginPath();
    this.#ctx.moveTo(startPos.x, startPos.y);
    this.#ctx.lineTo(endPos.x, endPos.y);
    this.#ctx.strokeStyle = COLOR_DRAGLINE;
    this.#setScalingLineWidth(WIDTH_EDGE);
    this.#ctx.stroke();
  }

  /** 绘制框选时的矩形选框。*/
  #drawSelectionBox(mouseWorldPos: { x: number; y: number }) {
    const snap = get(canvasMachineStore);
    const phase = snap.value;
    const isBoxPhase = phase === MachineState.BoxSelecting;
    const ctx = snap.context;
    if (!isBoxPhase || ctx.type !== "FROM_EMPTY_AREA") return;

    const startPos = ctx.startWorldPos;
    const endPos = mouseWorldPos;
    this.#ctx.fillStyle = COLOR_SELECTION_BOX_FILL;
    this.#ctx.strokeStyle = COLOR_SELECTION_BOX_STROKE;
    this.#setAbsoluteLineWidth(WIDTH_SELECTION_BOX);
    const rectX = Math.min(startPos.x, endPos.x);
    const rectY = Math.min(startPos.y, endPos.y);
    const rectW = Math.abs(startPos.x - endPos.x);
    const rectH = Math.abs(startPos.y - endPos.y);
    this.#ctx.fillRect(rectX, rectY, rectW, rectH);
    this.#ctx.strokeRect(rectX, rectY, rectW, rectH);
  }

  /** 绘制鼠标悬停在元素上时的高亮效果。*/
  #drawHoverHighlight(mouseWorldPos: { x: number; y: number }) {
    if (get(canvas).currentMode !== ModeType.EDIT) return;

    const snap = get(canvasMachineStore);
    const phase = snap.value;
    const isBoxPhase = phase === MachineState.BoxSelecting;
    const isPressedOrEdgePhase =
      phase === MachineState.PressedOnNode ||
      phase === MachineState.DraggingFromNode;

    // --- 获取需要高亮的元素 ---
    let elementsToHighlight: GraphElement[] = [];
    if (isBoxPhase && snap.context.type === "FROM_EMPTY_AREA") {
      const startPos = snap.context.startWorldPos;
      const endPos = mouseWorldPos;
      if (startPos) {
        const rect = {
          x1: Math.min(startPos.x, endPos.x),
          y1: Math.min(startPos.y, endPos.y),
          x2: Math.max(startPos.x, endPos.x),
          y2: Math.max(startPos.y, endPos.y),
        };
        elementsToHighlight = getElementsInBox(rect);
      }
    } else {
      // 空闲或拖拽创建边时的高亮
      const hoveredElement = getElementAtPos(mouseWorldPos);
      if (hoveredElement) {
        const isSelected = get(canvas).selectedElements.some(
          (s) => s.element.id === hoveredElement.element.id
        );
        if (!isSelected) {
          if (
            hoveredElement.type === GraphElementType.EDGE &&
            isPressedOrEdgePhase
          ) {
            // skip edge highlight during edge-drag
          } else {
            elementsToHighlight.push(hoveredElement);
          }
        }
      }
    }

    // --- 绘制高亮效果 ---
    elementsToHighlight.forEach((el) => {
      if (el.type === GraphElementType.NODE) {
        const node = el.element;
        const pos = gridPos2WorldPos(node);
        this.#ctx.beginPath();
        this.#ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        this.#ctx.strokeStyle = COLOR_HOVER;
        this.#setScalingLineWidth(2 * WIDTH_NODE_HIGHLIGHT_PADDING);
        this.#ctx.stroke();
      } else if (el.type === GraphElementType.EDGE) {
        // 创建边时不高亮悬浮边
        if (!isPressedOrEdgePhase) {
          const edge = el.element;
          const fromNode = graph.getNodeById(edge.source);
          const toNode = graph.getNodeById(edge.target);
          if (!fromNode || !toNode) return;
          const fromPos = gridPos2WorldPos(fromNode);
          const toPos = gridPos2WorldPos(toNode);
          this.#ctx.beginPath();
          this.#ctx.moveTo(fromPos.x, fromPos.y);
          this.#ctx.lineTo(toPos.x, toPos.y);
          this.#ctx.strokeStyle = COLOR_HOVER;
          this.#setScalingLineWidth(WIDTH_EDGE_HIGHLIGHT);
          this.#ctx.stroke();
        }
      }
    });
  }

  /** 绘制选中元素的高亮效果。*/
  #drawSelectionHighlights() {
    get(canvas).selectedElements.forEach((sel) => {
      if (sel.type === GraphElementType.NODE) {
        const node = sel.element;
        const pos = gridPos2WorldPos(node);
        this.#ctx.beginPath();
        this.#ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        this.#ctx.strokeStyle = COLOR_SELECTION;
        this.#setScalingLineWidth(2 * WIDTH_NODE_HIGHLIGHT_PADDING);
        this.#ctx.stroke();
      } else if (sel.type === GraphElementType.EDGE) {
        const edge = sel.element;
        const fromNode = graph.getNodeById(edge.source);
        const toNode = graph.getNodeById(edge.target);
        if (!fromNode || !toNode) return;
        const fromPos = gridPos2WorldPos(fromNode);
        const toPos = gridPos2WorldPos(toNode);
        this.#ctx.beginPath();
        this.#ctx.moveTo(fromPos.x, fromPos.y);
        this.#ctx.lineTo(toPos.x, toPos.y);
        this.#ctx.strokeStyle = COLOR_SELECTION;
        this.#setScalingLineWidth(WIDTH_EDGE_HIGHLIGHT);
        this.#ctx.stroke();
      }
    });
  }

  /** 绘制求解模式下解法的高亮提示。*/
  #drawSolutionHighlight() {
    const s = get(solver);
    if (get(canvas).currentMode !== ModeType.SOLVER || !s.solution.hasSolution)
      return;
    s.solution.nodesToPress.forEach((nodeId: string) => {
      const node = graph.getNodeById(nodeId);
      if (node) {
        const pos = gridPos2WorldPos(node);
        this.#ctx.beginPath();
        this.#ctx.arc(pos.x, pos.y, NODE_RADIUS, 0, Math.PI * 2);
        this.#ctx.strokeStyle = COLOR_SOLUTION;
        this.#setScalingLineWidth(2 * WIDTH_NODE_SOLUTION_PADDING);
        this.#ctx.stroke();
      }
    });
  }

  // ===================================================================
  // ==========================   绘制辅助   ============================
  // ===================================================================

  /**
   * 设置当前上下文的线宽，并根据缩放级别进行调整以保持视觉宽度不变。
   * @param width 线宽（像素）
   */
  #setAbsoluteLineWidth(width: number) {
    this.#ctx.lineWidth = width / get(canvas).zoomRatio;
  }

  /**
   * 设置当前上下文的线宽，随着缩放级别变化。
   * @param width 线宽（像素）
   */
  #setScalingLineWidth(width: number) {
    this.#ctx.lineWidth = width;
  }

  /**
   * 隔离绘制函数，防止绘制影响到其他绘制。
   */
  #isolateWrapper(drawFunc: () => void) {
    this.#ctx.save();
    drawFunc();
    this.#ctx.restore();
  }
}
