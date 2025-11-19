import { JSDOM } from "jsdom";
import { Editor, getStarterExtensions } from "@harbour-enterprises/superdoc/super-editor";

type EditorInstance = InstanceType<typeof Editor>;

export interface SuperDocReplacement {
  tokens: string[];
  value: string;
}

export class SuperDocNoReplacementsAppliedError extends Error {
  constructor(message = "SuperDoc could not locate any placeholder tokens to replace.") {
    super(message);
    this.name = "SuperDocNoReplacementsAppliedError";
  }
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

  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>");
  const { document: mockDocument } = dom.window;
  const defaultView = dom.window;

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
    if (replacements.length > 0) {
      const applied = applyReplacements(editor as EditorInstance, replacements);
      if (!applied) {
        throw new SuperDocNoReplacementsAppliedError();
      }
    }
    const output = await editor.exportDocx();
    return Buffer.isBuffer(output) ? output : Buffer.from(output);
  } finally {
    try {
      editor.destroy();
    } catch (destroyError) {
      console.warn("[fillDocxWithSuperDoc] Failed to destroy editor cleanly", destroyError);
    }
    // Avoid calling dom.window.close() so late-stage tasks that still read window.location
    // (e.g. timers spawned inside the editor) do not trip jsdom's internal `_location` getter.
  }
}

function applyReplacements(editor: EditorInstance, replacements: SuperDocReplacement[]): boolean {
  const doc = editor.state.doc;
  const { fullText, segments } = buildTextIndex(doc);
  if (!fullText.length || segments.length === 0) {
    return false;
  }
  const consumedCharRanges: Array<{ start: number; end: number }> = [];
  const operations: Array<{ from: number; to: number; value: string }> = [];
  let charCursor = 0;

  for (const replacement of replacements) {
    const cleanedValue = replacement.value?.trim();
    if (!cleanedValue) {
      continue;
    }

    const tokens = normalizeTokens(replacement.tokens);
    if (tokens.length === 0) {
      continue;
    }

    const charMatch =
      findNextTextMatch(fullText, tokens, consumedCharRanges, charCursor) ??
      findNextTextMatch(fullText, tokens, consumedCharRanges, 0);

    if (!charMatch) {
      continue;
    }

    consumedCharRanges.push(charMatch);
    charCursor = Math.max(charCursor, charMatch.end);
    const from = mapCharOffsetToDocPos(charMatch.start, segments);
    const to = mapCharOffsetToDocPos(charMatch.end, segments);
    if (from == null || to == null || from === to) {
      continue;
    }
    operations.push({ from, to, value: cleanedValue });
  }

  if (operations.length === 0) {
    return false;
  }

  let tr = editor.state.tr;
  for (let index = operations.length - 1; index >= 0; index -= 1) {
    const { from, to, value } = operations[index];
    tr = tr.insertText(value, from, to);
  }
  editor.view.dispatch(tr);
  return true;
}

type MatchRange = { from: number; to: number };

function normalizeTokens(tokens: string[]): string[] {
  return Array.from(
    new Set(
      tokens
        .map((token) => (typeof token === "string" ? token.trim() : ""))
        .filter((token) => token.length > 0)
    )
  );
}

function buildTextIndex(
  doc: EditorInstance["state"]["doc"]
): { fullText: string; segments: Array<{ globalStart: number; globalEnd: number; nodeStart: number }> } {
  let fullText = "";
  const segments: Array<{ globalStart: number; globalEnd: number; nodeStart: number }> = [];
  let globalIndex = 0;

  doc.descendants((node: { isText?: boolean; text?: string }, pos: number) => {
    if (node.isText && typeof node.text === "string" && node.text.length > 0) {
      const text = node.text;
      const globalStart = globalIndex;
      const globalEnd = globalStart + text.length;
      segments.push({ globalStart, globalEnd, nodeStart: pos });
      fullText += text;
      globalIndex = globalEnd;
    }
    return true;
  });

  return { fullText, segments };
}

function mapCharOffsetToDocPos(
  offset: number,
  segments: Array<{ globalStart: number; globalEnd: number; nodeStart: number }>
): number | null {
  for (const segment of segments) {
    if (offset < segment.globalStart) {
      continue;
    }
    if (offset <= segment.globalEnd) {
      const relative = offset - segment.globalStart;
      return segment.nodeStart + relative;
    }
  }
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    return last.nodeStart + (last.globalEnd - last.globalStart);
  }
  return null;
}

function findNextTextMatch(
  fullText: string,
  tokens: string[],
  consumedRanges: Array<{ start: number; end: number }>,
  minStart: number
): { start: number; end: number } | null {
  for (const token of tokens) {
    let index = fullText.indexOf(token, minStart);
    while (index !== -1) {
      const candidate = { start: index, end: index + token.length };
      if (!charRangeOverlaps(consumedRanges, candidate)) {
        return candidate;
      }
      index = fullText.indexOf(token, index + 1);
    }
  }
  return null;
}

function charRangeOverlaps(
  ranges: Array<{ start: number; end: number }>,
  candidate: { start: number; end: number }
): boolean {
  return ranges.some((range) => candidate.start < range.end && candidate.end > range.start);
}
