/**
 * @file 控制台 UI
 * @description 负责渲染和更新顶部的控制台面板。
 * 绘制策略：每当视图状态发生变化时，手动调用 update() 函数。可以通过Proxy自动化响应。
 */

import * as View from "./view.js";
import { commands } from "../handler/commands.js";
import { solverState } from "../model/solver.js";
import historyManager from "../handler/history.js";

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const MOD_KEY_PRIMARY = isMac ? "⌘" : "⌃";
const MOD_KEY_SHIFT = "⇧";

/**
 * @class Console
 * @description 负责管理控制台UI的创建和更新。
 */
class ConsoleView {
    #consoleHTML;

    /**
     * 初始化控制台模块。
     * @param {HTMLElement} _consoleHTML - 控制台的DOM元素。
     */
    init(_consoleHTML) {
        this.#consoleHTML = _consoleHTML;
    }

    /**
     * 构建并更新顶部的控制台UI。
     */
    update() {
        if (!this.#consoleHTML) return;
        this.#consoleHTML.innerHTML = "";

        const modeSwitcher = this.#createDropdown("Mode", [
            {
                text: "Edit",
                onClick: () => {
                    if (View.viewState.currentMode !== "edit")
                        commands.switchToEditMode();
                },
                selected: View.viewState.currentMode === "edit",
            },
            {
                text: "Solver",
                onClick: () => {
                    if (View.viewState.currentMode !== "solver")
                        commands.switchToSolverMode();
                },
                selected: View.viewState.currentMode === "solver",
            },
        ]);

        const layoutSwitcher = this.#createDropdown(
            "Grid",
            [
                {
                    text: "Square",
                    onClick: () => {
                        commands.changeLayout("square");
                    },
                    selected: View.viewState.canvasLayout === "square",
                },
                {
                    text: "Triangle",
                    onClick: () => {
                        commands.changeLayout("triangular");
                    },
                    selected: View.viewState.canvasLayout === "triangular",
                },
            ],
            View.viewState.currentMode !== "edit"
        );

        const zoomOutButton = this.#createButton("－", commands.zoomOut, {
            title: `Zoom Out (${MOD_KEY_PRIMARY}-)`,
        });
        const zoomInButton = this.#createButton("＋", commands.zoomIn, {
            title: `Zoom In (${MOD_KEY_PRIMARY}+)`,
        });

        const undoButton = this.#createButton("Undo", commands.undo, {
            title: `Undo (${MOD_KEY_PRIMARY}Z)`,
            disabled:
                !historyManager.canUndo() ||
                View.viewState.currentMode !== "edit",
        });
        const redoButton = this.#createButton("Redo", commands.redo, {
            title: `Redo (${MOD_KEY_PRIMARY}${MOD_KEY_SHIFT}Z)`,
            disabled:
                !historyManager.canRedo() ||
                View.viewState.currentMode !== "edit",
        });

        const invertButton = this.#createButton("Invert", commands.invertSelection, {
            disabled:
                View.viewState.currentMode !== "edit" ||
                !View.viewState.selectedElements.some(
                    (sel) => sel.type === "node"
                ),
        });

        const deleteButton = this.#createButton(
            "Delete",
            commands.deleteSelectedElements,
            {
                title: "Delete (⌫)",
                disabled:
                    View.viewState.currentMode !== "edit" ||
                    View.viewState.selectedElements.length === 0,
            }
        );
        const clearButton = this.#createButton("Clear", commands.clearCanvas, {
            className: "clear",
            disabled: View.viewState.currentMode !== "edit",
        });

        const algoSwitcher = this.#createDropdown(
            "Algorithm",
            [
                {
                    text: "Arbitrary",
                    onClick: () => commands.solveCurrentPuzzle("any"),
                    selected: solverState.algorithm === "any",
                },
                {
                    text: "Min-Move",
                    onClick: () => commands.solveCurrentPuzzle("min_weight"),
                    selected: solverState.algorithm === "min_weight",
                },
            ],
            View.viewState.currentMode !== "solver"
        );

        const restartButton = this.#createButton("Restart", commands.restartPuzzle, {
            disabled: View.viewState.currentMode !== "solver",
        });

        this.#consoleHTML.append(
            modeSwitcher,
            layoutSwitcher,
            zoomOutButton,
            zoomInButton,
            this.#createSeparator(),
            undoButton,
            redoButton,
            invertButton,
            deleteButton,
            clearButton,
            this.#createSeparator(),
            algoSwitcher,
            restartButton
        );
    }

    // ===================================================================
    // ==========================   辅助函数   ============================
    // ===================================================================

    /**
     * 创建一个按钮元素。
     * @private
     * @param {string} text - 按钮显示的文本。
     * @param {function} onClick - 按钮的点击事件回调。
     * @param {object} [options] - 额外的选项。
     * @param {string} [options.className=''] - 按钮的CSS类名。
     * @param {string} [options.title=''] - 按钮的提示文本。
     * @param {boolean} [options.disabled=false] - 按钮是否禁用。
     * @returns {HTMLButtonElement}
     */
    #createButton(
        text,
        onClick,
        { className = "", title = "", disabled = false } = {}
    ) {
        const button = document.createElement("button");
        button.className = `console-button ${className}`;
        button.textContent = text;
        if (title) button.title = title;
        button.onclick = onClick;
        if (disabled) button.classList.add("disabled");
        return button;
    }

    /**
     * 创建一个下拉菜单组件。
     * @private
     * @param {string} triggerText - 触发下拉菜单的按钮文本。
     * @param {object[]} options - 下拉菜单的选项数组。
     * @param {boolean} [disabled=false] - 是否禁用整个下拉组件。
     * @returns {HTMLDivElement}
     */
    #createDropdown(triggerText, options, disabled = false) {
        const container = document.createElement("div");
        container.className = "dropdown-container";
        if (disabled) container.classList.add("disabled");

        const trigger = document.createElement("button");
        trigger.className = "console-button dropdown-trigger";
        trigger.textContent = triggerText;

        const optionsContainer = document.createElement("div");
        optionsContainer.className = "dropdown-options";

        options.forEach((opt) => {
            const optionButton = document.createElement("button");
            optionButton.className = "console-button dropdown-option";
            if (opt.text) optionButton.textContent = opt.text;
            if (opt.textHTML) optionButton.innerHTML = opt.textHTML;
            optionButton.onclick = opt.onClick;
            if (opt.selected) optionButton.classList.add("selected");
            optionsContainer.appendChild(optionButton);
        });

        container.appendChild(trigger);
        container.appendChild(optionsContainer);
        return container;
    }

    /**
     * 创建一个视觉分割线元素。
     * @private
     * @returns {HTMLDivElement}
     */
    #createSeparator() {
        const separator = document.createElement("div");
        separator.className = "console-separator";
        return separator;
    }
}

const consoleView = new ConsoleView();
export default consoleView;
