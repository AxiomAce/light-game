import { createEnhancedStore } from "../util/createEnhancedStore";
import type { Node, Edge } from "../types/types";
import { history } from "../store/history";

export const graph = createEnhancedStore({
  sources: {
    /** 节点列表。*/
    nodes: [] as Node[],
    /** 边列表。*/
    edges: [] as Edge[],
  },

  dependencies: [history],

  deriveds: ($s, [$history]) => ({
    /** 图是否为空。*/
    isEmpty: $s.nodes.length === 0 && $s.edges.length === 0,
    /** 节点数量。*/
    nodeCount: $s.nodes.length,
  }),

  methods: ({ update, getStore }) => ({
    /**
     * 根据 ID 查找节点对象。
     * @param id 节点 ID。
     * @returns 找到的节点对象；若不存在返回 undefined。
     */
    findNodeById(id: string): Node | undefined {
      const s = getStore();
      return s.nodes.find((n) => n.id === id);
    },

    /**
     * 切换指定节点的初始亮灭状态。
     * @param nodeId - 目标节点 ID。
     */
    toggleNodeInitialOn(nodeId: string) {
      // (这里的 update 和 s(state) 也是类型正确的)
      update((s) => ({
        ...s,
        nodes: s.nodes.map((node) =>
          node.id === nodeId ? { ...node, initialOn: !node.initialOn } : node
        ),
      }));
    },
  }),
});
