declare module '@zxing/library' {
  export enum BarcodeFormat {
    DATA_MATRIX = 'DATA_MATRIX',
    QR_CODE = 'QR_CODE'
  }

  export enum EncodeHintType {
    MARGIN = 'MARGIN',
    ERROR_CORRECTION = 'ERROR_CORRECTION'
  }

  export class BitMatrix {
    constructor(width: number, height: number);
    get(x: number, y: number): boolean;
    getWidth(): number;
    getHeight(): number;
  }

  export class MultiFormatWriter {
    encode(
      contents: string,
      format: BarcodeFormat,
      width: number,
      height: number,
      hints?: Map<EncodeHintType, any>
    ): BitMatrix;
  }
} 