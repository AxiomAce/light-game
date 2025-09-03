/**
 * @file 数据序列化/反序列化 (Pure Function)
 * 提供将图数据与字符串互相转换的纯函数：
 *  - serialize(graphState) -> string
 *  - deserialize(content) -> graphState
 */

import {
  GridType,
  createNode,
  createEdge,
  type Node,
  type Edge,
} from "../types/types";

import { type GraphSources } from "../store/graph";
import { Ok, Err, Result, fromThrowable } from "neverthrow";

export const graphSerializer = {
  /**
   * 将传入的图序列化为 JSON 字符串。
   * 格式: [gridType, nodeCount, ...nodes, ...edges]
   *   - gridType: 0 for Square, 1 for Triangular
   *   - node: [gridX, gridY, type, initialOn]
   *   - edge: [sourceIndex, targetIndex]
   * @param sources 图数据。
   * @returns 序列化后的 JSON 字符串。
   */
  serialize(sources: GraphSources): string {
    const { nodes, edges, grid } = sources;
    const gridTypeNum = grid as number;

    if (nodes.length === 0) {
      return JSON.stringify([gridTypeNum, 0]);
    }

    // 将节点平移到以其左上角为原点的位置
    const { minGridX, minGridY } = (() => {
      if (grid === GridType.SQUARE) {
        const x = Math.min(...nodes.map((n) => n.gridX));
        const y = Math.min(...nodes.map((n) => n.gridY));
        return { minGridX: x, minGridY: y };
      }
      if (grid === GridType.TRIANGULAR) {
        const x = Math.min(...nodes.map((n) => n.gridX));
        let y = Math.min(...nodes.map((n) => n.gridY));
        y -= y % 2; // 对齐到最近的偶数
        return { minGridX: x, minGridY: y };
      }
      return { minGridX: 0, minGridY: 0 };
    })();

    const translatedNodes: Node[] = nodes.map((n) => ({
      ...n,
      gridX: n.gridX - minGridX,
      gridY: n.gridY - minGridY,
    }));

    const nodeCount = translatedNodes.length;
    const result: (number | number[])[] = [gridTypeNum, nodeCount];

    const nodeIndexMap = new Map<string, number>(
      translatedNodes.map((n, i) => [n.id, i])
    );

    translatedNodes.forEach((n) => {
      const initialOnNum = n.initialOn ? 1 : 0;
      result.push([n.gridX, n.gridY, n.type as number, initialOnNum]);
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
   * 从 JSON 字符串反序列化并返回新的图对象（纯数据，不修改外部状态）。
   * @param content 序列化后的 JSON 字符串。
   * @returns 反序列化后的图数据，error 为 null 表示成功，否则表示失败。
   */
  deserialize(content: string): Result<GraphSources, string> {
    if (!content || !content.trim()) {
      return new Err("File is empty.");
    }

    const dataResult = fromThrowable(
      () => JSON.parse(content),
      (e) => e
    )();
    if (dataResult.isErr()) {
      return new Err("Invalid JSON format.");
    }
    const data = dataResult.value;

    if (!Array.isArray(data) || data.length < 2) {
      return new Err(
        "Invalid data format: expected an array with at least 2 elements."
      );
    }

    // data: [gridTypeNum, nodeCount, ...nodes, ...edges]
    const raw = data.slice();
    const gridTypeNum = raw.shift() as number;
    const nodeCount = raw.shift() as number;

    const layout = gridTypeNum as GridType;
    if (layout !== GridType.SQUARE && layout !== GridType.TRIANGULAR) {
      return new Err(`Invalid layout type: ${gridTypeNum}`);
    }

    const parsedNodes = raw.slice(0, nodeCount);
    const parsedEdges = raw.slice(nodeCount);

    if (parsedNodes.length !== nodeCount) {
      return new Err("Node count mismatch in data.");
    }

    const newNodes: Node[] = [];
    parsedNodes.forEach((nodeData: unknown) => {
      if (!Array.isArray(nodeData) || nodeData.length !== 4) {
        return new Err("Invalid node data format.");
      }
      const created = createNode(
        nodeData[0] as number, // gridX
        nodeData[1] as number, // gridY
        nodeData[2] as number, // type
        (nodeData[3] as number) === 1 // initialOn
      );
      newNodes.push(created);
    });

    const newEdges: Edge[] = [];
    parsedEdges.forEach((edgeData: unknown) => {
      if (!Array.isArray(edgeData) || edgeData.length !== 2) {
        return new Err("Invalid edge data format.");
      }
      const sourceNode = newNodes[edgeData[0] as number];
      const targetNode = newNodes[edgeData[1] as number];
      if (sourceNode && targetNode) {
        newEdges.push(createEdge(sourceNode.id, targetNode.id));
      }
    });

    return new Ok({ nodes: newNodes, edges: newEdges, grid: layout });
  },
};
