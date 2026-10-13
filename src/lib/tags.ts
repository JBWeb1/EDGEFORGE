/**
 * Tags are short lowercase labels ("news", "a+ setup", "late entry").
 * Input is comma- or semicolon-separated; duplicates are dropped.
 */

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;

export function parseTags(input: string | null | undefined): { tags: string[]; error?: string } {
  const tags = [
    ...new Set(
      (input ?? "")
        .split(/[,;]/)
        .map((t) => t.trim().toLowerCase().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  ];
  const tooLong = tags.find((t) => t.length > MAX_TAG_LENGTH);
  if (tooLong) return { tags, error: `Tag "${tooLong}" is longer than ${MAX_TAG_LENGTH} characters.` };
  if (tags.length > MAX_TAGS) return { tags, error: `Use at most ${MAX_TAGS} tags.` };
  return { tags };
}
