/**
 * @file 查看器 UI
 * @description 负责渲染和更新右侧的查看器面板。
 * 绘制策略：每当视图状态发生变化时，手动调用 update() 函数。可以通过Proxy自动化响应。
 */

import { viewState, ModeType } from "./view.js";
import { solverState } from "../model/solver.js";
import { commands } from "../handler/commands.js";
import renderMathInElement from "katex/dist/contrib/auto-render";
import "katex/dist/katex.min.css";

/**
 * @class Inspector
 * @description 负责管理右侧查看器面板的UI创建和更新。
 */
class InspectorView {
    /** @type {HTMLElement} 查看器的DOM元素 */
    #inspectorHTML;
    /** @type {HTMLElement} 模态框的DOM元素 */
    #modalOverlayHTML;
    /** @type {HTMLElement} “编辑模式”下特定UI的容器 */
    #editModeContainer;
    /** @type {HTMLElement} “求解模式”下特定UI的容器 */
    #solverModeContainer;
    /** @type {HTMLElement} 查看器面板的标题元素 */
    #headerElement;

    /**
     * @type {{
     *  handleKeyDown: (e: KeyboardEvent) => void,
     *  handleMouseDown: (e: MouseEvent) => void
     * }} 模态框的事件处理器集合
     */
    #modalHandler = {
        handleKeyDown: (e) => {
            if (e.key === "Escape") {
                this.#hideModal();
            }
        },
        handleMouseDown: (e) => {
            if (e.target === this.#modalOverlayHTML) {
                this.#hideModal();
            }
        },
    };

    /**
     * 初始化查看器模块。
     */
    init() {
        this.#inspectorHTML = document.getElementById("inspector-html");
        this.#modalOverlayHTML = document.getElementById("modal-overlay-html");
        this.#createDOMElements();
    }

    /**
     * 构建并更新右侧的查看器UI。
     */
    update() {
        if (!this.#inspectorHTML) return;

        // 1. 只更新标题内容，不重建元素
        this.#headerElement.textContent =
            viewState.currentMode === ModeType.EDIT ? "Edit Mode" : "Solver Mode";

        // 2. 根据模式切换容器的可见性
        if (viewState.currentMode === ModeType.EDIT) {
            this.#editModeContainer.style.display = "block";
            this.#solverModeContainer.style.display = "none";
        } else {
            this.#editModeContainer.style.display = "none";
            this.#solverModeContainer.style.display = "block";
            this.#renderSolverMode(); // 求解器内容是动态的，需要按需重绘
        }

        // 3. 对更新后的内容应用数学公式渲染
        renderMathInElement(this.#inspectorHTML, {
            delimiters: [
                { left: "\\(", right: "\\)", display: false },
                { left: "\\[", right: "\\]", display: true },
                { left: "$$", right: "$$", display: true },
            ],
            throwOnError: false,
        });
    }

    /**
     * 创建并初始化查看器面板所需的静态DOM元素和事件监听器。
     * 此方法在 init() 中只调用一次。
     */
    #createDOMElements() {
        // 创建并添加标题
        this.#headerElement = document.createElement("h3");
        this.#inspectorHTML.appendChild(this.#headerElement);

        // 创建编辑模式的容器
        this.#editModeContainer = document.createElement("div");
        this.#inspectorHTML.appendChild(this.#editModeContainer);

        // 创建求解模式的容器
        this.#solverModeContainer = document.createElement("div");
        this.#inspectorHTML.appendChild(this.#solverModeContainer);

        // -- 渲染编辑模式的静态内容 --
        const controls = `
            <div class="info-block">
                <p><b>Controls:</b></p>
                <ul style="padding-left: 20px; margin-top: 5px; font-size: 14px; color: #333;">
                    <li><b>Left Click:</b> Add Node</li>
                    <li><b>Left Drag:</b> Add Edge</li>
                    <li><b>Right Click:</b> Invert initial state</li>
                </ul>
            </div>`;

        const dataOps = `
            <div class="info-block">
                <p><b>Data:</b></p>
                <div style="display: flex; gap: 10px; margin-top: 10px;">
                    <button id="import-button" class="inspector-button" style="flex: 1;">Import</button>
                    <button id="export-button" class="inspector-button" style="flex: 1;">Export</button>
                </div>
            </div>`;

        this.#editModeContainer.innerHTML = controls + dataOps;

        // -- 为按钮绑定事件监听器 --
        // 使用 .querySelector 在限定范围内查找，而不是全局的 getElementById
        const importButton = /** @type {HTMLButtonElement} */ (this.#editModeContainer.querySelector("#import-button"));
        const exportButton = /** @type {HTMLButtonElement} */ (this.#editModeContainer.querySelector("#export-button"));
        
        if (importButton) {
            importButton.onclick = () => this.#showImportModal();
        }
        if (exportButton) {
            exportButton.onclick = () => this.#showExportModal();
        }
    }

    #renderSolverMode() {
        // 求解模式的内容是动态的，因此每次更新时都重写其容器的innerHTML
        this.#solverModeContainer.innerHTML = "";
        
        const isAny = solverState.algorithm === "any";
        const isMinWeight = solverState.algorithm === "min_weight";

        let content = `
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
            content += `
               <div class="info-block">
                   <p><b>Solver Output:</b></p>
                   <ul style="padding-left: 20px; margin-top: 5px; font-size: 14px; color: #333;">
                        <li>${solverState.solution.message}</li>
                   </ul>
               </div>`;
        }
        this.#solverModeContainer.innerHTML = content;
    }

    #showImportModal() {
        const modalContent = document.createElement("div");
        modalContent.className = "modal-content";
        modalContent.innerHTML = `
            <h3>Import Graph</h3>
            <p>Paste the exported Base64 string below.</p>
            <textarea id="modal-import-textarea" rows="5" class="inspector-input" style="width: 100%;"></textarea>
            <div class="modal-action-row">
                <p id="modal-message" class="modal-message"></p>
                <button id="modal-import-confirm" class="inspector-button">Import</button>
            </div>
        `;

        this.#showModal(modalContent);
        
        const textarea = /** @type {HTMLTextAreaElement} */ (
            document.getElementById("modal-import-textarea")
        );
        textarea.value = "";
        textarea.select();

        document.getElementById("modal-import-confirm").onclick = () => {
            const msgEl = document.getElementById("modal-message");
            const input = /** @type {HTMLTextAreaElement} */ (
                document.getElementById("modal-import-textarea")
            ).value;
            try {
                if (!input) {
                    throw new Error("Input is empty.");
                }
                commands.importGraph(input);
                this.#hideModal();
            } catch (e) {
                msgEl.textContent = e.message;
                textarea.select();
            }
        };
    }

    #showExportModal() {
        try {
            const data = commands.exportGraph();
            const modalContent = document.createElement("div");
            modalContent.className = "modal-content";
            modalContent.innerHTML = `
                <h3>Exported Data</h3>
                <p>Copy the Base64 string below.</p>
                <textarea id="modal-export-textarea" readonly class="inspector-input" style="width: 100%;"></textarea>
            `;

            this.#showModal(modalContent);

            const textarea = /** @type {HTMLTextAreaElement} */ (
                document.getElementById("modal-export-textarea")
            );
            textarea.value = data;
            textarea.select();
        } catch (e) {
            const modalContent = document.createElement("div");
            modalContent.className = "modal-content";
            modalContent.innerHTML = `
                <h3>Error</h3>
                <p id="modal-message" class="modal-message">${e.message}</p>
            `;
            this.#showModal(modalContent);
        }
    }

    /**
     * @param {HTMLElement} content
     */
    #showModal(content) {
        this.#modalOverlayHTML.innerHTML = "";
        this.#modalOverlayHTML.appendChild(content);
        this.#modalOverlayHTML.classList.remove("hidden");

        // --- Event Listeners for closing modal ---
        // Use a timeout to avoid the same click event that opened the modal from closing it
        setTimeout(() => {
            this.#modalOverlayHTML.addEventListener(
                "mousedown",
                this.#modalHandler.handleMouseDown
            );
            document.addEventListener(
                "keydown",
                this.#modalHandler.handleKeyDown
            );
        }, 0);
    }

    #hideModal() {
        this.#modalOverlayHTML.removeEventListener(
            "mousedown",
            this.#modalHandler.handleMouseDown
        );
        document.removeEventListener(
            "keydown",
            this.#modalHandler.handleKeyDown
        );

        this.#modalOverlayHTML.classList.add("hidden");
        this.#modalOverlayHTML.innerHTML = ""; // Clean up content
    }
}

const inspectorView = new InspectorView();
export default inspectorView;
