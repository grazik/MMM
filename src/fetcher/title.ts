const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
};

const MAX_CODE_POINT = 0x10_ffff;

const ENTITY_PATTERN = /&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi;

const decodeNumeric = (body: string): string | undefined => {
  const isHex = body[1] === "x" || body[1] === "X";
  const codePoint = Number.parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
  if (
    !Number.isFinite(codePoint) ||
    codePoint <= 0 ||
    codePoint > MAX_CODE_POINT
  )
    return undefined;
  return String.fromCodePoint(codePoint);
};

// One pass, so an escaped entity like "&amp;lt;" decodes to the literal "&lt;" rather than "<".
export const decodeHtmlEntities = (text: string): string =>
  text.replace(ENTITY_PATTERN, (match, body: string) => {
    const decoded = body.startsWith("#")
      ? decodeNumeric(body)
      : NAMED_ENTITIES[body.toLowerCase()];
    return decoded ?? match;
  });
