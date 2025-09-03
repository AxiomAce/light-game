<!--
  @component MathText
  @description A component to render math formulas using KaTeX within its slot.
  It automatically detects and renders math expressions on mount and after updates.
-->

<script lang="ts">
  import type { Snippet } from "svelte";
  import renderMathInElement from "katex/dist/contrib/auto-render";
  import "katex/dist/katex.min.css";

  let { children }: { children: Snippet } = $props();

  let el: HTMLElement;

  function renderMath() {
    if (el) {
      renderMathInElement(el, {
        delimiters: [
          { left: "\\(", right: "\\)", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "$$", right: "$$", display: true },
        ],
      });
    }
  }

  $effect(renderMath);
</script>

<span bind:this={el} style="display: contents;">
  {@render children()}
</span>
