/**
 * @file 数据序列化/反序列化
 * @description 负责将图数据转换为字符串（用于导出）以及从字符串恢复图数据（用于导入）。
 */

import graph, { GridType, graphState } from "./graph.js";

/**
 * @typedef {import('./graph.js').Node} Node
 * @typedef {import('./graph.js').Edge} Edge
 */

export const dataSerializer = {
    /**
     * 将当前图序列化为 JSON 字符串。
     * 格式: [gridType, nodeCount, ...nodes, ...edges]
     *   - gridType: 0 for Square, 1 for Triangular
     *   - node: [gridX, gridY, type, initialOn]
     *   - edge: [sourceIndex, targetIndex]
     * @returns {string} 序列化后的 JSON 字符串。
     */
    serialize() {
        const { nodes, edges } = graph.getGraph();
        const layout = graphState.grid;
        const gridTypeNum = layout;

        if (nodes.length === 0) {
            return JSON.stringify([gridTypeNum, 0]);
        }

        // 将节点平移到以其左上角为原点的位置
        const { minGridX, minGridY } = (() => {
            // 边界情况处理
            if (layout === GridType.SQUARE) {
                const x = Math.min(...nodes.map((n) => n.gridX));
                const y = Math.min(...nodes.map((n) => n.gridY));
                return { minGridX: x, minGridY: y };
            }
            if (layout === GridType.TRIANGULAR) {
                const x = Math.min(...nodes.map((n) => n.gridX));
                let y = Math.min(...nodes.map((n) => n.gridY));
                y -= y % 2; // 对齐到最近的偶数
                return { minGridX: x, minGridY: y };
            }
            return { minGridX: 0, minGridY: 0 };
        })();

        const translatedNodes = nodes.map((n) => ({
            ...n, // 复制所有原始属性
            gridX: n.gridX - minGridX,
            gridY: n.gridY - minGridY,
        }));

        const nodeCount = translatedNodes.length;
        const result = [gridTypeNum, nodeCount];

        const nodeIndexMap = new Map(translatedNodes.map((n, i) => [n.id, i]));

        translatedNodes.forEach((n) => {
            const initialOnNum = n.initialOn ? 1 : 0;
            result.push([n.gridX, n.gridY, n.type, initialOnNum]);
        });

        edges.forEach((e) => {
            const sourceIndex = nodeIndexMap.get(e.source);
            const targetIndex = nodeIndexMap.get(e.target);
            if (sourceIndex !== undefined && targetIndex !== undefined) {
                result.push([sourceIndex, targetIndex]);
            }
        });

        return JSON.stringify(result);
    },

    /**
     * 从 JSON 字符串反序列化并加载图。
     * @param {string} content - 从文件读取的 JSON 字符串内容。
     */
    deserialize(content) {
        if (!content || !content.trim()) {
            throw new Error("File is empty.");
        }

        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            throw new Error("Invalid JSON format.");
        }

        if (!Array.isArray(data) || data.length < 2) {
            throw new Error(
                "Invalid data format: expected an array with at least 2 elements."
            );
        }

        const gridTypeNum = data.shift();
        const nodeCount = data.shift();

        const layout = gridTypeNum;
        if (layout !== GridType.SQUARE && layout !== GridType.TRIANGULAR) {
            throw new Error(`Invalid layout type: ${gridTypeNum}`);
        }

        graph.clearGraph();
        graphState.grid = layout;

        const parsedNodes = data.slice(0, nodeCount);
        const parsedEdges = data.slice(nodeCount);

        if (parsedNodes.length !== nodeCount) {
            throw new Error("Node count mismatch in data.");
        }

        const newNodeIds = [];
        parsedNodes.forEach((nodeData) => {
            if (!Array.isArray(nodeData) || nodeData.length !== 4) {
                throw new Error("Invalid node data format.");
            }
            const newNode = graph.addNode(
                nodeData[0], // gridX
                nodeData[1], // gridY
                nodeData[2], // type
                nodeData[3] === 1 // initialOn
            );
            newNodeIds.push(newNode.id);
        });

        parsedEdges.forEach((edgeData) => {
            if (!Array.isArray(edgeData) || edgeData.length !== 2) {
                throw new Error("Invalid edge data format.");
            }
            const sourceId = newNodeIds[edgeData[0]];
            const targetId = newNodeIds[edgeData[1]];
            if (sourceId && targetId) {
                graph.addEdge(sourceId, targetId);
            }
        });
    },
};
