<!--
  @component Modal
  @description 一个通用的模态框组件，用于显示覆盖层和可插入的内容。
-->
<script lang="ts">
  export let onClose: () => void;

  /** 记录鼠标是否在背景遮罩上按下。*/
  let isMouseDownOnBackdrop = false;

  /**
   * 当按下 Escape 键时关闭模态框。
   * @param {KeyboardEvent} e - 键盘事件。
   */
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    e.stopPropagation();
  }

  /**
   * 当鼠标在背景遮罩上按下时，记录状态。
   * @param {MouseEvent} e - 鼠标事件。
   */
  function handleMouseDown(e: MouseEvent) {
    // 仅当事件直接发生在背景上时才记录
    if (e.target === e.currentTarget) {
      isMouseDownOnBackdrop = true;
    }
  }

  /**
   * 当鼠标在背景遮罩上释放时，如果按下动作也始于遮罩，则关闭模态框。
   * @param {MouseEvent} e - 鼠标事件。
   */
  function handleMouseUp(e: MouseEvent) {
    if (isMouseDownOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
    isMouseDownOnBackdrop = false;
  }
</script>

<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  tabindex="-1"
  on:mousedown={handleMouseDown}
  on:mouseup={handleMouseUp}
  on:keydown={handleKeydown}
>
  <div class="modal">
    <slot />
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    z-index: 100; /* 确保它在最上层 */
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal {
    background: #f0f0f0;
    padding: 20px;
    border-radius: 8px;
    border: 1px solid #cccccc;
    width: 500px;
    max-width: 90%;
    color: #333333;
    /* box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); */
  }
</style>
