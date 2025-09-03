declare module "katex/dist/contrib/auto-render" {
  /**
   * Options for KaTeX auto-rendering.
   */
  interface AutoRenderOptions {
    /**
     * A list of delimiters to look for.
     */
    delimiters?: { left: string; right: string; display: boolean }[];
    /**
     * A list of DOM node types to ignore when recursing.
     */
    ignoredTags?: string[];
    /**
     * A list of CSS classes to ignore when recursing.
     */
    ignoredClasses?: string[];
    /**
     * A callback function to call on KaTeX errors.
     */
    errorCallback?: (msg: string, err: Error) => void;
    /**
     * If true, KaTeX errors will be thrown.
     */
    throwOnError?: boolean;
  }

  /**
   * Renders math in an element and its children.
   * @param element The DOM element to render math in.
   * @param options The options for auto-rendering.
   */
  function renderMathInElement(
    element: HTMLElement,
    options?: AutoRenderOptions
  ): void;

  export default renderMathInElement;
}
