import { handleError } from './errorHandler';

// Types d'erreurs spécifiques aux étiquettes
export enum LabelErrorType {
  QR_CODE_GENERATION = 'QR_CODE_GENERATION',
  PDF_GENERATION = 'PDF_GENERATION',
  PRINTING = 'PRINTING'
}

// Messages d'erreur spécifiques aux étiquettes
interface LabelErrorMessage {
  fr: string;
  en: string;
}

const labelErrorMessages: Record<LabelErrorType, LabelErrorMessage> = {
  [LabelErrorType.QR_CODE_GENERATION]: {
    fr: "Erreur lors de la génération du QR code",
    en: "Error generating QR code"
  },
  [LabelErrorType.PDF_GENERATION]: {
    fr: "Erreur lors de la génération du PDF",
    en: "Error generating PDF"
  },
  [LabelErrorType.PRINTING]: {
    fr: "Erreur lors de l'impression des étiquettes",
    en: "Error printing labels"
  }
};

// Fonction principale de gestion des erreurs d'étiquettes
export const handleLabelError = (
  error: Error,
  labelErrorType: LabelErrorType,
  context?: string,
  additionalData?: Record<string, any>
) => {
  const errorMessage = labelErrorMessages[labelErrorType];

  return handleError(error, errorMessage.fr, {
    additionalData: {
      ...additionalData,
      labelErrorType,
      context
    }
  });
};

// Fonctions utilitaires spécifiques
export const handleLabelGenerationError = (error: Error, context: string) => {
  return handleError(error, labelErrorMessages[LabelErrorType.PDF_GENERATION].fr, {
    additionalData: { context }
  });
};

export const handleLabelPrintingError = (error: Error, context: string) => {
  return handleError(error, labelErrorMessages[LabelErrorType.PRINTING].fr, {
    additionalData: { context }
  });
};

export const handleQRCodeError = (error: Error, context: string) => {
  return handleError(error, labelErrorMessages[LabelErrorType.QR_CODE_GENERATION].fr, {
    additionalData: { context }
  });
}; 