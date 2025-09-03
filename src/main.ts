/**
 * @file 应用主入口和协调器
 * @description Svelte 应用的入口点
 */

import { mount } from "svelte";
import App from "./App.svelte";
import "./global.css";

const app = mount(App, {
  target: document.body,
});

export default app;
