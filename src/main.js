/**
 * @file 应用主入口和协调器
 * @description 负责初始化所有模块、协调不同模块间的交互并管理主事件循环。
 */

import {
    panHandler,
    editModeHandler,
    solverModeHandler,
    shortcutHandler,
} from "./handler/interactions.js";
import canvasView from "./view/canvas.js";
import consoleView from "./view/console.js";
import inspectorView from "./view/inspector.js";

document.addEventListener("DOMContentLoaded", () => {
    // --- DOM & Context ---
    const canvasHTML = document.getElementById("canvas-html");

    // --- Initialization ---
    canvasView.init();
    consoleView.init();
    inspectorView.init();
    consoleView.update();
    inspectorView.update();

    // --- Event Listeners ---
    window.addEventListener("resize", () => {
        canvasView.resize();
    });

    canvasHTML.addEventListener("mousedown", (e) => {
        if (panHandler.handleMouseDown(e)) return;
        if (editModeHandler.handleMouseDown(e)) return;
        if (solverModeHandler.handleMouseDown(e)) return;
    });

    window.addEventListener("mousemove", (e) => {
        if (panHandler.handleMouseMove(e)) return;
        if (editModeHandler.handleMouseMove(e)) return;
    });

    window.addEventListener("mouseup", (e) => {
        if (panHandler.handleMouseUp(e)) return;
        if (editModeHandler.handleMouseUp(e)) return;
    });

    canvasHTML.addEventListener("wheel", (e) => {
        if (panHandler.handleWheel(e)) return;
    });

    canvasHTML.addEventListener("contextmenu", (e) => {
        if (editModeHandler.handleContextMenu(e)) return;
    });

    document.addEventListener("keydown", (e) => {
        if (panHandler.handleKeyDown(e)) return;
        if (shortcutHandler.handleKeyDown(e)) return;
    });

    document.addEventListener("keyup", (e) => {
        if (panHandler.handleKeyUp(e)) return;
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
