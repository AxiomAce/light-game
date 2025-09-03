// 解决 import *.svg 文件的报错问题
declare module "*.svg" {
  const content: string;
  export default content;
}
