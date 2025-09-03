/**
 * @packageDocumentation
 * 图数据模型：管理应用的核心数据（图结构）并提供操作 API。
 */

import { createEnhancedStore } from "../util/createEnhancedStore";
import {
  GridType,
  NodeType,
  GraphElementType,
  createNode,
  createEdge,
  type Node,
  type Edge,
  type GraphElement,
  nodeToElement,
  edgeToElement,
} from "../types/types";

const initialSources = {
  /** 节点列表。*/
  nodes: [] as Node[],
  /** 边列表。*/
  edges: [] as Edge[],
  /** 网格类型。*/
  grid: GridType.SQUARE as GridType,
};

export type GraphSources = typeof initialSources;

export const graph = createEnhancedStore({
  sources: initialSources,

  dependencies: [],

  deriveds: ($s) => ({
    /** 图是否为空。*/
    isEmpty: $s.nodes.length === 0 && $s.edges.length === 0,
  }),

  methods: ({ update, getStore }) => ({
    // ===================================================================
    // =========================   Getters   =============================
    // ===================================================================

    /**
     * 根据 ID 查找节点对象。
     * @param id 节点 ID。
     * @returns 找到的节点对象；若不存在返回 undefined。
     */
    getNodeById(id: string): Node | undefined {
      const $s = getStore();
      return $s.nodes.find((n) => n.id === id);
    },

    /**
     * 根据源节点 ID 和目标节点 ID 查找边对象。
     * @param fromId 源节点 ID。
     * @param toId 目标节点 ID。
     * @returns 找到的边对象；若不存在返回 undefined。
     */
    getEdgeBySourceAndTargetIds(
      fromId: string,
      toId: string
    ): Edge | undefined {
      const $s = getStore();
      return fromId !== toId
        ? $s.edges.find(
            (e) =>
              (e.source === fromId && e.target === toId) ||
              (e.source === toId && e.target === fromId)
          )
        : undefined;
    },

    /**
     * 根据一组元素 ID 获取其对应的节点与边。
     * @param elementIds 目标元素 ID 的集合。
     * @returns 由匹配的节点与边组成的对象。
     */
    getElementsByIds(elementIds: Set<string>): GraphElement[] {
      const $s = getStore();
      return [
        ...$s.nodes.filter((n) => elementIds.has(n.id)).map(nodeToElement),
        ...$s.edges.filter((e) => elementIds.has(e.id)).map(edgeToElement),
      ];
    },

    /**
     * 检查指定抽象坐标处是否存在某类型的节点。
     * @param gridPos 要检查的抽象网格坐标与节点类型。
     * @returns 是否存在该节点。
     */
    hasNodeAtGridPos(gridPos: {
      gridX: number;
      gridY: number;
      type: NodeType;
    }): boolean {
      const $s = getStore();
      return $s.nodes.some(
        (n) =>
          n.gridX === gridPos.gridX &&
          n.gridY === gridPos.gridY &&
          n.type === gridPos.type
      );
    },

    // ===================================================================
    // =========================   Mutators   ============================
    // ===================================================================

    /**
     * 设置网格类型。
     * @param grid 网格类型。
     */
    setGrid(grid: GridType) {
      update((s) => ({ ...s, grid: grid }));
    },

    /**
     * 向图中添加一个新节点。
     * @param gridX 节点的抽象网格 x 坐标。
     * @param gridY 节点的抽象网格 y 坐标。
     * @param type 节点类型。
     * @param initialOn 节点的初始亮灭状态，默认 false。
     * @returns 新创建的节点对象。
     */
    addNode(
      gridX: number,
      gridY: number,
      type: NodeType,
      initialOn: boolean = false
    ): Node | undefined {
      if (this.hasNodeAtGridPos({ gridX, gridY, type })) {
        return undefined;
      }
      const newNode = createNode(gridX, gridY, type, initialOn);
      update((s) => ({ ...s, nodes: [...s.nodes, newNode] }));
      return newNode;
    },

    /**
     * 向图中添加一条新边。
     * 若源与目标相同或边已存在，则返回 undefined。
     * @param sourceId 源节点 ID。
     * @param targetId 目标节点 ID。
     * @returns 新创建的边对象；若未创建返回 undefined。
     */
    addEdge(sourceId: string, targetId: string): Edge | undefined {
      const $s = getStore();
      if (
        sourceId === targetId ||
        $s.edges.some(
          (e) =>
            (e.source === sourceId && e.target === targetId) ||
            (e.source === targetId && e.target === sourceId)
        )
      ) {
        return undefined;
      }
      const newEdge = createEdge(sourceId, targetId);
      update((state) => ({
        ...state,
        edges: [...state.edges, newEdge],
      }));
      return newEdge;
    },

    /**
     * 根据 ID 删除一组元素（包含节点及与之相连的边）。
     * @param selectedIds 待删除元素的 ID 集合。
     */
    deleteElementsByIds(selectedIds: Set<string>) {
      update((s) => {
        const nodes = s.nodes.filter((n) => !selectedIds.has(n.id));
        const edges = s.edges.filter(
          (e) =>
            !selectedIds.has(e.id) &&
            !selectedIds.has(e.source) &&
            !selectedIds.has(e.target)
        );
        return { ...s, nodes, edges };
      });
    },

    /**
     * 恢复之前删除的元素（用于撤销操作）。
     * @param elements 要恢复的节点与边。
     */
    restoreElements(elements: GraphElement[]) {
      update((s) => ({
        ...s,
        nodes: [
          ...s.nodes,
          ...elements
            .filter((e) => e.type === GraphElementType.NODE)
            .map((e) => e.element),
        ],
        edges: [
          ...s.edges,
          ...elements
            .filter((e) => e.type === GraphElementType.EDGE)
            .map((e) => e.element),
        ],
      }));
    },

    /**
     * 用新的图数据整体替换当前图（用于导入）。
     * @param newState 新的图数据（grid, nodes, edges）。
     */
    load(newState: GraphSources) {
      update((_) => ({
        nodes: newState.nodes,
        edges: newState.edges,
        grid: newState.grid,
      }));
    },

    /**
     * 清空整个图（移除所有节点与边）。
     * @returns 无返回值。
     */
    clear() {
      update((s) => ({ ...s, nodes: [], edges: [] }));
    },

    /**
     * 切换节点的初始亮灭状态。
     * @param nodeId 目标节点 ID。
     * @returns 无返回值。
     */
    toggleNodeInitialOnById(nodeId: string) {
      update((s) => ({
        ...s,
        nodes: s.nodes.map((node) =>
          node.id === nodeId ? { ...node, initialOn: !node.initialOn } : node
        ),
      }));
    },

    /**
     * 设置节点的初始亮灭状态。
     * @param nodeId 节点 ID。
     * @param value 目标初始状态。
     * @returns 无返回值。
     */
    setNodeInitialOnById(nodeId: string, value: boolean) {
      update((s) => ({
        ...s,
        nodes: s.nodes.map((node) =>
          node.id === nodeId ? { ...node, initialOn: value } : node
        ),
      }));
    },

    /**
     * 批量设置一组节点的初始亮灭状态（常用于命令/历史操作）。
     * @param updates 要更新的节点及其目标初始状态列表。
     * @returns 无返回值。
     */
    setNodesInitialOnByIds(updates: Array<Pick<Node, "id" | "initialOn">>) {
      const map = new Map(updates.map((u) => [u.id, u.initialOn]));
      update((s) => ({
        ...s,
        nodes: s.nodes.map((node) =>
          map.has(node.id) ? { ...node, initialOn: map.get(node.id)! } : node
        ),
      }));
    },

    /**
     * 切换指定节点及其所有直接邻居的游戏状态。
     * @param nodeId 被点击的节点 ID。
     * @returns 无返回值。
     */
    toggleNodeAndNeighborsOnById(nodeId: string) {
      update((s) => {
        const toggled = new Set<string>([nodeId]);
        s.edges.forEach((edge) => {
          if (edge.source === nodeId) toggled.add(edge.target);
          if (edge.target === nodeId) toggled.add(edge.source);
        });
        const nodes = s.nodes.map((node) =>
          toggled.has(node.id) ? { ...node, on: !node.on } : node
        );
        return { ...s, nodes };
      });
    },

    /**
     * 将所有节点的游戏状态重置为其在编辑模式下设定的初始状态。
     * @returns 无返回值。
     */
    resetNodesOnToInitialOn() {
      update((s) => ({
        ...s,
        nodes: s.nodes.map((node) => ({ ...node, on: node.initialOn })),
      }));
    },
  }),
});
