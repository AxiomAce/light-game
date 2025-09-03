/**
 * @packageDocumentation
 * 求解器模块：负责管理与求解相关的状态与算法。
 */

import { createEnhancedStore } from "../util/createEnhancedStore";
import { graph } from "./graph";
import { AlgorithmType, type Node, type Edge } from "../types/types";
import { get } from "svelte/store";

const initialSources = {
  /** 使用的算法类型。*/
  algorithm: AlgorithmType.MIN_WEIGHT,
  /** 矩阵信息。*/
  matrixInfo: {
    /** 节点数。*/
    n: 0 as number,
    /** 零空间维数（自由度）。*/
    k: 0 as number,
  },
  /** 最近一次求解的结果。*/
  solution: {
    /** 是否存在解（null 表示正在计算）。*/
    hasSolution: null as boolean | null,
    /** 需要点击的节点 ID 列表。*/
    nodesToPress: [] as string[],
    /** 结果信息（用于 UI 展示）。*/
    message: "" as string,
  },
};

export const solver = createEnhancedStore({
  sources: initialSources,

  dependencies: [],

  deriveds: () => ({}),

  methods: ({ update, getStore }) => ({
    // ===================================================================
    // =========================   Mutators   ============================
    // ===================================================================

    /**
     * 计算并设置当前图对应的矩阵信息。
     * @returns 无返回值。
     */
    setMatrixInfo() {
      const { nodes, edges } = get(graph);
      const info = computeMatrixInfo(nodes, edges);
      update((s) => ({ ...s, matrixInfo: info }));
    },

    /**
     * 计算并设置当前图的求解结果（异步，先置为 "Solving..." 再更新）。
     * @returns 无返回值。
     */
    setSolution() {
      const { nodes, edges } = get(graph);
      const result = computeSolution(nodes, edges, getStore().algorithm);
      update((s) => ({ ...s, solution: result }));
    },

    /**
     * 设置求解算法。
     * @param algorithm 算法类型
     * @returns 无返回值。
     */
    setAlgorithm(algorithm: AlgorithmType) {
      update((s) => ({ ...s, algorithm }));
    },

    /**
     * 从当前解中移除一个节点（用于交互：点击已在解中的节点）。
     * @param nodeId 节点 ID。
     * @returns 无返回值。
     */
    removeNodeFromSolution(nodeId: string) {
      update((s) => ({
        ...s,
        solution: {
          ...s.solution,
          nodesToPress: s.solution.nodesToPress.filter((id) => id !== nodeId),
        },
      }));
    },
  }),
});
export default solver;

// ===================================================================
// ========================   Pure Solver   ==========================
// ===================================================================

/**
 * 计算图对应影响矩阵 A 的秩信息（GF(2) 上）。
 * @param nodes 节点列表（仅需 `id` 字段）。
 * @param edges 边列表（仅需 `source`/`target` 字段）。
 * @returns `{ n, k }`，其中 `n` 为节点数，`k` 为零空间维数（自由度）。
 */
function computeMatrixInfo(
  nodes: Array<Pick<Node, "id">>,
  edges: Array<Pick<Edge, "source" | "target">>
): { n: number; k: number } {
  const N = nodes.length;
  if (N === 0) return { n: 0, k: 0 };

  // 构建影响矩阵 A = I + Adj
  const A: number[][] = Array(N)
    .fill(0)
    .map(() => Array(N).fill(0));
  const nodeIndexMap = new Map(nodes.map((n, i) => [n.id, i] as const));
  for (let i = 0; i < N; i++) A[i][i] = 1;
  edges.forEach((edge) => {
    const u = nodeIndexMap.get(edge.source);
    const v = nodeIndexMap.get(edge.target);
    if (u !== undefined && v !== undefined) {
      A[u][v] = 1;
      A[v][u] = 1;
    }
  });

  // 高斯消元求秩
  let rank = 0;
  for (let j = 0; j < N && rank < N; j++) {
    let pivotRow = rank;
    while (pivotRow < N && A[pivotRow][j] === 0) {
      pivotRow++;
    }
    if (pivotRow < N) {
      [A[rank], A[pivotRow]] = [A[pivotRow], A[rank]];
      for (let i = rank + 1; i < N; i++) {
        if (A[i][j] === 1) {
          for (let k = j; k < N; k++) {
            A[i][k] ^= A[rank][k];
          }
        }
      }
      rank++;
    }
  }
  return { n: N, k: N - rank };
}

/**
 * 对当前图进行求解（GF(2) 上），返回一个可行解或点击次数最小的解。
 * @param nodes 节点列表（需 `id` 与 `on` 字段：`on` 为当前亮灭状态）。
 * @param edges 边列表（需 `source`/`target` 字段）。
 * @param algorithm 求解算法："any" 返回任意解；"min_weight" 返回点击次数最少的解。
 * @returns 计算结果：`hasSolution` 是否可解，`nodesToPress` 需要点击的节点 ID，`message` 说明信息。
 */
function computeSolution(
  nodes: Array<Pick<Node, "id" | "on">>,
  edges: Array<Pick<Edge, "source" | "target">>,
  algorithm: AlgorithmType
): { hasSolution: boolean; nodesToPress: string[]; message: string } {
  const N = nodes.length;

  if (N === 0) {
    return {
      hasSolution: false,
      nodesToPress: [],
      message: "No nodes to solve.",
    };
  }

  // 构建增广矩阵 M = [A|b]，A是影响矩阵，b是目标向量
  const nodeIds = nodes.map((n) => n.id);
  const nodeIndexMap = new Map(nodeIds.map((id, i) => [id, i] as const));
  const M: number[][] = Array(N)
    .fill(0)
    .map(() => Array(N + 1).fill(0));

  for (let i = 0; i < N; i++) {
    M[i][i] = 1;
    M[i][N] = nodes[i].on ? 0 : 1;
  }
  edges.forEach((edge) => {
    const u = nodeIndexMap.get(edge.source);
    const v = nodeIndexMap.get(edge.target);
    if (u !== undefined && v !== undefined) {
      M[u][v] = 1;
      M[v][u] = 1;
    }
  });

  // 高斯-若尔当消元，将矩阵化为行最简形
  let rank = 0;
  const pivotCols: number[] = [];
  for (let j = 0; j < N && rank < N; j++) {
    let pivotRow = rank;
    while (pivotRow < N && M[pivotRow][j] === 0) {
      pivotRow++;
    }
    if (pivotRow < N) {
      [M[rank], M[pivotRow]] = [M[pivotRow], M[rank]];
      for (let i = 0; i < N; i++) {
        if (i !== rank && M[i][j] === 1) {
          for (let k = j; k <= N; k++) {
            M[i][k] ^= M[rank][k];
          }
        }
      }
      pivotCols[rank] = j;
      rank++;
    }
  }

  // 检查解的存在性，如果 [0 ... 0 | 1] 存在，则无解
  if (M.slice(rank).some((row) => row[N] === 1)) {
    return {
      hasSolution: false,
      nodesToPress: [],
      message: "Failed: No solution exists.",
    };
  }

  // 回代求解一个特解 x_p
  const freeCols = Array.from({ length: N }, (_, j) =>
    pivotCols.includes(j) ? -1 : j
  ).filter((j) => j !== -1) as number[];
  const xp: number[] = Array(N).fill(0);
  for (let i = 0; i < rank; i++) xp[pivotCols[i]] = M[i][N];

  // 如果自由变量为0，则有唯一解
  if (freeCols.length === 0) {
    const nodesToPress = xp
      .map((val, i) => (val === 1 ? nodeIds[i] : null))
      .filter((v): v is string => Boolean(v));
    const message = "Success: Unique solution found.";
    return {
      hasSolution: true,
      nodesToPress,
      message,
    };
  }

  // 如果算法为any，则返回任意解
  if (algorithm === AlgorithmType.ANY) {
    const nodesToPress = xp
      .map((val, i) => (val === 1 ? nodeIds[i] : null))
      .filter((v): v is string => Boolean(v));
    const message = "Success: Arbitrary solution found.";
    return {
      hasSolution: true,
      nodesToPress,
      message,
    };
  }

  // 如果算法为min_weight，则返回点击次数最小的解
  // 计算零空间的一组基
  const nullSpaceBasis = freeCols.map((freeCol) => {
    const basisVector = Array(N).fill(0);
    basisVector[freeCol] = 1;
    for (let i = 0; i < rank; i++) {
      if (M[i][freeCol] === 1) basisVector[pivotCols[i]] = 1;
    }
    return basisVector as number[];
  });

  // 遍历 2^k 种组合，寻找权重最小（点击次数最少）的解
  let bestSolution = [...xp];
  let minWeight = bestSolution.reduce((a, b) => a + b, 0);
  for (let i = 1; i < 1 << freeCols.length; i++) {
    let currentSolution = [...xp];
    for (let j = 0; j < freeCols.length; j++) {
      if ((i >> j) & 1) {
        for (let l = 0; l < N; l++) currentSolution[l] ^= nullSpaceBasis[j][l];
      }
    }
    const currentWeight = currentSolution.reduce((a, b) => a + b, 0);
    if (currentWeight < minWeight) {
      minWeight = currentWeight;
      bestSolution = currentSolution;
    }
  }

  const nodesToPress = bestSolution
    .map((val, i) => (val === 1 ? nodeIds[i] : null))
    .filter((v): v is string => Boolean(v));
  return {
    hasSolution: true,
    nodesToPress,
    message: "Success: Min-Move solution found.",
  };
}
