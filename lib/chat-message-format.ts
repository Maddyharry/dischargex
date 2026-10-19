export type ChatMessagePart = { text: string; bold: boolean };

/** Parse the small, safe chat formatting subset we support: **bold** and newlines. */
export function parseChatMessage(message: string): ChatMessagePart[][] {
  return message.split(/\r\n|\r|\n/).map((line) => {
    const parts: ChatMessagePart[] = [];
    const pattern = /\*\*([^*\n]+)\*\*/g;
    let cursor = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line)) !== null) {
      if (match.index > cursor) parts.push({ text: line.slice(cursor, match.index), bold: false });
      parts.push({ text: match[1], bold: true });
      cursor = match.index + match[0].length;
    }
    if (cursor < line.length || parts.length === 0) {
      parts.push({ text: line.slice(cursor), bold: false });
    }
    return parts;
  });
}
