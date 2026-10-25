/** Minimal English count label: plural(1, 'bill') → '1 bill', plural(2, 'bill') → '2 bills'.
 *  Pass a suffix for -es words, e.g. plural(2, 'match', 'es') → '2 matches'. */
export function plural(n: number, word: string, suffix = 's'): string {
  return `${n} ${word}${n === 1 ? '' : suffix}`
}
