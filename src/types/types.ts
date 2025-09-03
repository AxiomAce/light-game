/**
 * 定义网格的类型枚举
 */
export enum GridType {
  SQUARE = 0,
  TRIANGULAR = 1,
}

/**
 * 节点的类型枚举。
 * - SQUARE_VERTEX: 正方形网格的顶点
 * - SQUARE_CENTER: 正方形网格的中心
 * - TRIANGLE_VERTEX: 三角形网格的顶点
 * - TRIANGLE_UP_CENTER: ▲ 三角形的中心（相对其顶点）
 * - TRIANGLE_DOWN_CENTER: ▼ 三角形的中心（相对其顶点）
 */
export enum NodeType {
  SQUARE_VERTEX = 0,
  SQUARE_CENTER = 1,
  TRIANGLE_VERTEX = 2,
  TRIANGLE_UP_CENTER = 3,
  TRIANGLE_DOWN_CENTER = 4,
}

/**
 * 定义应用模式的类型枚举
 */
export enum ModeType {
  EDIT = "edit",
  SOLVER = "solver",
}

export enum AlgorithmType {
  ANY = "any",
  MIN_WEIGHT = "min_weight",
}

/**
 * 代表图中的一个节点（灯）。
 */
export interface Node {
  id: string;
  gridX: number;
  gridY: number;
  type: NodeType;
  on: boolean;
  initialOn: boolean;
}

/**
 * 代表图中连接两个节点的一条边。
 */
export interface Edge {
  id: string;
  source: string;
  target: string;
}

export enum GraphElementType {
  NODE = "node",
  EDGE = "edge",
}

export type GraphElement =
  | { type: GraphElementType.NODE; element: Node }
  | { type: GraphElementType.EDGE; element: Edge };

// ===================================================================
// ========================   Factories   ============================
// ===================================================================

/**
 * 创建一个新的节点（等价于旧的 Node 构造函数）。
 */
export function createNode(
  gridX: number,
  gridY: number,
  type: NodeType,
  initialOn = false
): Node {
  return {
    id: `node_${crypto.randomUUID()}`,
    gridX,
    gridY,
    type,
    on: initialOn,
    initialOn,
  };
}

/**
 * 创建一条新的边（等价于旧的 Edge 构造函数）。
 */
export function createEdge(sourceId: string, targetId: string): Edge {
  return {
    id: `edge_${crypto.randomUUID()}`,
    source: sourceId,
    target: targetId,
  };
}

export function nodeToElement(node: Node): GraphElement {
  return { type: GraphElementType.NODE, element: node };
}

export function edgeToElement(edge: Edge): GraphElement {
  return { type: GraphElementType.EDGE, element: edge };
}
