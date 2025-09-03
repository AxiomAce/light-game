import { writable, derived, get } from "svelte/store";
import type { Writable, Readable } from "svelte/store";

/**
 * [类型工具]：黑魔法。展开复杂类型以优化 IDE 提示，本身无意义。
 */
type Prettify<T> = { [K in keyof T]: T[K] } & {};

/**
 * [类型工具]：从一个 Readable store 数组类型中，提取出它们所包含的值的元组类型。
 * @example StoreValues<[Readable<string>, Readable<number>]> -> [string, number]
 */
type StoreValues<T extends readonly Readable<any>[]> = {
  [K in keyof T]: T[K] extends Readable<infer U> ? U : never;
};

/**
 * 创建一个包含衍生属性和自定义方法的、类型全自动推导的增强型 Svelte Store。
 * @param config 一个配置对象
 * - `sources`      核心状态
 * - `dependencies` 外部 store 依赖数组
 * - `deriveds`     衍生状态计算函数，可以依赖 sources 和 dependencies
 * - `methods`      自定义方法
 */
export function createEnhancedStore<
  TSources extends object,
  const TExtStores extends readonly Readable<any>[],
  const TDeriveds extends object,
  const TMethods extends Record<string, (...args: any[]) => any>
>(config: {
  sources: TSources;
  dependencies: TExtStores;
  deriveds: (
    state: TSources,
    dependencies: StoreValues<TExtStores>
  ) => TDeriveds;
  methods: (helpers: {
    update: Writable<TSources>["update"];
    set: Writable<TSources>["set"];
    getStore: () => Prettify<TSources & TDeriveds>;
  }) => TMethods;
}) {
  // --- 根据 sources 创建 Writable store ---
  const store = writable(config.sources);
  const { update, set } = store;

  // --- 从内部 store 和所有外部 store 派生出 extendedStore ---
  const extendedStore = derived(
    [store, ...config.dependencies],
    ([$state, ...$dependencies]) => {
      // 调用用户提供的 deriveds 函数，传入内部和外部的状态值
      const derivedValues = config.deriveds(
        $state,
        $dependencies as StoreValues<TExtStores>
      );
      return {
        ...$state,
        ...derivedValues,
      };
    }
  );

  // --- 根据 methods 添加自定义方法 ---
  const customMethods = config.methods({
    update,
    set,
    getStore: () => get(extendedStore),
  });

  return {
    subscribe: extendedStore.subscribe,
    ...customMethods,
  } as Readable<Prettify<TSources & TDeriveds>> & TMethods;
}
