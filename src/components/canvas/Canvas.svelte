<script lang="ts">
  import { get } from "svelte/store";
  import { onMount, onDestroy } from "svelte";
  import { CanvasRenderer } from "./canvas-renderer";
  import { canvas } from "../../store/canvas";
  import {
    startInteractionMachines,
    canvasMachineActor,
    MachineState,
    canvasMachineStore,
  } from "../../handler/canvas-fsm";
  import { clientPos2WorldPos } from "../../service/canvas-geometry";

  let canvasEl: HTMLCanvasElement;
  let canvasRenderer: CanvasRenderer;
  let rafId: number;

  let lastMouseWorldPos: { x: number; y: number } = { x: 0, y: 0 };

  // 计算鼠标坐标的辅助函数
  function getMousePositions(e: MouseEvent) {
    const mouseClientPos = { x: e.clientX, y: e.clientY };
    const canvasClientRect = canvasEl.getBoundingClientRect();
    const canvasState = get(canvas);
    const mouseWorldPos = clientPos2WorldPos(
      mouseClientPos,
      canvasClientRect,
      canvasState.viewClientOffset,
      canvasState.zoomRatio,
    );
    return { mouseClientPos, mouseWorldPos };
  }

  $: cursor =
    $canvasMachineStore.value === MachineState.Panning
      ? "grabbing"
      : $canvasMachineStore.value === MachineState.PreparePanning
        ? "grab"
        : "default";

  function handleMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    const { mouseClientPos, mouseWorldPos } = getMousePositions(e);
    lastMouseWorldPos = mouseWorldPos;

    // 发送统一的鼠标按下事件到合并的状态机
    canvasMachineActor.send({
      category: "MOUSE_EVENT",
      type: "LEFT_MOUSE_DOWN",
      mouseClientPos,
      mouseWorldPos,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    });
  }

  function onWindowMouseMove(e: MouseEvent) {
    const { mouseClientPos, mouseWorldPos } = getMousePositions(e);
    lastMouseWorldPos = mouseWorldPos;

    canvasMachineActor.send({
      category: "MOUSE_EVENT",
      type: "MOUSE_MOVE",
      mouseClientPos,
      mouseWorldPos,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    });
  }

  function onWindowMouseUp(e: MouseEvent) {
    if (e.button !== 0) return;
    const { mouseClientPos, mouseWorldPos } = getMousePositions(e);
    lastMouseWorldPos = mouseWorldPos;

    canvasMachineActor.send({
      category: "MOUSE_EVENT",
      type: "LEFT_MOUSE_UP",
      mouseClientPos,
      mouseWorldPos,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    });
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const vo = get(canvas).viewClientOffset;
    canvas.setViewClientOffset({ x: vo.x - e.deltaX, y: vo.y - e.deltaY });
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    const { mouseClientPos, mouseWorldPos } = getMousePositions(e);

    canvasMachineActor.send({
      category: "MOUSE_EVENT",
      type: "CONTEXT_MENU",
      mouseClientPos,
      mouseWorldPos,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      metaKey: e.metaKey,
    });
  }

  function onDocumentKeyDown(e: KeyboardEvent) {
    if (e.key === "Alt") {
      canvasMachineActor.send({ category: "KEY_EVENT", type: "ALT_DOWN" });
    }
    if (e.key === "Escape") {
      e.preventDefault();
      canvasMachineActor.send({ category: "KEY_EVENT", type: "ESC_DOWN" });
    }
  }

  function onDocumentKeyUp(e: KeyboardEvent) {
    if (e.key === "Alt") {
      canvasMachineActor.send({ category: "KEY_EVENT", type: "ALT_UP" });
    }
  }

  function handleResize() {
    canvasRenderer.setupCanvas();
  }

  onMount(() => {
    canvasRenderer = new CanvasRenderer(canvasEl);
    canvasRenderer.setupCanvas();

    startInteractionMachines();

    window.addEventListener("resize", handleResize);
    window.addEventListener("mousemove", onWindowMouseMove);
    window.addEventListener("mouseup", onWindowMouseUp);
    document.addEventListener("keydown", onDocumentKeyDown);
    document.addEventListener("keyup", onDocumentKeyUp);

    // Use non-passive wheel listener so preventDefault works reliably
    canvasEl.addEventListener("wheel", handleWheel, { passive: false });
    canvasEl.addEventListener("mousedown", handleMouseDown);
    canvasEl.addEventListener("contextmenu", handleContextMenu);

    const loop = () => {
      canvasRenderer.draw(lastMouseWorldPos);
      rafId = requestAnimationFrame(loop);
    };
    loop();
  });

  onDestroy(() => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("mousemove", onWindowMouseMove);
    window.removeEventListener("mouseup", onWindowMouseUp);
    document.removeEventListener("keydown", onDocumentKeyDown);
    document.removeEventListener("keyup", onDocumentKeyUp);
    canvasEl.removeEventListener("wheel", handleWheel);
    canvasEl.removeEventListener("mousedown", handleMouseDown);
    canvasEl.removeEventListener("contextmenu", handleContextMenu);
  });
</script>

<canvas id="canvas-html" bind:this={canvasEl} style={`cursor: ${cursor};`}
></canvas>

<style>
  /* 使画布占满视口并位于底层背景 */
  #canvas-html {
    display: block;
    width: 100vw;
    height: 100vh;
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
  }
</style>
