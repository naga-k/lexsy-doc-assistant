declare module "@harbour-enterprises/superdoc/super-editor" {
  export * from "@harbour-enterprises/superdoc/dist/super-editor/super-editor/src/index.js";

  const Editor: typeof import("@harbour-enterprises/superdoc/dist/super-editor/super-editor/src/core/Editor.js").Editor;
  const getStarterExtensions: typeof import("@harbour-enterprises/superdoc/dist/super-editor/super-editor/src/extensions/index.js").getStarterExtensions;

  export { Editor, getStarterExtensions };
}
