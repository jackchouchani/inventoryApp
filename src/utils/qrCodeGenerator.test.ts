
import {
  isValidContainerQRCode,
  isValidItemQRCode,
  isValidLocationQRCode,
} from './qrCodeGenerator';

describe('QR Code Validation', () => {
  // Tests pour les QR Codes de Conteneurs
  describe('isValidContainerQRCode', () => {
    it('should return true for a valid container QR code', () => {
      expect(isValidContainerQRCode('CONT_ABCD')).toBe(true);
      expect(isValidContainerQRCode('CONT_1234')).toBe(true);
      expect(isValidContainerQRCode('CONT_AB12')).toBe(true);
    });

    it('should return false for an invalid container QR code', () => {
      expect(isValidContainerQRCode('ART_ABCD')).toBe(false); // Mauvais préfixe
      expect(isValidContainerQRCode('CONT_ABC')).toBe(false); // Trop court
      expect(isValidContainerQRCode('CONT_ABCDE')).toBe(false); // Trop long
      expect(isValidContainerQRCode('CONT_abcD')).toBe(false); // Minuscules
      expect(isValidContainerQRCode('CONT_AB-D')).toBe(false); // Caractère spécial
      expect(isValidContainerQRCode('Container_ABCD')).toBe(false); // Préfixe incorrect
    });
  });

  // Tests pour les QR Codes d'Articles
  describe('isValidItemQRCode', () => {
    it('should return true for a valid item QR code', () => {
      expect(isValidItemQRCode('ART_WXYZ')).toBe(true);
      expect(isValidItemQRCode('ART_5678')).toBe(true);
      expect(isValidItemQRCode('ART_WX56')).toBe(true);
    });

    it('should return false for an invalid item QR code', () => {
      expect(isValidItemQRCode('CONT_WXYZ')).toBe(false); // Mauvais préfixe
      expect(isValidItemQRCode('ART_WXY')).toBe(false);   // Trop court
      expect(isValidItemQRCode('ART_WXYZa')).toBe(false); // Trop long
      expect(isValidItemQRCode('ART_wxyz')).toBe(false);  // Minuscules
      expect(isValidItemQRCode('ART_WX_Z')).toBe(false);  // Caractère spécial
    });
  });

  // Tests pour les QR Codes d'Emplacements
  describe('isValidLocationQRCode', () => {
    it('should return true for a valid location QR code', () => {
      expect(isValidLocationQRCode('LOC_LMNO')).toBe(true);
      expect(isValidLocationQRCode('LOC_9012')).toBe(true);
      expect(isValidLocationQRCode('LOC_LM90')).toBe(true);
    });

    it('should return false for an invalid location QR code', () => {
      expect(isValidLocationQRCode('ART_LMNO')).toBe(false);    // Mauvais préfixe
      expect(isValidLocationQRCode('LOC_LMN')).toBe(false);     // Trop court
      expect(isValidLocationQRCode('LOC_LMNOO')).toBe(false);   // Trop long
      expect(isValidLocationQRCode('LOC_lmno')).toBe(false);    // Minuscules
      expect(isValidLocationQRCode('LOC_LM/O')).toBe(false);    // Caractère spécial
    });
  });
});
