<!--
  @component Inspector
  @description The inspector component on the right side of the canvas, refactored for type-safety, declarative style, and separation of concerns.
-->

<script lang="ts">
  import { tick } from "svelte";
  import Modal from "./Modal.svelte";
  import MathText from "./MathText.svelte";
  import { canvas } from "../../store/canvas";
  import { ModeType, AlgorithmType } from "../../types/types";
  import solver from "../../store/solver";
  import { commands } from "../../handler/ui-commands";

  type ModalState =
    | { type: "closed" }
    | { type: "import"; input: string; error: string | null }
    | { type: "export"; data: string };

  let modalState: ModalState = { type: "closed" };
  let importTextareaEl: HTMLTextAreaElement;
  let exportTextareaEl: HTMLTextAreaElement;

  /**
   * 显示 import modal
   */
  function showImportModal() {
    modalState = { type: "import", input: "", error: null };
    tick().then(() => {
      importTextareaEl?.focus();
    });
  }

  /**
   * 显示 export modal
   */
  function showExportModal() {
    const exportData = commands.exportGraph();
    modalState = { type: "export", data: exportData };
    tick().then(() => {
      exportTextareaEl?.focus();
      exportTextareaEl?.select();
    });
  }

  /**
   * 关闭 modal
   */
  function closeModal() {
    modalState = { type: "closed" };
  }

  /**
   * 处理 import 确认操作。尝试从 textarea 导入 base64，如果成功则关闭 modal；否则显示错误信息。
   */
  function handleImportConfirm() {
    if (modalState.type !== "import") return;

    const importResult = commands.importGraph(modalState.input);
    if (importResult.isErr()) {
      modalState = { ...modalState, error: importResult.error };
      tick().then(() => {
        importTextareaEl?.focus();
        importTextareaEl?.select();
      });
    } else {
      modalState = { type: "closed" };
    }
  }

  /**
   * 处理 import 输入操作。在用户输入的时候，清除错误信息。
   */
  function handleImportInput() {
    // 在用户输入的时候，清除错误信息
    if (modalState.type === "import") {
      modalState = { ...modalState, error: null };
    }
  }

  /**
   * 处理 import 输入操作。在用户按下 enter 且没有 shift 键时，调用 handleImportConfirm。
   */
  function handleImportKeyDown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleImportConfirm();
    }
  }
</script>

<div id="inspector-html">
  <h3>
    {$canvas.currentMode === ModeType.EDIT ? "Edit Mode" : "Solver Mode"}
  </h3>

  <!-- Edit Mode -->
  {#if $canvas.currentMode === ModeType.EDIT}
    <div class="info-block">
      <p><b>Controls:</b></p>
      <ul class="info-list">
        <li><b>Left Click:</b> Add Node</li>
        <li><b>Left Drag:</b> Add Edge</li>
        <li><b>Right Click:</b> Invert initial state</li>
      </ul>
    </div>
    <div class="info-block">
      <p><b>Data:</b></p>
      <div class="button-group">
        <button class="button" on:click={showImportModal}>Import</button>
        <button class="button" on:click={showExportModal}>Export</button>
      </div>
    </div>
  {/if}

  <!-- Solver Mode -->
  {#if $canvas.currentMode === ModeType.SOLVER}
    <div class="info-block">
      <p><b>Controls:</b></p>
      <ul class="info-list">
        <li><b>Left Click:</b> Toggle Light</li>
      </ul>
    </div>
    <div class="info-block">
      <p><b>Algorithm:</b></p>
      <ul class="algorithm-list">
        <li>
          <span class="algorithm-arrow"
            >{$solver.algorithm === AlgorithmType.ANY ? "➔" : "·"}</span
          >
          <span class="algorithm-label">Arbitrary:</span>
          <MathText>\(O(n^3)\)</MathText>
        </li>
        <li>
          <span class="algorithm-arrow"
            >{$solver.algorithm === AlgorithmType.MIN_WEIGHT ? "➔" : "·"}</span
          >
          <span class="algorithm-label">Min-Move:</span>
          <MathText>\(O(n^3 + n \cdot 2^k)\)</MathText>
        </li>
      </ul>
    </div>
    <div class="info-block">
      <p><b>Matrix Info:</b></p>
      <ul class="info-list">
        <li>
          <span class="matrix-info-label">Nodes:</span>
          <MathText>
            \(n = {$solver.matrixInfo.n}\)
          </MathText>
        </li>
        <li>
          <span class="matrix-info-label">Null Space Rank:</span>
          <MathText>
            \(k = {$solver.matrixInfo.k}\)
          </MathText>
        </li>
      </ul>
    </div>
    {#if $solver.solution.message}
      <div class="info-block">
        <p><b>Solver Output:</b></p>
        <ul class="info-list">
          <li>{$solver.solution.message}</li>
        </ul>
      </div>
    {/if}
  {/if}
</div>

{#if modalState.type !== "closed"}
  <Modal onClose={closeModal}>
    {#if modalState.type === "import"}
      <!-- 导入图模态框内容 -->
      <div class="modal-content">
        <h3>Import Graph</h3>
        <p>Paste the exported Base64 string below.</p>
        <textarea
          bind:this={importTextareaEl}
          bind:value={modalState.input}
          on:input={handleImportInput}
          on:keydown={handleImportKeyDown}
          placeholder="Base64 string..."
        ></textarea>
        <div class="action-row">
          <span class="error-message">{modalState.error || ""}</span>
          <button on:click={handleImportConfirm}>Import</button>
        </div>
      </div>
    {:else if modalState.type === "export"}
      <!-- 导出数据模态框内容 -->
      <div class="modal-content">
        <h3>Exported Data</h3>
        <p>Copy the Base64 string below.</p>
        <textarea bind:this={exportTextareaEl} value={modalState.data} readonly
        ></textarea>
      </div>
    {/if}
  </Modal>
{/if}

<style>
  /* ================================================================ */
  /* ========================= Shared Styles ======================== */
  /* ================================================================ */

  h3 {
    margin-top: 0;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #cccccc;
  }

  p {
    margin-bottom: 5px;
    font-size: 14px;
    color: #333333;
  }

  button {
    padding: 8px 10px;
    font-size: 14px;
    background-color: #e0e0e0;
    border: 1px solid #cccccc;
    border-radius: 4px;
    cursor: pointer;
    text-align: center;
  }

  button:hover {
    background-color: #d4d4d4;
  }

  /* ================================================================ */
  /* ======================== Inspector Styles ====================== */
  /* ================================================================ */
  #inspector-html {
    position: absolute;
    top: 120px;
    right: 20px;
    width: 300px;
    max-height: calc(100vh - 100px);
    background-color: #f0f0f0;
    border: 1px solid #cccccc;
    border-radius: 6px;
    z-index: 5;
    padding: 20px;
    box-sizing: border-box;
    overflow-y: auto;
  }

  /* Shared Block and List Styles */
  #inspector-html .info-block {
    margin-top: 10px;
  }

  #inspector-html .info-list,
  #inspector-html .algorithm-list {
    margin-top: 5px;
    font-size: 14px;
    color: #333333;
    padding-left: 20px;
  }

  #inspector-html .algorithm-list {
    list-style: none;
    padding-left: 0;
  }

  /* Interactive Elements */
  #inspector-html .button-group {
    display: flex;
    gap: 10px;
    margin-top: 10px;
  }

  #inspector-html .button-group button {
    flex: 1;
  }

  /* -> 的样式 */
  #inspector-html .algorithm-arrow {
    display: inline-block;
    width: 1.5em;
    text-align: center;
  }

  /* 包裹在标签外部，用于对齐 n 和 k 的 katex */
  #inspector-html .algorithm-label {
    display: inline-block;
    width: 5.5em;
  }

  /* 包裹在标签外部，用于对齐 n 和 k 的 katex */
  #inspector-html .matrix-info-label {
    display: inline-block;
    width: 8.5em;
  }

  /* ================================================================ */
  /* ====================== Modal Content Styles ==================== */
  /* ================================================================ */

  .modal-content textarea {
    width: 100%;
    min-height: 120px;
    margin-top: 5px;
    padding: 8px;
    font-size: 14px;
    font-family: monospace;
    background-color: #ffffff;
    border: 1px solid #cccccc;
    border-radius: 4px;
    box-sizing: border-box;
    resize: none; /* 禁止用户调整大小 */
  }

  .modal-content .action-row {
    display: flex;
    align-items: center;
    margin-top: 10px;
  }

  .modal-content .error-message {
    flex: 1;
    height: 1.2em;
    font-size: 14px;
    color: #a83232;
    text-align: left;
    margin: 0;
    padding-right: 15px; /* Adds space between message and button */
  }

  /* The import button in the modal has a fixed width. */
  .modal-content button {
    flex: 0 0 auto; /* Pushes the button to the right */
    width: 80px;
  }
</style>
