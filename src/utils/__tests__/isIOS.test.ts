import { isIOS } from '../isIOS'

it.each([
  ['iPhone', 'iPhone', 5, true],
  ['iPad', 'iPad', 5, true],
  ['Mozilla/5.0 (Macintosh)', 'MacIntel', 5, true],
  ['Mozilla/5.0 (Macintosh)', 'MacIntel', 0, false],
  ['Android', 'Linux armv8l', 5, false],
  ['Windows', 'Win32', 0, false],
])('%s / %s / %sのiOS判定は%s', (userAgent, platform, maxTouchPoints, expected) => {
  expect(isIOS({ userAgent, platform, maxTouchPoints })).toBe(expected)
})
