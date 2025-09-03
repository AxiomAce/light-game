/**
 * @file Canvas 上绘制 Graph 元素的定位工具 (Non-Pure Function)
 * NOTE: 本文件在 WorldPos 坐标系下进行计算
 */

import { get } from "svelte/store";
import {
  NODE_RADIUS,
  WIDTH_EDGE_HIGHLIGHT,
  WIDTH_NODE_HIGHLIGHT_PADDING,
} from "../store/canvas";
import { graph } from "../store/graph";
import {
  edgeToElement,
  nodeToElement,
  type GraphElement,
} from "../types/types";
import {
  edgeIntersectsRect,
  gridPos2WorldPos,
  nodeCircleIntersectsRect,
  pointToSegmentDistSq,
  worldPos2GridPos,
} from "./canvas-geometry";

/**
 * 获取指定坐标位置的元素（节点或边）。
 * @param pos 画布坐标。
 * @returns 命中的元素（节点/边）或 null。
 */
export function getElementAtPos(pos: {
  x: number;
  y: number;
}): GraphElement | null {
  const { nodes, edges } = get(graph);
  // 节点优先
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    const nodePos = gridPos2WorldPos(node);
    const dist = Math.sqrt((pos.x - nodePos.x) ** 2 + (pos.y - nodePos.y) ** 2);
    if (dist <= NODE_RADIUS + WIDTH_NODE_HIGHLIGHT_PADDING)
      return nodeToElement(node);
  }
  // 再检查边
  for (let i = edges.length - 1; i >= 0; i--) {
    const edge = edges[i];
    const fromNode = graph.getNodeById(edge.source);
    const toNode = graph.getNodeById(edge.target);
    if (!fromNode || !toNode) continue;
    const fromPos = gridPos2WorldPos(fromNode);
    const toPos = gridPos2WorldPos(toNode);
    const distSq = pointToSegmentDistSq(pos, fromPos, toPos);
    const toleranceSq = (WIDTH_EDGE_HIGHLIGHT / 2) ** 2;
    if (distSq < toleranceSq) return edgeToElement(edge);
  }
  return null;
}

/**
 * 获取指定矩形框内的所有元素。
 * @param rect 选框矩形。
 * @returns 在矩形内的元素列表。
 */
export function getElementsInBox(rect: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}): Array<GraphElement> {
  const elements: Array<GraphElement> = [];
  const { nodes, edges } = get(graph);

  nodes.forEach((node) => {
    const nodePos = gridPos2WorldPos(node);
    if (
      nodeCircleIntersectsRect(
        nodePos,
        NODE_RADIUS + WIDTH_NODE_HIGHLIGHT_PADDING,
        rect
      )
    ) {
      elements.push(nodeToElement(node));
    }
  });

  edges.forEach((edge) => {
    const fromNode = graph.getNodeById(edge.source);
    const toNode = graph.getNodeById(edge.target);
    if (!fromNode || !toNode) return;
    const fromPos = gridPos2WorldPos(fromNode);
    const toPos = gridPos2WorldPos(toNode);
    const toleranceSq = (WIDTH_EDGE_HIGHLIGHT / 2) ** 2;
    if (edgeIntersectsRect(fromPos, toPos, toleranceSq, rect)) {
      if (!elements.find((el) => el.element.id === edge.id)) {
        elements.push(edgeToElement(edge));
      }
    }
  });

  return elements;
}

/**
 * 计算“幽灵节点”的吸附位置。
 * @param pos 鼠标当前坐标。
 * @returns 吸附点抽象坐标，或 null。
 */
export function calculateGhostNodePos(pos: {
  x: number;
  y: number;
}): { gridX: number; gridY: number; type: number } | null {
  const snappedGridPos = worldPos2GridPos(pos, get(graph).grid);
  if (!snappedGridPos) return null;

  const snappedPixelPos = gridPos2WorldPos(snappedGridPos);
  const dist = Math.sqrt(
    (pos.x - snappedPixelPos.x) ** 2 + (pos.y - snappedPixelPos.y) ** 2
  );
  const nodeExists = graph.hasNodeAtGridPos(snappedGridPos);
  return dist <= NODE_RADIUS + WIDTH_NODE_HIGHLIGHT_PADDING && !nodeExists
    ? snappedGridPos
    : null;
}

/**
 * 计算并返回图中所有节点的像素坐标边界。
 * @returns 像素坐标边界或 null。
 */
export function getGraphWorldPosBounds(): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} | null {
  const { nodes } = get(graph);
  if (nodes.length === 0) return null;

  const bounds = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };

  nodes.forEach((node) => {
    const pos = gridPos2WorldPos(node);
    bounds.minX = Math.min(bounds.minX, pos.x);
    bounds.maxX = Math.max(bounds.maxX, pos.x);
    bounds.minY = Math.min(bounds.minY, pos.y);
    bounds.maxY = Math.max(bounds.maxY, pos.y);
  });

  return bounds;
}
