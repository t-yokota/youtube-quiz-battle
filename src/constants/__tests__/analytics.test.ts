describe('環境別のGA4測定ID', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it.each([
    [undefined, 'G-JZTD11WD9E'],
    ['', ''],
    ['G-PREVIEW', 'G-PREVIEW'],
  ])('設定値 %s を測定ID %s として使用する', async (configured, expected) => {
    vi.stubEnv('VITE_GA_MEASUREMENT_ID', configured)
    vi.resetModules()
    const { GA_MEASUREMENT_ID } = await import('../analytics')
    expect(GA_MEASUREMENT_ID).toBe(expected)
  })
})
