/**
 * Short month names everywhere: newer browsers write September as "Sept"
 * in English ("29 Sept 2044") while every other month has 3 letters.
 */
export function fixMonth(text: string): string {
  return text.replace(/\bSept\b/g, "Sep");
}
