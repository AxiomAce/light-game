<!--
  @component Toolbar
  @description 控制台主组件，管理所有按钮和下拉菜单
-->

<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import Button from "./Button.svelte";
  import Dropdown from "./Dropdown.svelte";

  // 导入依赖模块
  import { canvas } from "../../store/canvas";
  import { ModeType, AlgorithmType } from "../../types/types";
  import { commands } from "../../handler/ui-commands";
  import solver from "../../store/solver";
  import history from "../../store/history";
  import { graph } from "../../store/graph";
  import { GridType, GraphElementType } from "../../types/types";
  import { ICONS } from "../../assets/icons";
  import { MachineState, canvasMachineStore } from "../../handler/canvas-fsm";

  // Constants
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);
  const MOD_KEY_PRIMARY = isMac ? "⌘" : "⌃";
  const MOD_KEY_SHIFT = "⇧";
  const MOD_KEY_DELETE = "⌫";

  // State
  // 使用 XState 机器的 phase 来计算是否处于拖拽/平移中
  $: isPanDragging = $canvasMachineStore.value === MachineState.Panning;
  $: isEditDragging =
    $canvasMachineStore.value === MachineState.DraggingFromNode ||
    $canvasMachineStore.value === MachineState.BoxSelecting;

  $: isNotDragging = !(isPanDragging || isEditDragging);
  $: isTransparent = !isNotDragging;

  let uiElementRefs: (Button | Dropdown)[] = [];

  // UI元素配置（依赖式构造，确保订阅式访问触发更新）
  $: uiElements = [
    {
      type: "button",
      config: {
        text: "Zoom Out",
        id: "zoom-out",
        shortcutText: `${MOD_KEY_PRIMARY}-`,
        icon: ICONS.ZOOM_OUT,
        onClick: commands.zoomOut,
        enabled: $canvas.canZoomOut && isNotDragging,
        shortcut: { keys: ["-", "_"], meta: true },
      },
    },

    {
      type: "button",
      config: {
        text: "Zoom In",
        id: "zoom-in",
        shortcutText: `${MOD_KEY_PRIMARY}+`,
        icon: ICONS.ZOOM_IN,
        onClick: commands.zoomIn,
        enabled: $canvas.canZoomIn && isNotDragging,
        shortcut: { keys: ["=", "+"], meta: true },
      },
    },

    {
      type: "dropdown",
      config: {
        text: "Mode",
        id: "mode",
        icon:
          $canvas.currentMode === ModeType.EDIT
            ? ICONS.MODE_EDIT
            : ICONS.MODE_SOLVER,
        enabled: isNotDragging,
        subButtons: [
          {
            text: "Edit",
            id: "mode-edit",
            icon: ICONS.MODE_EDIT,
            onClick: () => commands.switchToEditMode(),
            enabled: $canvas.currentMode !== ModeType.EDIT,
          },

          {
            text: "Solver",
            id: "mode-solver",
            icon: ICONS.MODE_SOLVER,
            onClick: () => commands.switchToSolverMode(),
            enabled: $canvas.currentMode !== ModeType.SOLVER,
          },
        ],
      },
    },

    {
      type: "dropdown",
      config: {
        text: "Grid",
        id: "grid",
        icon:
          $graph.grid === GridType.SQUARE
            ? ICONS.GRID_SQUARE
            : ICONS.GRID_TRIANGLE,
        enabled: isNotDragging && $canvas.currentMode === ModeType.EDIT,
        subButtons: [
          {
            text: "Square",
            id: "grid-square",
            icon: ICONS.GRID_SQUARE,
            onClick: () => commands.changeLayout(GridType.SQUARE),
            enabled: $graph.grid !== GridType.SQUARE,
          },

          {
            text: "Triangle",
            id: "grid-triangle",
            icon: ICONS.GRID_TRIANGLE,
            onClick: () => commands.changeLayout(GridType.TRIANGULAR),
            enabled: $graph.grid !== GridType.TRIANGULAR,
          },
        ],
      },
    },

    { type: "separator" },

    {
      type: "button",
      config: {
        text: "Undo",
        id: "undo",
        shortcutText: `${MOD_KEY_PRIMARY}Z`,
        icon: ICONS.UNDO,
        onClick: commands.undo,
        enabled:
          isNotDragging &&
          $history.canUndo &&
          $canvas.currentMode === ModeType.EDIT,
        shortcut: { code: "KeyZ", meta: true, shift: false },
      },
    },

    {
      type: "button",
      config: {
        text: "Redo",
        id: "redo",
        shortcutText: `${MOD_KEY_PRIMARY}${MOD_KEY_SHIFT}Z`,
        icon: ICONS.REDO,
        onClick: commands.redo,
        enabled:
          isNotDragging &&
          $history.canRedo &&
          $canvas.currentMode === ModeType.EDIT,
        shortcut: { code: "KeyZ", meta: true, shift: true },
      },
    },

    {
      type: "button",
      config: {
        text: "Select All",
        id: "select-all",
        shortcutText: `${MOD_KEY_PRIMARY}A`,
        icon: ICONS.SELECT_ALL,
        onClick: commands.selectAll,
        enabled:
          isNotDragging &&
          $canvas.currentMode === ModeType.EDIT &&
          !$graph.isEmpty,
        shortcut: { code: "KeyA", meta: true, shift: false },
      },
    },

    {
      type: "dropdown",
      config: {
        text: "Initial State",
        id: "init-state",
        icon: ICONS.INIT_STATE,
        enabled:
          isNotDragging &&
          $canvas.currentMode === ModeType.EDIT &&
          $canvas.selectedElements.some(
            (sel) => sel.type === GraphElementType.NODE,
          ),
        subButtons: [
          {
            text: "Invert",
            id: "init-state-invert",
            icon: ICONS.INIT_STATE_INVERT,
            onClick: commands.initInvertSelection,
            enabled:
              isNotDragging &&
              $canvas.currentMode === ModeType.EDIT &&
              $canvas.selectedElements.some(
                (sel) => sel.type === GraphElementType.NODE,
              ),
          },

          {
            text: "Turn Off",
            id: "init-state-turn-off",
            icon: ICONS.INIT_STATE_TURN_OFF,
            onClick: commands.initTurnOffSelection,
            enabled:
              isNotDragging &&
              $canvas.currentMode === ModeType.EDIT &&
              $canvas.selectedElements.some(
                (sel) =>
                  sel.type === GraphElementType.NODE && sel.element.initialOn,
              ),
          },
        ],
      },
    },

    {
      type: "button",
      config: {
        text: "Delete",
        id: "delete",
        shortcutText: MOD_KEY_DELETE,
        icon: ICONS.DELETE,
        onClick: commands.deleteSelectedElements,
        enabled:
          isNotDragging &&
          $canvas.currentMode === ModeType.EDIT &&
          $canvas.selectedElements.length > 0,
        shortcut: { keys: ["Backspace", "Delete"] },
      },
    },

    { type: "separator" },

    {
      type: "dropdown",
      config: {
        text: "Algorithm",
        id: "algorithm",
        icon: ICONS.ALGORITHM,
        enabled: $canvas.currentMode === ModeType.SOLVER,
        subButtons: [
          {
            text: "Arbitrary",
            id: "algo-any",
            icon: ICONS.ALGORITHM_ARBITRARY,
            onClick: () => commands.solveCurrentPuzzleBy(AlgorithmType.ANY),
            enabled: $solver.algorithm !== AlgorithmType.ANY,
          },

          {
            text: "Min-Move",
            id: "algo-min-weight",
            icon: ICONS.ALGORITHM_MIN_MOVE,
            onClick: () =>
              commands.solveCurrentPuzzleBy(AlgorithmType.MIN_WEIGHT),
            enabled: $solver.algorithm !== AlgorithmType.MIN_WEIGHT,
          },
        ],
      },
    },

    {
      type: "button",
      config: {
        text: "Restart",
        id: "restart",
        icon: ICONS.RESTART,
        onClick: commands.restartPuzzle,
        enabled: $canvas.currentMode === ModeType.SOLVER,
      },
    },
  ];

  // 全局快捷键处理
  function handleKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    const targetTagName = target.tagName.toUpperCase();
    if (targetTagName === "INPUT" || targetTagName === "TEXTAREA") {
      return;
    }

    // 检查所有按钮组件的快捷键
    for (const ref of uiElementRefs) {
      if (ref && ref.handleShortcut && ref.handleShortcut(e)) {
        return; // 事件已被按钮处理
      }
    }
  }

  // 组件挂载时设置事件监听器
  onMount(() => {
    document.addEventListener("keydown", handleKeydown);
  });

  // 组件销毁时清理事件监听器
  onDestroy(() => {
    document.removeEventListener("keydown", handleKeydown);
  });
</script>

<div id="toolbar-html" class:transparent={isTransparent}>
  {#each uiElements as element, index}
    {#if element.type === "button"}
      <Button bind:this={uiElementRefs[index]} {...element.config} />
    {:else if element.type === "dropdown"}
      <Dropdown bind:this={uiElementRefs[index]} {...element.config} />
    {:else if element.type === "separator"}
      <div class="toolbar-separator"></div>
    {/if}
  {/each}
</div>

<style>
  /*
   * 控制台容器的整体样式，实现居中、黑色背景和圆角。
   */
  #toolbar-html {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #000000;
    color: #ffffff;
    padding: 0;
    border-radius: 8px;
    z-index: 10;
    display: flex;
    gap: 0;
    align-items: center;
    -webkit-user-select: none; /* Safari */
    -ms-user-select: none; /* IE 10+ */
    user-select: none; /* Standard syntax */
  }

  /*
   * 在拖拽过程中，控制台变为半透明且不可交互。
   */
  #toolbar-html.transparent {
    opacity: 0.4;
    pointer-events: none;
  }

  /*
   * 为控制台的首个和末尾元素设置圆角，使其整体呈圆角矩形。
   */
  #toolbar-html > :global(.toolbar-button:first-child),
  #toolbar-html > :global(.dropdown-container:first-child > .dropdown-trigger) {
    border-radius: 8px 0 0 8px;
  }

  #toolbar-html > :global(.toolbar-button:last-child),
  #toolbar-html > :global(.dropdown-container:last-child > .dropdown-trigger) {
    border-radius: 0 8px 8px 0;
  }

  /*
   * 控制台内功能组之间的垂直分割线。
   */
  .toolbar-separator {
    width: 2px;
    align-self: stretch;
    background-color: #555555;
    margin: 0;
  }
</style>
