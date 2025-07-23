/**
 * @file 查看器 UI
 * @description 负责渲染和更新右侧的查看器面板。
 * 绘制策略：每当视图状态发生变化时，手动调用 update() 函数。可以通过Proxy自动化响应。
 */

import { viewState } from "./view.js";
import { solverState } from "../model/solver.js";

/**
 * @class Inspector
 * @description 负责管理右侧查看器面板的UI创建和更新。
 */
class InspectorView {
    #inspectorHTML;

    /**
     * 初始化查看器模块。
     * @param {HTMLElement} _inspectorHTML - 查看器面板的DOM元素。
     */
    init(_inspectorHTML) {
        this.#inspectorHTML = _inspectorHTML;
    }

    /**
     * 构建并更新右侧的查看器UI。
     */
    update() {
        if (!this.#inspectorHTML) return;
        this.#inspectorHTML.innerHTML = "";
        const header = document.createElement("h3");
        header.textContent =
            viewState.currentMode === "edit" ? "Edit Mode" : "Solver Mode";
        this.#inspectorHTML.appendChild(header);

        if (viewState.currentMode === "edit") {
            this.#inspectorHTML.innerHTML += `
                <div class="info-block">
                    <p><b>Controls:</b></p>
                    <ul style="padding-left: 20px; margin-top: 5px; font-size: 14px; color: #333;">
                        <li><b>Left Click:</b> Add Node</li>
                        <li><b>Left Drag:</b> Add Edge</li>
                        <li><b>Right Click:</b> Invert initial state</li>
                    </ul>
                </div>`;
        } else {
            // Solver Mode
            const isAny = solverState.algorithm === "any";
            const isMinWeight = solverState.algorithm === "min_weight";

            this.#inspectorHTML.innerHTML += `
                <div class="info-block">
                    <p><b>Controls:</b></p>
                    <ul style="padding-left: 20px; margin-top: 5px; font-size: 14px; color: #333;">
                        <li><b>Left Click:</b> Toggle Light</li>
                    </ul>
                </div>
                <div class="info-block">
                    <p><b>Algorithm:</b></p>
                    <ul style="list-style: none; padding-left: 0; margin-top: 5px; font-size: 14px; color: #333;">
                        <li><span style="display: inline-block; width: 1.5em; text-align: center;">${
                            isAny ? "➔" : "·"
                        }</span><span style="display: inline-block; width: 5.5em;">Arbitrary:</span> \\(O(n^3)\\)</li>
                        <li><span style="display: inline-block; width: 1.5em; text-align: center;">${
                            isMinWeight ? "➔" : "·"
                        }</span><span style="display: inline-block; width: 5.5em;">Min-Move:</span> \\(O(n^3 + n \\cdot 2^k)\\)</li>
                    </ul>
                </div>
                <div class="info-block">
                    <p><b>Matrix Info:</b></p>
                    <ul style="padding-left: 20px; margin-top: 5px; font-size: 14px; color: #333;">
                        <li><span style="display: inline-block; width: 8.5em;">Nodes:</span> \\(n = ${
                            solverState.matrixInfo.n
                        }\\)</li>
                        <li><span style="display: inline-block; width: 8.5em;">Null Space Rank:</span> \\(k = ${
                            solverState.matrixInfo.k
                        }\\)</li>
                    </ul>
                </div>`;
            if (solverState.solution.message) {
                this.#inspectorHTML.innerHTML += `
                   <div class="info-block">
                       <p><b>Solver Output:</b></p>
                       <ul style="padding-left: 20px; margin-top: 5px; font-size: 14px; color: #333;">
                            <li>${solverState.solution.message}</li>
                       </ul>
                   </div>`;
            }
        }

        if (window.renderMathInElement) {
            window.renderMathInElement(this.#inspectorHTML, {
                delimiters: [
                    { left: "\\(", right: "\\)", display: false },
                    { left: "\\[", right: "\\]", display: true },
                    { left: "$$", right: "$$", display: true },
                ],
                throwOnError: false,
            });
        }
    }
}

const inspectorView = new InspectorView();
export default inspectorView;
