declare module 'qrcode' {
  export interface QRCodeToDataURLOptions {
    width?: number
    margin?: number
  }

  const QRCode: {
    toDataURL(text: string, options?: QRCodeToDataURLOptions): Promise<string>
  }

  export default QRCode
}
