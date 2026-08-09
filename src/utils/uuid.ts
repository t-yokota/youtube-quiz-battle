/**
 * UUID v4を生成する。
 * HTTPのLANアドレスなどrandomUUIDが公開されない環境ではgetRandomValuesへフォールバックする。
 */
export function createUuid(cryptoApi: Crypto | undefined = globalThis.crypto): string {
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID()
  }

  const randomBytes = cryptoApi?.getRandomValues
    ? cryptoApi.getRandomValues(new Uint8Array(16))
    : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256))
  const uuidBytes = Uint8Array.from(randomBytes, (byte, index) => {
    if (index === 6) return (byte & 0x0f) | 0x40
    if (index === 8) return (byte & 0x3f) | 0x80
    return byte
  })
  const hex = Array.from(uuidBytes, (byte) => byte.toString(16).padStart(2, '0'))

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10).join('')}`
}
