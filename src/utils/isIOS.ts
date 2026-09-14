/** デスクトップ用UAを使うiPadOSも含めて、同期フォーカスが必要な端末を判定する。 */
export function isIOS(
  device: Pick<Navigator, 'userAgent' | 'platform' | 'maxTouchPoints'> = navigator,
): boolean {
  return (
    /iPad|iPhone|iPod/.test(device.userAgent) ||
    (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
  )
}
