import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [
    viteSingleFile() // sh: npm run build -> 单独的 html，可以直接双击在浏览器中运行
  ],
})