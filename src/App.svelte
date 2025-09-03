<!--
  @component App
  @description 主应用组件，管理整个应用的布局和组件
-->

<script>
  import Toolbar from "./components/toolbar/Toolbar.svelte";
  import Inspector from "./components/inspector/Inspector.svelte";
  import Canvas from "./components/canvas/Canvas.svelte";
</script>

<Canvas />
<Toolbar />
<Inspector />
