import JSZip from "jszip";
import mammoth from "mammoth";

export async function extractRawText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value ?? "";
}

export interface DocxFillResult {
  buffer: Buffer;
  replacementsApplied: boolean;
  appliedCount: number;
}

export async function fillDocxTemplate(
  buffer: Buffer,
  replacements: Array<{ raw: string; value: string }>
): Promise<DocxFillResult> {
  const zip = await JSZip.loadAsync(buffer);
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("word/document.xml not found in template");
  }
  let xml = await document.async("text");
  let replacementsApplied = false;
  let appliedCount = 0;

  for (const { raw, value } of replacements) {
    if (!value || !raw) continue;
    const safeValue = escapeXml(value);
    const sanitizedRaw = escapeXml(raw);

    const attempts: Array<() => { updated: string; replaced: boolean }> = [
      () => replaceFirstLiteral(xml, sanitizedRaw, safeValue),
      () => replaceFirstLiteral(xml, raw, safeValue),
      () => replaceFirstRegex(xml, buildInterleavedPlaceholderRegex(raw), safeValue),
    ];

    for (const attempt of attempts) {
      const { updated, replaced } = attempt();
      if (replaced) {
        replacementsApplied = true;
        xml = updated;
        appliedCount += 1;
        break;
      }
    }
  }

  zip.file("word/document.xml", xml);
  const filledBuffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer: filledBuffer, replacementsApplied, appliedCount };
}

function buildInterleavedPlaceholderRegex(raw: string): RegExp {
  const escapedChars = raw.split("").map((char) => escapeRegExp(char));
  const separator = "(?:\\s|<[^>]*>)*";
  const pattern = escapedChars.join(separator);
  return new RegExp(pattern, "g");
}

function replaceFirstLiteral(haystack: string, needle: string, value: string) {
  if (!needle || needle === value) {
    return { updated: haystack, replaced: false };
  }
  const index = haystack.indexOf(needle);
  if (index === -1) {
    return { updated: haystack, replaced: false };
  }
  const updated = `${haystack.slice(0, index)}${value}${haystack.slice(index + needle.length)}`;
  return { updated, replaced: true };
}

function replaceFirstRegex(haystack: string, pattern: RegExp, value: string) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const globalPattern = new RegExp(pattern.source, flags);
  const match = globalPattern.exec(haystack);
  if (!match || typeof match.index !== "number") {
    return { updated: haystack, replaced: false };
  }
  const start = match.index;
  const end = start + match[0].length;
  const updated = `${haystack.slice(0, start)}${value}${haystack.slice(end)}`;
  return { updated, replaced: true };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
