<!--
  @component Dropdown
  @description 控制台下拉菜单组件
-->

<script lang="ts">
  import Button from "./Button.svelte";
  import type { ComponentProps } from "svelte";

  // Constants
  const DROPDOWN_TRIGGER_ICON = "▼";

  // Props
  export let text = "";
  export let id = "";
  export let icon = ""; // 订阅式：直接传入图标值（由父组件响应式计算）
  export let enabled = true; // 重构：直接传递布尔值
  export let subButtons: ComponentProps<Button>[] = [];
</script>

<div class="dropdown-container" class:disabled={!enabled} data-key={id}>
  <Button
    {text}
    {id}
    {icon}
    shortcutText={DROPDOWN_TRIGGER_ICON}
    {enabled}
    dropdownTrigger={true}
  />

  <div class="dropdown-options">
    {#each subButtons as buttonConfig}
      <Button
        text={buttonConfig.text}
        id={buttonConfig.id}
        icon={buttonConfig.icon}
        onClick={buttonConfig.onClick}
        enabled={buttonConfig.enabled ?? true}
      />
    {/each}
  </div>
</div>

<style>
  /*
   * 下拉菜单组件的容器。
   */
  .dropdown-container {
    position: relative;
    display: inline-block;
  }

  /* 触发器复用 Button 样式，无需在此重复声明 */

  /*
   * 下拉菜单的选项面板，默认隐藏。
   */
  .dropdown-options {
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: #000000;
    padding: 0;
    border-radius: 0 0 6px 6px;
    z-index: 11;
    display: flex;
    flex-direction: row;
    gap: 0;
    visibility: hidden;
    opacity: 0;
    overflow: hidden;
  }

  /*
   * 鼠标悬停在下拉菜单容器上时，显示选项面板。
   */
  .dropdown-container:hover .dropdown-options {
    visibility: visible;
    opacity: 1;
  }

  /*
   * 确保禁用的下拉菜单在悬停时不会显示选项。
   */
  .dropdown-container.disabled:hover .dropdown-options {
    visibility: hidden;
    opacity: 0;
  }

  /* 禁用整个容器的指针事件，防止误触 */
  .dropdown-container.disabled {
    pointer-events: none;
  }
</style>
