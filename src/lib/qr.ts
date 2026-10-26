// QR codes as PNG data URLs. `qrcode` is lazy-loaded so it stays out of the main bundle.
export async function qrDataUrl(text: string, opts?: { size?: number; margin?: number }): Promise<string> {
  const { toDataURL } = await import('qrcode')
  return toDataURL(text, { errorCorrectionLevel: 'M', width: opts?.size ?? 128, margin: opts?.margin ?? 1 })
}
