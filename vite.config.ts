import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { viteSingleFile } from "vite-plugin-singlefile";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    svelte(),
    viteSingleFile(), // sh: npm run build -> 单独的 html，可以直接双击在浏览器中运行],
  ],
});
