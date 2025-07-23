/**
 * @file 图数据模型
 * @description 负责管理应用的核心数据（图结构）并提供操作API。
 */

/**
 * @class Node
 * @description 代表图中的一个节点（灯）。
 */
export class Node {
    /** @type {string} 节点的唯一标识符。 */
    id;
    /** @type {number} 节点在画布上的x坐标。 */
    x;
    /** @type {number} 节点在画布上的y坐标。 */
    y;
    /** @type {boolean} 节点当前的游戏状态 (true: 亮, false: 灭)。 */
    on;
    /** @type {boolean} 节点在编辑模式下设定的初始状态 (true: 亮, false: 灭)。 */
    initialOn;

    /**
     * @param {number} x - 节点的x坐标。
     * @param {number} y - 节点的y坐标。
     * @param {boolean} [initialOn=false] - 节点的初始状态。
     */
    constructor(x, y, initialOn = false) {
        this.id = `node_${Date.now()}_${Math.random()}`;
        this.x = x;
        this.y = y;
        this.on = initialOn;
        this.initialOn = initialOn;
    }

    /**
     * 切换节点的初始状态（亮/灭）。
     */
    toggleInitialState() {
        this.initialOn = !this.initialOn;
    }

    /**
     * 切换节点当前的游戏状态（亮/灭）。
     */
    toggleNodeOnState() {
        this.on = !this.on;
    }
}

/**
 * @class Edge
 * @description 代表图中连接两个节点的一条边。
 */
export class Edge {
    /** @type {string} 边的唯一标识符。 */
    id;
    /** @type {string} 边的源节点的ID。 */
    source;
    /** @type {string} 边的目标节点的ID。 */
    target;

    /**
     * @param {string} sourceId - 源节点ID。
     * @param {string} targetId - 目标节点ID。
     */
    constructor(sourceId, targetId) {
        this.id = "edge_" + Date.now() + Math.random();
        this.source = sourceId;
        this.target = targetId;
    }
}

/**
 * @class Graph
 * @description 图数据模型，管理图的节点和边。
 */
class Graph {
    /** @type {Node[]} 存储所有Node对象的私有数组。 */
    #nodes;
    /** @type {Edge[]} 存储所有Edge对象的私有数组。 */
    #edges;

    constructor() {
        this.#nodes = [];
        this.#edges = [];
    }

    /**
     * 返回当前图数据的只读副本。
     * @returns {{nodes: Node[], edges: Edge[]}}
     */
    getGraph() {
        return {
            nodes: this.#nodes,
            edges: this.#edges,
        };
    }

    /**
     * 根据ID查找节点对象。
     * @param {string} id - 节点ID。
     * @returns {Node | undefined} 找到的节点对象或undefined。
     */
    findNodeById(id) {
        return this.#nodes.find((n) => n.id === id);
    }

    /**
     * 根据ID获取一组元素的完整数据。
     * @param {Set<string>} elementIds - 包含元素ID的Set。
     * @returns {{nodes: Node[], edges: Edge[]}}
     */
    getElementsByIds(elementIds) {
        const nodes = this.#nodes.filter((n) => elementIds.has(n.id));
        const edges = this.#edges.filter((e) => elementIds.has(e.id));
        return { nodes, edges };
    }

    /**
     * 检查指定坐标处是否存在节点。
     * @param {{x: number, y: number}} pos - 要检查的坐标。
     * @returns {boolean}
     */
    hasNodeAt(pos) {
        return this.#nodes.some((n) => n.x === pos.x && n.y === pos.y);
    }

    /**
     * 向图中添加一个新节点。
     * @param {number} x - 节点的x坐标。
     * @param {number} y - 节点的y坐标。
     * @param {boolean} [initialOn=false] - 节点的初始状态。
     * @returns {Node} 新创建的节点对象。
     */
    addNode(x, y, initialOn = false) {
        const newNode = new Node(x, y, initialOn);
        this.#nodes.push(newNode);
        return newNode;
    }

    /**
     * 向图中添加一条新边。
     * @param {string} sourceId - 源节点ID。
     * @param {string} targetId - 目标节点ID。
     * @returns {Edge | null} 新创建的边对象或null。
     */
    addEdge(sourceId, targetId) {
        if (
            sourceId === targetId ||
            this.#edges.some(
                (e) =>
                    (e.source === sourceId && e.target === targetId) ||
                    (e.source === targetId && e.target === sourceId)
            )
        ) {
            return null;
        }
        const newEdge = new Edge(sourceId, targetId);
        this.#edges.push(newEdge);
        return newEdge;
    }

    /**
     * 根据ID删除一组元素（节点和相关的边）。
     * @param {Set<string>} selectedIds - 包含要删除元素ID的Set。
     */
    deleteElements(selectedIds) {
        this.#nodes = this.#nodes.filter((n) => !selectedIds.has(n.id));
        this.#edges = this.#edges.filter(
            (e) =>
                !selectedIds.has(e.id) &&
                !selectedIds.has(e.source) &&
                !selectedIds.has(e.target)
        );
    }

    /**
     * 恢复之前删除的元素。用于撤销操作。
     * @param {{nodes: Node[], edges: Edge[]}} elements - 要恢复的元素对象。
     */
    restoreElements(elements) {
        this.#nodes.push(...elements.nodes);
        this.#edges.push(...elements.edges);
    }

    /**
     * 清空整个图。
     */
    clearGraph() {
        this.#nodes = [];
        this.#edges = [];
    }

    /**
     * 切换节点的初始状态（亮/灭）。
     * @param {string} nodeId - 要切换状态的节点ID。
     */
    toggleInitialState(nodeId) {
        const node = this.findNodeById(nodeId);
        if (node) {
            node.toggleInitialState();
        }
    }

    /**
     * 切换节点当前的游戏状态（亮/灭）。
     * @param {string} nodeId - 要切换状态的节点ID。
     */
    toggleNodeOnState(nodeId) {
        const node = this.findNodeById(nodeId);
        if (node) {
            node.toggleNodeOnState();
        }
    }

    /**
     * 切换指定节点及其所有直接邻居的游戏状态。
     * @param {string} nodeId - 被点击的节点ID。
     */
    toggleNodeAndNeighbors(nodeId) {
        this.toggleNodeOnState(nodeId);
        this.#edges.forEach((edge) => {
            let neighborNodeId = null;
            if (edge.source === nodeId) neighborNodeId = edge.target;
            if (edge.target === nodeId) neighborNodeId = edge.source;
            if (neighborNodeId) {
                this.toggleNodeOnState(neighborNodeId);
            }
        });
    }

    /**
     * 将所有节点的游戏状态重置为其在编辑模式下设定的初始状态。
     */
    resetToInitialState() {
        this.#nodes.forEach((node) => {
            node.on = node.initialOn;
        });
    }
}

const graph = new Graph();
export default graph;
