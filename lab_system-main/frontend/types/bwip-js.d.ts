declare module 'bwip-js' {
  type ToCanvasOptions = Record<string, unknown>;

  interface BwipJs {
    toCanvas(canvas: HTMLCanvasElement, options: ToCanvasOptions): void;
  }

  const bwipjs: BwipJs;
  export default bwipjs;
}
