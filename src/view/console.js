/**
 * @file 控制台 UI
 * @description 负责渲染和更新顶部的控制台面板。
 * 绘制策略：每当视图状态发生变化时，手动调用 update() 函数。可以通过Proxy自动化响应。
 */

import * as View from "./view.js";
import { ModeType } from "./view.js";
import { commands } from "../handler/commands.js";
import { solverState } from "../model/solver.js";
import historyManager from "../handler/history.js";
import graph, { graphState, GridType } from "../model/graph.js";
import { ICONS } from "./icons.js";

const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
const MOD_KEY_PRIMARY = isMac ? "⌘" : "⌃";
const MOD_KEY_SHIFT = "⇧";
const MOD_KEY_DELETE = "⌫";
const DROPDOWN_TRIGGER_ICON = "▼";

// ===================================================================
// =======================   Console View   ==========================
// ===================================================================

/**
 * @class Console
 * @description 负责管理控制台UI的创建和更新。
 */
class ConsoleView {
    /** @type {HTMLElement} 控制台的DOM元素 */
    #consoleHTML;
    /** @type {Array<ButtonView | DropdownView | SeparatorView>} */
    #uiElements = [];

    /**
     * 初始化控制台模块。
     */
    init() {
        this.#consoleHTML = document.getElementById("console-html");
        this.#createUiElements();
        this.#render();
        this.#setupEventListeners();
    }

    /**
     * 设置全局事件监听器，用于处理快捷键。
     */
    #setupEventListeners() {
        document.addEventListener("keydown", (e) => {
            const modalOverlayHTML =
                document.getElementById("modal-overlay-html");
            if (!modalOverlayHTML.classList.contains("hidden")) {
                return;
            }

            const target = /** @type {HTMLElement} */ (e.target);
            const targetTagName = target.tagName.toUpperCase();
            if (targetTagName === "INPUT" || targetTagName === "TEXTAREA") {
                return;
            }

            for (const el of this.#uiElements) {
                if (el instanceof ButtonView) {
                    if (el.handleShortcut(e)) {
                        return; // 事件已被按钮处理
                    }
                }
            }
        });
    }

    /**
     * 构建并更新顶部的控制台UI。
     */
    update() {
        if (!this.#consoleHTML) return;
        this.#uiElements.forEach((el) => {
            if (el.updateState) {
                el.updateState();
            }
        });

        // 根据拖拽状态，切换控制台的透明度
        if (View.isNotDragging()) {
            this.#consoleHTML.classList.remove("transparent");
        } else {
            this.#consoleHTML.classList.add("transparent");
        }
    }

    /**
     * 将UI元素渲染到控制台容器中。
     */
    #render() {
        if (!this.#consoleHTML) return;
        this.#consoleHTML.innerHTML = "";
        this.#uiElements.forEach((el) => {
            const element = el.getElement();
            this.#consoleHTML.appendChild(element);
        });
    }

    /**
     * 创建所有的UI元素（按钮、下拉菜单、分隔符）并存储它们。
     */
    #createUiElements() {
        this.#uiElements = [
            new ButtonView({
                text: "Zoom Out",
                id: "zoom-out",
                shortcutText: `${MOD_KEY_PRIMARY}-`,
                icon: ICONS.ZOOM_OUT,
                onClick: commands.zoomOut,
                updateEnableState: () =>
                    View.canZoomOut() && View.isNotDragging(),
                shortcut: { keys: ["-", "_"], meta: true },
            }),

            new ButtonView({
                text: "Zoom In",
                id: "zoom-in",
                shortcutText: `${MOD_KEY_PRIMARY}+`,
                icon: ICONS.ZOOM_IN,
                onClick: commands.zoomIn,
                updateEnableState: () =>
                    View.canZoomIn() && View.isNotDragging(),
                shortcut: { keys: ["=", "+"], meta: true },
            }),

            new DropdownView({
                text: "Mode",
                id: "mode",
                getIcon: () =>
                    View.viewState.currentMode === ModeType.EDIT
                        ? ICONS.MODE_EDIT
                        : ICONS.MODE_SOLVER,
                updateEnableState: () => View.isNotDragging(),

                subButtons: [
                    new ButtonView({
                        text: "Edit",
                        id: "mode-edit",
                        icon: ICONS.MODE_EDIT,
                        onClick: () => {
                            if (View.viewState.currentMode !== ModeType.EDIT)
                                commands.switchToEditMode();
                        },
                        updateEnableState: () =>
                            View.viewState.currentMode !== ModeType.EDIT,
                    }),

                    new ButtonView({
                        text: "Solver",
                        id: "mode-solver",
                        icon: ICONS.MODE_SOLVER,
                        onClick: () => {
                            if (View.viewState.currentMode !== ModeType.SOLVER)
                                commands.switchToSolverMode();
                        },
                        updateEnableState: () =>
                            View.viewState.currentMode !== ModeType.SOLVER,
                    }),
                ],
            }),

            new DropdownView({
                text: "Grid",
                id: "grid",
                getIcon: () =>
                    graphState.grid === GridType.SQUARE
                        ? ICONS.GRID_SQUARE
                        : ICONS.GRID_TRIANGLE,
                updateEnableState: () =>
                    View.isNotDragging() &&
                    View.viewState.currentMode === ModeType.EDIT,

                subButtons: [
                    new ButtonView({
                        text: "Square",
                        id: "grid-square",
                        icon: ICONS.GRID_SQUARE,
                        onClick: () => commands.changeLayout(GridType.SQUARE),
                        updateEnableState: () =>
                            graphState.grid !== GridType.SQUARE,
                    }),

                    new ButtonView({
                        text: "Triangle",
                        id: "grid-triangle",
                        icon: ICONS.GRID_TRIANGLE,
                        onClick: () =>
                            commands.changeLayout(GridType.TRIANGULAR),
                        updateEnableState: () =>
                            graphState.grid !== GridType.TRIANGULAR,
                    }),
                ],
            }),

            new SeparatorView(),

            new ButtonView({
                text: "Undo",
                id: "undo",
                shortcutText: `${MOD_KEY_PRIMARY}Z`,
                icon: ICONS.UNDO,
                onClick: commands.undo,
                updateEnableState: () =>
                    View.isNotDragging() &&
                    historyManager.canUndo() &&
                    View.viewState.currentMode === ModeType.EDIT,
                shortcut: { code: "KeyZ", meta: true, shift: false },
            }),

            new ButtonView({
                text: "Redo",
                id: "redo",
                shortcutText: `${MOD_KEY_PRIMARY}${MOD_KEY_SHIFT}Z`,
                icon: ICONS.REDO,
                onClick: commands.redo,
                updateEnableState: () =>
                    View.isNotDragging() &&
                    historyManager.canRedo() &&
                    View.viewState.currentMode === ModeType.EDIT,
                shortcut: { code: "KeyZ", meta: true, shift: true },
            }),

            new ButtonView({
                text: "Select All",
                id: "select-all",
                shortcutText: `${MOD_KEY_PRIMARY}A`,
                icon: ICONS.SELECT_ALL,
                onClick: commands.selectAll,
                updateEnableState: () =>
                    View.isNotDragging() &&
                    View.viewState.currentMode === ModeType.EDIT &&
                    !graph.isEmpty(),
                shortcut: { code: "KeyA", meta: true, shift: false },
            }),
            
            new DropdownView({
                text: "Initial State",
                id: "init-state",
                getIcon: () => ICONS.INIT_STATE,
                updateEnableState: () =>
                    View.isNotDragging() &&
                    View.viewState.currentMode === ModeType.EDIT &&
                    View.viewState.selectedElements.some(
                        (sel) => sel.type === "node"
                    ),

                subButtons: [
                    new ButtonView({
                        text: "Invert",
                        id: "init-state-invert",
                        icon: ICONS.INIT_STATE_INVERT,
                        onClick: commands.initInvertSelection,
                        updateEnableState: () =>
                            View.isNotDragging() &&
                            View.viewState.currentMode === ModeType.EDIT &&
                            View.viewState.selectedElements.some(
                                (sel) => sel.type === "node"
                            ),
                    }),
                    
                    new ButtonView({
                        text: "Turn Off",
                        id: "init-state-turn-off",
                        icon: ICONS.INIT_STATE_TURN_OFF,
                        onClick: commands.initTurnOffSelection,
                        updateEnableState: () =>
                            View.isNotDragging() &&
                            View.viewState.currentMode === ModeType.EDIT &&
                            View.viewState.selectedElements.some(
                                (sel) =>
                                    sel.type === "node" &&
                                    (() => {
                                        const node = graph
                                            .getGraph()
                                            .nodes.find((node) => node.id === sel.id);
                                        return node && node.initialOn;
                                    })()
                            ),
                    }),
                ],
            }),

            new ButtonView({
                text: "Delete",
                id: "delete",
                shortcutText: MOD_KEY_DELETE,
                icon: ICONS.DELETE,
                onClick: commands.deleteSelectedElements,
                updateEnableState: () =>
                    View.isNotDragging() &&
                    View.viewState.currentMode === ModeType.EDIT &&
                    View.viewState.selectedElements.length > 0,
                shortcut: { keys: ["Backspace", "Delete"] },
            }),

            new SeparatorView(),

            new DropdownView({
                text: "Algorithm",
                id: "algorithm",
                getIcon: () => ICONS.ALGORITHM,
                updateEnableState: () =>
                    View.viewState.currentMode === ModeType.SOLVER,

                subButtons: [
                    new ButtonView({
                        text: "Arbitrary",
                        id: "algo-any",
                        icon: ICONS.ALGORITHM_ARBITRARY,
                        onClick: () => commands.solveCurrentPuzzle("any"),
                        updateEnableState: () =>
                            solverState.algorithm !== "any",
                    }),

                    new ButtonView({
                        text: "Min-Move",
                        id: "algo-min-weight",
                        icon: ICONS.ALGORITHM_MIN_MOVE,
                        onClick: () =>
                            commands.solveCurrentPuzzle("min_weight"),
                        updateEnableState: () =>
                            solverState.algorithm !== "min_weight",
                    }),
                ],
            }),

            new ButtonView({
                text: "Restart",
                id: "restart",
                icon: ICONS.RESTART,
                onClick: commands.restartPuzzle,
                updateEnableState: () =>
                    View.viewState.currentMode === ModeType.SOLVER,
            }),
        ];
    }
}

const consoleView = new ConsoleView();
export default consoleView;

// ===================================================================
// ========================   Sub View   =============================
// ===================================================================

/**
 * @class SeparatorView
 * @description 代表控制台中的一条视觉分割线。
 */
class SeparatorView {
    #element;

    constructor() {
        this.#element = this.#createElement();
    }

    /**
     * 创建分割线的DOM元素。
     * @returns {HTMLDivElement}
     */
    #createElement() {
        const separator = document.createElement("div");
        separator.className = "console-separator";
        return separator;
    }

    /**
     * 返回分割线的DOM元素。
     * @returns {HTMLDivElement}
     */
    getElement() {
        return this.#element;
    }

    updateState() {
        // do nothing
        // TODO: 创建一个统一的 View class，让所有 UI 元素继承它，这样就不需要每个类都实现 updateState 方法了
    }
}

/**
 * @class ButtonView
 * @description 代表控制台UI中的单个按钮。
 */
class ButtonView {
    #element;
    #updateEnableState;

    /**
     * @param {object} options - 按钮的选项。
     * @param {string} options.text - 按钮上显示的主要文本。
     * @param {string} options.id - 按钮的唯一标识符，用作 data-key。
     * @param {string} [options.icon] - 按钮图标的URL。
     * @param {string} [options.shortcutText] - 键盘快捷键提示的文本。
     * @param {() => any} options.onClick - 点击事件的回调函数。
     * @param {() => boolean} [options.updateEnableState] - 返回 true 则按钮可用，否则禁用的函数。
     * @param {{keys?: string[], code?: string, meta?: boolean, shift?: boolean, alt?: boolean}} [options.shortcut] - 快捷键定义。
     */
    constructor({
        text,
        id,
        icon = "",
        shortcutText = "",
        onClick,
        updateEnableState,
        shortcut = null,
    }) {
        this.text = text;
        this.id = id;
        this.icon = icon;
        this.shortcutText = shortcutText;
        this.onClick = onClick;
        this.#updateEnableState = updateEnableState;
        this.shortcut = shortcut;

        this.#element = this.#createElement();
        this.updateState(); // 设置初始状态
    }

    /**
     * 创建按钮的DOM元素。
     * @returns {HTMLButtonElement}
     */
    #createElement() {
        const button = document.createElement("button");
        button.className = "console-button";
        if (this.id) button.dataset.key = this.id;

        button.onclick = (e) => {
            if (!button.classList.contains("disabled")) {
                this.onClick();
            }
        };

        const titleDiv = document.createElement("div");
        titleDiv.className = "console-button-title";
        titleDiv.textContent = this.text;

        const iconContainer = document.createElement("div");
        iconContainer.className = "console-button-icon-container";
        if (this.icon) {
            const img = document.createElement("img");
            img.src = this.icon;
            img.className = "console-button-icon";
            img.draggable = false; // 防止图片被拖拽
            iconContainer.appendChild(img);
        }

        const subtitleDiv = document.createElement("div");
        subtitleDiv.className = "console-button-subtitle";
        if (this.shortcutText) {
            subtitleDiv.textContent = this.shortcutText;
        }

        button.append(titleDiv, iconContainer, subtitleDiv);
        return button;
    }

    /**
     * 处理键盘快捷键事件。
     * @param {KeyboardEvent} e - 键盘事件。
     * @returns {boolean} 如果事件被处理，则返回 true。
     */
    handleShortcut(e) {
        if (!this.shortcut) return false;

        const metaPressed = isMac ? e.metaKey : e.ctrlKey;
        const wantMeta = this.shortcut.meta ?? false;

        let keyMatch = false;
        if (this.shortcut.keys) {
            keyMatch = this.shortcut.keys.includes(e.key);
        } else if (this.shortcut.code) {
            keyMatch = e.code === this.shortcut.code;
        }

        if (
            keyMatch &&
            metaPressed === wantMeta &&
            e.shiftKey === (this.shortcut.shift ?? false) &&
            e.altKey === (this.shortcut.alt ?? false)
        ) {
            e.preventDefault();
            // 检查按钮是否处于激活状态
            if (this.#element.classList.contains("disabled")) {
                return true; // 匹配但禁用，消费事件但什么都不做
            }

            // 如果 onClick 返回 true，则闪烁按钮
            if (this.onClick()) {
                if (this.#element) {
                    this.#element.classList.remove("flash");
                    void this.#element.offsetWidth; // 强制重排，确保快速连续的动画能重新生效而不是被吃掉
                    this.#element.classList.add("flash");
                    this.#element.addEventListener(
                        "animationend",
                        () => {
                            this.#element.classList.remove("flash");
                        },
                        { once: true }
                    );
                }
            }
            return true; // 事件已处理
        }

        return false;
    }

    /**
     * 返回按钮的DOM元素。
     * @returns {HTMLButtonElement}
     */
    getElement() {
        return this.#element;
    }

    /**
     * 根据 `updateEnableState` 函数更新按钮的启用/禁用状态。
     */
    updateState() {
        if (this.#updateEnableState) {
            const isEnabled = this.#updateEnableState();
            if (isEnabled) {
                this.#element.classList.remove("disabled");
            } else {
                this.#element.classList.add("disabled");
            }
        }
    }
}

/**
 * @class DropdownView
 * @description 代表一个包含多个按钮的下拉菜单组件。
 */
class DropdownView {
    #element;
    #iconElement;
    #subButtons;
    #updateEnableState;
    #getIcon;

    /**
     * @param {object} options
     * @param {string} options.text - 菜单上显示的主要文本。
     * @param {string} options.id - 菜单的唯一标识符，用作 data-key。
     * @param {() => string} options.getIcon - 返回图标URL的回调函数。
     * @param {() => boolean} options.updateEnableState - 返回 true 时下拉菜单可用，否则禁用。
     * @param {ButtonView[]} options.subButtons - 下拉菜单中的按钮列表。
     */
    constructor({ text, id, getIcon, updateEnableState, subButtons }) {
        this.text = text;
        this.id = id;
        this.#getIcon = getIcon;
        this.#updateEnableState = updateEnableState;
        this.#subButtons = subButtons;

        this.#element = this.#createElement();
        this.updateState();
    }

    /**
     * 创建下拉菜单的DOM元素。
     * @returns {HTMLDivElement}
     */
    #createElement() {
        const container = document.createElement("div");
        container.className = "dropdown-container";
        container.dataset.key = this.id;

        const trigger = document.createElement("button");
        trigger.className = "console-button dropdown-trigger";

        const titleDiv = document.createElement("div");
        titleDiv.className = "console-button-title";
        titleDiv.textContent = this.text;

        const iconContainer = document.createElement("div");
        iconContainer.className = "console-button-icon-container";
        const iconUrl = this.#getIcon();
        if (iconUrl) {
            this.#iconElement = document.createElement("img");
            this.#iconElement.src = iconUrl;
            this.#iconElement.className = "console-button-icon";
            iconContainer.appendChild(this.#iconElement);
        }

        const subtitleDiv = document.createElement("div");
        subtitleDiv.className = "console-button-subtitle";
        subtitleDiv.innerHTML = DROPDOWN_TRIGGER_ICON;

        trigger.append(titleDiv, iconContainer, subtitleDiv);

        const optionsContainer = document.createElement("div");
        optionsContainer.className = "dropdown-options";

        this.#subButtons.forEach((button) => {
            const subButtonElement = button.getElement();
            optionsContainer.appendChild(subButtonElement);
        });

        container.appendChild(trigger);
        container.appendChild(optionsContainer);

        return container;
    }

    /**
     * 返回下拉菜单的DOM元素。
     * @returns {HTMLDivElement}
     */
    getElement() {
        return this.#element;
    }

    /**
     * 根据 `updateEnableState` 函数更新下拉菜单的启用/禁用状态。
     */
    updateState() {
        if (this.#updateEnableState) {
            const isEnabled = this.#updateEnableState();
            if (isEnabled) {
                this.#element.classList.remove("disabled");
            } else {
                this.#element.classList.add("disabled");
            }
        }
        if (this.#getIcon && this.#iconElement) {
            this.#iconElement.src = this.#getIcon();
        }
        this.#subButtons.forEach((button) => button.updateState());
    }
}
