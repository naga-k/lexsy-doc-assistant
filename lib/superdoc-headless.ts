type SuperDocModule = typeof import("@harbour-enterprises/superdoc/super-editor");
type EditorConstructor = SuperDocModule["Editor"];
type SuperDocEditorInstance = EditorConstructor extends new (...args: any[]) => infer T ? T : never;
type JsDomModule = typeof import("jsdom");

export interface SuperDocReplacement {
  tokens: string[];
  value: string;
}

let superDocModulePromise: Promise<SuperDocModule> | null = null;
function loadSuperDocModule(): Promise<SuperDocModule> {
  if (!superDocModulePromise) {
    superDocModulePromise = import("@harbour-enterprises/superdoc/super-editor");
  }
  return superDocModulePromise;
}

let jsdomModulePromise: Promise<JsDomModule> | null = null;
function loadJsdomModule(): Promise<JsDomModule> {
  if (!jsdomModulePromise) {
    jsdomModulePromise = import("jsdom");
  }
  return jsdomModulePromise;
}

export async function fillDocxWithSuperDoc(
  templateBuffer: Buffer,
  replacements: SuperDocReplacement[]
): Promise<Buffer> {
  if (!Buffer.isBuffer(templateBuffer)) {
    throw new Error("fillDocxWithSuperDoc requires a DOCX Buffer input.");
  }
  if (!replacements.length) {
    return templateBuffer;
  }

  const [{ Editor, getStarterExtensions }, { JSDOM }] = await Promise.all([
    loadSuperDocModule(),
    loadJsdomModule(),
  ]);

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const { document: mockDocument, defaultView } = dom.window;
  if (!defaultView) {
    dom.window.close();
    throw new Error("Unable to initialize JSDOM window for SuperDoc.");
  }

  const [content, mediaFiles, mediaFilesBase64, fonts] = await Editor.loadXmlData(
    templateBuffer,
    true
  );

  const editor = new Editor({
    isHeadless: true,
    mockDocument,
    mockWindow: defaultView,
    extensions: getStarterExtensions(),
    content,
    mediaFiles: (mediaFilesBase64 ?? mediaFiles) || {},
    fonts: fonts || {},
    fileSource: templateBuffer,
    documentId: `lexsy-fill-${Date.now().toString(36)}`,
  });

  try {
    applyReplacements(editor as SuperDocEditorInstance, replacements);
    const output = await editor.exportDocx();
    return Buffer.isBuffer(output) ? output : Buffer.from(output);
  } finally {
    editor.destroy();
    dom.window.close();
  }
}

function applyReplacements(editor: SuperDocEditorInstance, replacements: SuperDocReplacement[]): void {
  for (const replacement of replacements) {
    const cleanedValue = replacement.value?.trim();
    if (!cleanedValue) continue;

    const tokens = Array.from(
      new Set(replacement.tokens.map((token) => (typeof token === "string" ? token.trim() : "")))
    ).filter(Boolean);

    if (!tokens.length) continue;

    let applied = false;
    for (const token of tokens) {
      applied = replaceAllOccurrences(editor, token, cleanedValue);
      if (applied) break;
    }
  }
}

function replaceAllOccurrences(
  editor: SuperDocEditorInstance,
  target: string,
  value: string
): boolean {
  if (!target) return false;

  const matches: Array<{ from: number; to: number }> = [];
  const doc = editor.state.doc;

  doc.descendants((node: { isText?: boolean; text?: string }, pos: number) => {
    if (!node.isText || typeof node.text !== "string") {
      return true;
    }

    let searchIndex = 0;
    while (searchIndex <= node.text.length) {
      const foundIndex = node.text.indexOf(target, searchIndex);
      if (foundIndex === -1) {
        break;
      }
      matches.push({
        from: pos + foundIndex,
        to: pos + foundIndex + target.length,
      });
      searchIndex = foundIndex + target.length;
    }

    return true;
  });

  if (!matches.length) {
    return false;
  }

  let { tr } = editor.state;
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const { from, to } = matches[index];
    tr = tr.insertText(value, from, to);
  }
  editor.view.dispatch(tr);
  return true;
}
