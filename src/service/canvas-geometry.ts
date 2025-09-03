/**
 * @file Canvas绘图辅助与几何工具 (Pure Function)
 */

import { GRID_SPACING } from "../store/canvas";
import { GridType, NodeType } from "../types/types";

// ===================================================================
// =======================   Selection util   ========================
// ===================================================================

// NOTE: 本区域在 WorldPos 坐标系下进行计算

/**
 * 检查一个圆形节点是否与一个矩形相交。
 * @param center 圆心坐标。
 * @param r 圆的半径。
 * @param rect 矩形选框。
 * @returns 如果相交则返回 true。
 */
export function nodeCircleIntersectsRect(
  center: { x: number; y: number },
  r: number,
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const { x: cx, y: cy } = center;
  const { x1, y1, x2, y2 } = rect;
  const testX = Math.max(x1, Math.min(cx, x2));
  const testY = Math.max(y1, Math.min(cy, y2));
  const distX = cx - testX;
  const distY = cy - testY;
  const distanceSq = distX * distX + distY * distY;
  return distanceSq <= r * r;
}

/**
 * 检查一条边（线段）是否与一个矩形相交, 包含容差。
 * @param pos1 线段的起点坐标。
 * @param pos2 线段的终点坐标。
 * @param toleranceSq 容差平方。
 * @param rect 矩形选框。
 * @returns 如果相交则返回 true。
 */
export function edgeIntersectsRect(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  toleranceSq: number,
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  // 1. 首先检查是否存在直接的几何相交，这能处理选框穿过边的情况。
  if (edgeIntersectsRectGeometrically(pos1, pos2, rect)) {
    return true;
  }

  // 2. 如果不相交，再检查它们之间的距离是否在容差范围内。
  //    这能处理选框与边“擦肩而过”的情况。
  const p1 = { x: pos1.x, y: pos1.y };
  const p2 = { x: pos2.x, y: pos2.y };

  // 检查从线段端点到矩形的距离
  if (pointToRectDistSq(p1, rect) < toleranceSq) {
    return true;
  }
  if (pointToRectDistSq(p2, rect) < toleranceSq) {
    return true;
  }

  // 检查从矩形顶点到线段的距离
  const corners = [
    { x: rect.x1, y: rect.y1 },
    { x: rect.x2, y: rect.y1 },
    { x: rect.x2, y: rect.y2 },
    { x: rect.x1, y: rect.y2 },
  ];
  for (const corner of corners) {
    if (pointToSegmentDistSq(corner, p1, p2) < toleranceSq) {
      return true;
    }
  }

  return false;
}

/**
 * 检查一条边（线段）是否与一个矩形几何相交（无容差）。
 * @param pos1 线段的起点坐标。
 * @param pos2 线段的终点坐标。
 * @param rect 矩形选框。
 * @returns 如果相交则返回 true。
 */
function edgeIntersectsRectGeometrically(
  pos1: { x: number; y: number },
  pos2: { x: number; y: number },
  rect: { x1: number; y1: number; x2: number; y2: number }
): boolean {
  const p1 = { x: pos1.x, y: pos1.y };
  const p2 = { x: pos2.x, y: pos2.y };
  const { x1, y1, x2, y2 } = rect;

  // 检查是否有任一端点在矩形内部
  if (
    (p1.x >= x1 && p1.x <= x2 && p1.y >= y1 && p1.y <= y2) ||
    (p2.x >= x1 && p2.x <= x2 && p2.y >= y1 && p2.y <= y2)
  ) {
    return true;
  }

  // 检查线段是否与矩形的任一边相交
  const rectSides: Array<[{ x: number; y: number }, { x: number; y: number }]> =
    [
      [
        { x: x1, y: y1 },
        { x: x2, y: y1 },
      ],
      [
        { x: x2, y: y1 },
        { x: x2, y: y2 },
      ],
      [
        { x: x1, y: y2 },
        { x: x2, y: y2 },
      ],
      [
        { x: x1, y: y1 },
        { x: x1, y: y2 },
      ],
    ];

  for (const side of rectSides) {
    if (lineSegmentIntersectsLineSegment(p1, p2, side[0], side[1])) {
      return true;
    }
  }
  return false;
}

/**
 * 检查两个线段是否相交。
 * @param p1 第一个线段的起点。
 * @param p2 第一个线段的终点。
 * @param p3 第二个线段的起点。
 * @param p4 第二个线段的终点。
 * @returns 是否相交。
 */
function lineSegmentIntersectsLineSegment(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  const { x: x1, y: y1 } = p1;
  const { x: x2, y: y2 } = p2;
  const { x: x3, y: y3 } = p3;
  const { x: x4, y: y4 } = p4;

  const den = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (den === 0) return false;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / den;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / den;

  return t > 0 && t < 1 && u > 0 && u < 1;
}

/**
 * 计算点到矩形的最近距离的平方。
 * @param p 点。
 * @param rect 矩形。
 * @returns 距离的平方。
 */
function pointToRectDistSq(
  p: { x: number; y: number },
  rect: { x1: number; y1: number; x2: number; y2: number }
): number {
  const dx = Math.max(rect.x1 - p.x, 0, p.x - rect.x2);
  const dy = Math.max(rect.y1 - p.y, 0, p.y - rect.y2);
  return dx * dx + dy * dy;
}

/**
 * 计算点到线段的最近距离的平方。
 * @param p 点。
 * @param a 线段的起点。
 * @param b 线段的终点。
 * @returns 距离的平方。
 */
export function pointToSegmentDistSq(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return (p.x - a.x) ** 2 + (p.y - a.y) ** 2;
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const closestX = a.x + t * dx;
  const closestY = a.y + t * dy;
  return (p.x - closestX) ** 2 + (p.y - closestY) ** 2;
}

// ===================================================================
// ========================   Position util   ========================
// ===================================================================

// NOTE: 本区域区分 WorldPos 和 ClientPos

/**
 * 将抽象网格坐标转换为像素坐标。
 * @param gridPos 抽象坐标。
 * @returns 像素坐标。
 */
export function gridPos2WorldPos(gridPos: {
  gridX: number;
  gridY: number;
  type: NodeType;
}): { x: number; y: number } {
  const S = GRID_SPACING;
  const { gridX, gridY, type } = gridPos;

  // 正方形网格
  if (type === NodeType.SQUARE_VERTEX || type === NodeType.SQUARE_CENTER) {
    if (type === NodeType.SQUARE_VERTEX) {
      return { x: gridX * S, y: gridY * S };
    }
    if (type === NodeType.SQUARE_CENTER) {
      return { x: (gridX + 0.5) * S, y: (gridY + 0.5) * S };
    }
  }

  // 三角形网格
  if (
    type === NodeType.TRIANGLE_VERTEX ||
    type === NodeType.TRIANGLE_UP_CENTER ||
    type === NodeType.TRIANGLE_DOWN_CENTER
  ) {
    const h = (S * Math.sqrt(3)) / 2;

    if (type === NodeType.TRIANGLE_VERTEX) {
      const staggerOffset = (gridY % 2) * (S / 2);
      return { x: gridX * S + staggerOffset, y: gridY * h };
    }
    const staggerOffset = (gridY % 2) * (S / 2);
    const vertexX = gridX * S + staggerOffset;
    const vertexY = gridY * h;

    if (type === NodeType.TRIANGLE_UP_CENTER) {
      return { x: vertexX, y: vertexY - (2 * h) / 3 };
    }
    if (type === NodeType.TRIANGLE_DOWN_CENTER) {
      return { x: vertexX, y: vertexY + (2 * h) / 3 };
    }
  }
  return { x: 0, y: 0 };
}

/**
 * 将像素坐标吸附到最近的网格点，返回抽象网格坐标。
 * @param worldPos 原始坐标。
 * @param grid 当前的网格类型。
 * @returns 吸附后的抽象坐标。
 */
export function worldPos2GridPos(
  worldPos: { x: number; y: number },
  grid: GridType
): { gridX: number; gridY: number; type: NodeType } | null {
  const S = GRID_SPACING;
  const { x, y } = worldPos;

  if (grid === GridType.SQUARE) {
    const candidates = [
      {
        gridX: Math.round(x / S),
        gridY: Math.round(y / S),
        type: NodeType.SQUARE_VERTEX as const,
      },
      {
        gridX: Math.floor(x / S),
        gridY: Math.floor(y / S),
        type: NodeType.SQUARE_CENTER as const,
      },
    ];

    return candidates
      .map((p) => ({
        point: p,
        distSq:
          (x - gridPos2WorldPos(p).x) ** 2 + (y - gridPos2WorldPos(p).y) ** 2,
      }))
      .reduce((closest, p) => (p.distSq < closest.distSq ? p : closest)).point;
  }

  if (grid === GridType.TRIANGULAR) {
    const h = (S * Math.sqrt(3)) / 2;
    const candidates: Array<{ gridX: number; gridY: number; type: NodeType }> =
      [];

    const gridY_est_vert = Math.round(y / h);
    for (let gridY_offset = -1; gridY_offset <= 1; gridY_offset++) {
      const gridY = gridY_est_vert + gridY_offset;
      const staggerOffset = (gridY % 2) * (S / 2);
      const gridX_est = Math.round((x - staggerOffset) / S);
      for (let gridX_offset = -1; gridX_offset <= 1; gridX_offset++) {
        const gridX = gridX_est + gridX_offset;
        candidates.push({
          gridX: gridX,
          gridY: gridY,
          type: NodeType.TRIANGLE_VERTEX,
        });
      }
    }

    const gridY_est_up = Math.round((y + (2 * h) / 3) / h);
    for (let gridY_offset = -1; gridY_offset <= 1; gridY_offset++) {
      const gridY = gridY_est_up + gridY_offset;
      const staggerOffset = (gridY % 2) * (S / 2);
      const gridX_est = Math.round((x - staggerOffset) / S);
      for (let gridX_offset = -1; gridX_offset <= 1; gridX_offset++) {
        const gridX = gridX_est + gridX_offset;
        candidates.push({
          gridX: gridX,
          gridY: gridY,
          type: NodeType.TRIANGLE_UP_CENTER,
        });
      }
    }

    const gridY_est_down = Math.round((y - (2 * h) / 3) / h);
    for (let gridY_offset = -1; gridY_offset <= 1; gridY_offset++) {
      const gridY = gridY_est_down + gridY_offset;
      const staggerOffset = (gridY % 2) * (S / 2);
      const gridX_est = Math.round((x - staggerOffset) / S);
      for (let gridX_offset = -1; gridX_offset <= 1; gridX_offset++) {
        const gridX = gridX_est + gridX_offset;
        candidates.push({
          gridX: gridX,
          gridY: gridY,
          type: NodeType.TRIANGLE_DOWN_CENTER,
        });
      }
    }

    return candidates
      .map((p) => ({
        point: p,
        distSq:
          (worldPos.x - gridPos2WorldPos(p).x) ** 2 +
          (worldPos.y - gridPos2WorldPos(p).y) ** 2,
      }))
      .reduce((closest, p) => (p.distSq < closest.distSq ? p : closest)).point;
  }
  return null;
}

/**
 * 将客户端坐标转换为世界坐标。
 * @param clientPos 客户端坐标。
 * @param canvasClientRect 画布矩形。
 * @param viewClientOffset 视图偏移。
 * @param zoomRatio 缩放比例。
 * @returns 世界坐标。
 */
export function clientPos2WorldPos(
  clientPos: { x: number; y: number },
  canvasClientRect: { x: number; y: number; width: number; height: number },
  viewClientOffset: { x: number; y: number },
  zoomRatio: number
): {
  x: number;
  y: number;
} {
  const worldX =
    (clientPos.x - canvasClientRect.x - viewClientOffset.x) / zoomRatio;
  const worldY =
    (clientPos.y - canvasClientRect.y - viewClientOffset.y) / zoomRatio;
  return { x: worldX, y: worldY };
}
