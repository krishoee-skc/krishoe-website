/**
 * A file's code, with its comments taken out.
 *
 * Written after the same mistake four times in one day. A fix removes a line
 * and explains in a comment why it went — quoting the removed line, because
 * that is what makes the comment useful to the next reader. Then a test
 * searches the raw file for that line, finds it inside the explanation, and
 * fails on the record of the fix rather than on the fix.
 *
 * Assertions about what a reader sees, or what the code does, want this.
 * Assertions about why something is written the way it is want the raw file.
 */
export function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}
