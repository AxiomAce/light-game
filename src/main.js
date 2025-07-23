/**
 * @file 应用主入口和协调器
 * @description 负责初始化所有模块、协调不同模块间的交互并管理主事件循环。
 */

import * as View from "./view/view.js";
import canvasView from "./view/canvas.js";
import consoleView from "./view/console.js";
import inspectorView from "./view/inspector.js";
import { commands } from "./handler/commands.js";
import {
    panHandler,
    editModeHandler,
    solverModeHandler,
} from "./handler/interactions.js";

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM & Context ---
    const canvasHTML = document.getElementById("canvas-html");
    const consoleHTML = document.getElementById("console-html");
    const inspectorHTML = document.getElementById("inspector-html");

    // --- Initialization ---
    canvasView.init(canvasHTML);
    consoleView.init(consoleHTML);
    inspectorView.init(inspectorHTML);
    consoleView.update();
    inspectorView.update();

    // --- Event Listeners ---
    window.addEventListener("resize", () => canvasView.resize());

    canvasHTML.addEventListener("mousedown", (e) => {
        if (e.altKey) {
            panHandler.handleMouseDown(e);
            return;
        }
        if (View.viewState.currentMode === "edit")
            editModeHandler.handleMouseDown(e);
    });

    window.addEventListener("mousemove", (e) => {
        if (!View.viewState.dragging.isActive) return;

        if (View.viewState.dragging.type === "pan") {
            panHandler.handleMouseMove(e);
        } else if (View.viewState.currentMode === "edit") {
            editModeHandler.handleMouseMove(e);
        }
    });

    canvasHTML.addEventListener("mousemove", (e) => {
        // 处理非拖拽时的悬停效果
        if (
            !View.viewState.dragging.isActive &&
            View.viewState.currentMode === "edit"
        ) {
            editModeHandler.handleMouseMove(e);
        }
    });

    window.addEventListener("mouseup", (e) => {
        if (!View.viewState.dragging.isActive) return;

        if (View.viewState.dragging.type === "pan") {
            panHandler.handleMouseUp(e);
        } else if (View.viewState.currentMode === "edit") {
            editModeHandler.handleMouseUp(e);
        }

        View.viewState.dragging.isActive = false;
        View.viewState.dragging.type = null;
    });

    canvasHTML.addEventListener("wheel", panHandler.handleWheel);

    canvasHTML.addEventListener("click", (e) => {
        if (View.viewState.currentMode === "solver")
            solverModeHandler.handleClick(e);
    });

    canvasHTML.addEventListener("contextmenu", (e) => {
        if (View.viewState.currentMode === "edit")
            editModeHandler.handleContextMenu(e);
    });

    document.addEventListener("keydown", (e) => {
        panHandler.handleKeyDown(e);

        // 全局缩放快捷键
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case "=": // 无需Shift的 '+'
                case "+":
                    e.preventDefault();
                    if (commands.zoomIn()) {
                        consoleView.flashButton("zoom-in");
                    }
                    break;
                case "-":
                    e.preventDefault();
                    if (commands.zoomOut()) {
                        consoleView.flashButton("zoom-out");
                    }
                    break;
            }
        }

        if (View.viewState.currentMode === "edit") {
            if (
                (e.key === "Backspace" || e.key === "Delete") &&
                !View.viewState.dragging.isLocked
            ) {
                e.preventDefault();
                if (commands.deleteSelectedElements()) {
                    consoleView.flashButton("delete");
                }
            } else if (e.key === "Escape") {
                commands.deselectAll();
            } else if (
                (e.metaKey || e.ctrlKey) &&
                !View.viewState.dragging.isLocked
            ) {
                if (e.code === "KeyZ") {
                    e.preventDefault();
                    if (e.shiftKey) {
                        if (commands.redo()) {
                            consoleView.flashButton("redo");
                        }
                    } else {
                        if (commands.undo()) {
                            consoleView.flashButton("undo");
                        }
                    }
                }
            }
        }
    });

    document.addEventListener("keyup", (e) => {
        panHandler.handleKeyUp(e);
    });

    /**
     * 主渲染循环。
     */
    function mainLoop() {
        canvasView.draw();
        requestAnimationFrame(mainLoop);
    }
    mainLoop();
});
