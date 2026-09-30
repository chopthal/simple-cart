/** trim + 연속 공백을 한 칸으로 축약 */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

/** 줄바꿈 기준 분리. 쉼표 분리는 하지 않음. */
export function splitInputNames(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}
