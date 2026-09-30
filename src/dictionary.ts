/** 키워드 → 채널 id. 해당 id가 현재 channels에 있을 때만 사용. */
export const KEYWORD_DICTIONARY: Array<{ keyword: string; channel: string }> = [
  { keyword: '건전지', channel: 'daiso' },
  { keyword: '젓가락', channel: 'daiso' },
  { keyword: '일회용', channel: 'daiso' },
  { keyword: '봉투', channel: 'daiso' },
  { keyword: '테이프', channel: 'daiso' },
  { keyword: '고무장갑', channel: 'daiso' },
  { keyword: '수세미', channel: 'daiso' },
  { keyword: '행주', channel: 'daiso' },
  { keyword: '집게', channel: 'daiso' },
  { keyword: '옷걸이', channel: 'daiso' },
  { keyword: '생수', channel: 'coupang' },
  { keyword: '물티슈', channel: 'coupang' },
  { keyword: '휴지', channel: 'coupang' },
  { keyword: '키친타올', channel: 'coupang' },
  { keyword: '키친타월', channel: 'coupang' },
  { keyword: '강아지', channel: 'coupang' },
  { keyword: '고양이', channel: 'coupang' },
  { keyword: '사료', channel: 'coupang' },
  { keyword: '기저귀', channel: 'coupang' },
]

export function matchKeywordChannel(normalizedName: string): string | null {
  const sorted = [...KEYWORD_DICTIONARY].sort(
    (a, b) => b.keyword.length - a.keyword.length,
  )
  for (const entry of sorted) {
    if (normalizedName.includes(entry.keyword)) {
      return entry.channel
    }
  }
  return null
}
