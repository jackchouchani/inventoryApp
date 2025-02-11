import { handleError, ErrorType } from './errorHandler';

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

  return handleError(error, ErrorType.UNKNOWN, {
    context,
    additionalData: {
      ...additionalData,
      labelErrorType
    },
    customMessage: errorMessage
  });
};

// Fonctions utilitaires spécifiques
export const handleLabelGenerationError = (error: Error, context: string) => {
  return handleError(error, ErrorType.UNKNOWN, {
    context,
    customMessage: labelErrorMessages[LabelErrorType.PDF_GENERATION]
  });
};

export const handleLabelPrintingError = (error: Error, context: string) => {
  return handleError(error, ErrorType.UNKNOWN, {
    context,
    customMessage: labelErrorMessages[LabelErrorType.PRINTING]
  });
};

export const handleQRCodeError = (error: Error, context: string) => {
  return handleError(error, ErrorType.UNKNOWN, {
    context,
    customMessage: labelErrorMessages[LabelErrorType.QR_CODE_GENERATION]
  });
}; 