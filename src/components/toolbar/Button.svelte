<!--
  @component Button
  @description 控制台按钮组件
-->

<script lang="ts">
  interface Shortcut {
    keys?: string[];
    code?: string;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
  }

  // Props
  /** 标题 */
  export let text = "";
  /** 唯一标识符 */
  export let id = "";
  /** 图标 */
  export let icon = "";
  /** 快捷键文本 */
  export let shortcutText = "";
  /** 点击回调 */
  export let onClick: () => boolean = () => true;
  /** 是否启用 */
  export let enabled = true;
  /** 快捷键 */
  export let shortcut: Shortcut | null = null;
  /** 是否作为下拉触发器使用 */
  export let dropdownTrigger = false;

  // State
  /** 按钮元素 */
  let buttonEl: HTMLButtonElement;
  /** 按钮当前动画 (Web Animations API) */
  let currentAnimation: Animation | null = null;

  // 检测操作系统
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac|iPod|iPhone|iPad/.test(navigator.userAgent);

  // 处理按钮点击
  function handleClick(e: MouseEvent) {
    if (enabled) {
      onClick();
    }
  }

  // 处理快捷键
  function handleShortcut(e: KeyboardEvent): boolean {
    if (!shortcut) return false;

    const metaPressed = isMac ? e.metaKey : e.ctrlKey;
    const wantMeta = shortcut.meta ?? false;

    let keyMatch = false;
    if (shortcut.keys) {
      keyMatch = shortcut.keys.includes(e.key);
    } else if (shortcut.code) {
      keyMatch = e.code === shortcut.code;
    }

    if (
      keyMatch &&
      metaPressed === wantMeta &&
      e.shiftKey === (shortcut.shift ?? false) &&
      e.altKey === (shortcut.alt ?? false)
    ) {
      e.preventDefault();

      // 检查按钮是否处于激活状态
      if (!enabled) {
        return true; // 匹配但禁用，消费事件但什么都不做
      }

      // 执行点击并闪烁效果
      const result = onClick();
      if (result) {
        triggerFlash();
      }
      return true; // 事件已处理
    }

    return false;
  }

  // 触发闪烁效果
  function triggerFlash() {
    if (buttonEl) {
      // 取消之前的动画
      if (currentAnimation) {
        currentAnimation.cancel();
      }

      // 使用 Web Animations API 创建闪烁动画
      currentAnimation = buttonEl.animate(
        [
          { backgroundColor: "#007bff", offset: 0 },
          { backgroundColor: "transparent" },
        ],
        {
          duration: 600,
          easing: "ease-out",
        },
      );
    }
  }

  export { handleShortcut };
</script>

<button
  bind:this={buttonEl}
  class="toolbar-button"
  class:disabled={!enabled}
  class:dropdown-trigger={dropdownTrigger}
  data-key={id}
  on:click={handleClick}
>
  <div class="toolbar-button-title">{text}</div>
  <div class="toolbar-button-icon-container">
    {#if icon}
      <img src={icon} alt="" class="toolbar-button-icon" draggable="false" />
    {/if}
  </div>
  <div class="toolbar-button-subtitle">{shortcutText}</div>
</button>

<style>
  /*
   * 控制台内通用按钮的基本样式。
   */
  .toolbar-button {
    background-color: transparent;
    color: #ffffff;
    border: none;
    padding: 6px;
    border-radius: 0;
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    width: 72px;
    height: 72px;
    box-sizing: border-box;
    -webkit-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  /*
   * 控制台按钮顶部的标题文本。
   */
  .toolbar-button-title {
    font-size: 9px;
    text-align: center;
  }

  /*
   * 控制台按钮底部的副标题，用于显示快捷键或下拉提示。
   */
  .toolbar-button-subtitle {
    font-size: 9px;
    height: 1.1em; /* 为元素预留高度，防止内容变化时布局抖动 */
    text-align: center;
  }

  /*
   * 控制台按钮中央图标的容器，用于垂直居中。
   */
  .toolbar-button-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
  }

  /*
   * 控制台按钮图标的具体样式。
   */
  .toolbar-button-icon {
    width: 28px;
    height: 28px;
    pointer-events: none; /* 防止图标成为鼠标事件的目标，从而避免被拖拽 */
  }

  /*
   * 控制台按钮的悬停效果。
   */
  .toolbar-button:hover {
    background-color: #333333;
  }

  /*
   * 控制台按钮被按下时的效果 (不包括下拉菜单的触发器)。
   */
  .toolbar-button:not(.dropdown-trigger):active {
    background-color: #007bff;
  }

  /*
   * 禁用状态下的按钮样式。
   */
  .toolbar-button.disabled {
    background-color: transparent;
    color: #666666;
    cursor: not-allowed;
    pointer-events: none;
  }

  /*
   * 禁用状态下，使按钮内的图标颜色变浅。
   */
  .toolbar-button.disabled .toolbar-button-icon {
    opacity: 0.4;
  }

  /*
   * 禁用状态下，使按钮内的标题文字颜色变浅。
   */
  .toolbar-button.disabled .toolbar-button-title {
    color: #666666;
  }

  /*
   * 禁用状态下，使按钮内的副标题文字颜色变浅。
   */
  .toolbar-button.disabled .toolbar-button-subtitle {
    color: #555555;
  }

  /*
   * 覆盖禁用按钮的悬停效果，以防止视觉变化。
   */
  .toolbar-button.disabled:hover {
    background-color: transparent;
  }
</style>
