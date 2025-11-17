import JSZip from "jszip";
import mammoth from "mammoth";

export async function extractRawText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value ?? "";
}

export async function fillDocxTemplate(
  buffer: Buffer,
  replacements: Array<{ raw: string; value: string }>
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(buffer);
  const document = zip.file("word/document.xml");
  if (!document) {
    throw new Error("word/document.xml not found in template");
  }
  let xml = await document.async("text");

  for (const { raw, value } of replacements) {
    if (!value || !raw) continue;
    const safeValue = escapeXml(value);
    const sanitizedRaw = escapeXml(raw);
    if (xml.includes(sanitizedRaw)) {
      xml = xml.split(sanitizedRaw).join(safeValue);
    }
    if (xml.includes(raw)) {
      xml = xml.split(raw).join(safeValue);
    }
    const interleavedRegex = buildInterleavedPlaceholderRegex(raw);
    xml = xml.replace(interleavedRegex, safeValue);
  }

  zip.file("word/document.xml", xml);
  return zip.generateAsync({ type: "nodebuffer" });
}

function buildInterleavedPlaceholderRegex(raw: string): RegExp {
  const escapedChars = raw.split("").map((char) => escapeRegExp(char));
  const separator = "(?:\\s|<[^>]*>)*";
  const pattern = escapedChars.join(separator);
  return new RegExp(pattern, "g");
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
