/**
 * @file 求解器模块
 * @description 负责管理求解相关的状态和算法。
 */

import consoleView from "../view/console.js";
import inspectorView from "../view/inspector.js";
import graph from "./graph.js";

// ===================================================================
// ======================   Solver States   ==========================
// ===================================================================

const state = {
    algorithm: "min_weight", // 'any' 或 'min_weight'
    matrixInfo: { n: 0, k: 0 },
    solution: {
        hasSolution: null,
        nodesToPress: [],
        message: "",
    },
};

/*
 * 通过Proxy实现求解器状态的响应式更新
 * 当求解器状态发生变化时，自动更新控制台和查看器
 */
const handler = {
    get(target, property, receiver) {
        const value = Reflect.get(target, property, receiver);
        if (typeof value === "object" && value !== null) {
            return new Proxy(value, handler);
        }
        return value;
    },
    set(target, property, value, receiver) {
        const success = Reflect.set(target, property, value, receiver);
        if (success) {
            // 当状态变化时，自动更新UI
            consoleView.update();
            inspectorView.update();
        }
        return success;
    },
};

export const solverState = new Proxy(state, handler);

// ===================================================================
// ========================   Test util   ============================
// ===================================================================

/**
 * [测试用] 阻塞执行指定时间
 * @param {number} ms - 毫秒数
 */
function timeSleep(ms) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        // This is a blocking loop for testing purposes.
        // It will freeze the UI.
    }
}

// ===================================================================
// =========================   Solver   ==============================
// ===================================================================

class Solver {
    /**
     * 设置矩阵信息。
     */
    setMatrixInfo() {
        solverState.matrixInfo = this.#getMatrixInfo();
    }

    /**
     * 求解当前图。
     */
    setSolution() {
        solverState.solution = {
            hasSolution: null,
            nodesToPress: [],
            message: "Solving...",
        };

        setTimeout(() => {
            // timeSleep(5000); // 测试：阻塞5秒
            solverState.solution = this.#getSolution();
        }, 20);
    }

    // ===================================================================
    // ========================   Pure solver   ==========================
    // ===================================================================

    /**
     * 计算并返回图对应矩阵的秩信息。
     * @returns {{n: number, k: number}} 节点数量n和零空间秩k。
     */
    #getMatrixInfo() {
        const { nodes } = graph.getGraph();
        const N = nodes.length;
        if (N === 0) return { n: 0, k: 0 };

        // 构建影响矩阵 A = I + Adj
        const A = Array(N)
            .fill(0)
            .map(() => Array(N).fill(0));
        const nodeIndexMap = new Map(nodes.map((n, i) => [n.id, i]));
        for (let i = 0; i < N; i++) A[i][i] = 1;
        graph.getGraph().edges.forEach((edge) => {
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
     * 求解当前图。
     * @returns {{hasSolution: boolean, nodesToPress: string[], message: string}} 计算结果。
     */
    #getSolution() {
        const { nodes, edges } = graph.getGraph();
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
        const nodeIndexMap = new Map(nodeIds.map((id, i) => [id, i]));
        const M = Array(N)
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
        const pivotCols = [];
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
        ).filter((j) => j !== -1);
        const xp = Array(N).fill(0);
        for (let i = 0; i < rank; i++) xp[pivotCols[i]] = M[i][N];

        if (freeCols.length === 0 || solverState.algorithm === "any") {
            const nodesToPress = xp
                .map((val, i) => (val === 1 ? nodeIds[i] : null))
                .filter(Boolean);
            const message =
                freeCols.length === 0
                    ? "Success: Unique solution found."
                    : "Success: An arbitrary solution found.";
            return {
                hasSolution: true,
                nodesToPress,
                message,
            };
        }

        // 计算零空间的一组基
        const nullSpaceBasis = freeCols.map((freeCol) => {
            const basisVector = Array(N).fill(0);
            basisVector[freeCol] = 1;
            for (let i = 0; i < rank; i++) {
                if (M[i][freeCol] === 1) basisVector[pivotCols[i]] = 1;
            }
            return basisVector;
        });

        // 遍历 2^k 种组合，寻找权重最小（点击次数最少）的解
        let bestSolution = [...xp];
        let minWeight = bestSolution.reduce((a, b) => a + b, 0);
        for (let i = 1; i < 1 << freeCols.length; i++) {
            let currentSolution = [...xp];
            for (let j = 0; j < freeCols.length; j++) {
                if ((i >> j) & 1) {
                    for (let l = 0; l < N; l++)
                        currentSolution[l] ^= nullSpaceBasis[j][l];
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
            .filter(Boolean);
        return {
            hasSolution: true,
            nodesToPress,
            message: "Success: Min-Move solution found.",
        };
    }
}

const solver = new Solver();
export default solver;
