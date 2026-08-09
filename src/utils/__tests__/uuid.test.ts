import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUuid } from '../uuid'

describe('createUuid', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('randomUUIDが利用できる場合はブラウザ実装を使う', () => {
    const randomUUID = vi.fn(() => '00000000-0000-4000-8000-000000000001')
    const cryptoApi = { randomUUID } as unknown as Crypto

    expect(createUuid(cryptoApi)).toBe('00000000-0000-4000-8000-000000000001')
    expect(randomUUID).toHaveBeenCalledOnce()
  })

  it('randomUUIDがないHTTP環境でもgetRandomValuesからUUID v4を生成する', () => {
    const cryptoApi = {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array instanceof Uint8Array) {
          array.set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
        }
        return array
      },
    } as Crypto

    expect(createUuid(cryptoApi)).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f')
  })

  it('Web Crypto自体がない環境でもUUID形式のIDを返す', () => {
    vi.stubGlobal('crypto', undefined)

    expect(createUuid()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
  })
})
