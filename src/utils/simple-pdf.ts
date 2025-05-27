// Alternative simple à jsPDF utilisant l'API native du navigateur

interface SimplePDFOptions {
  orientation?: 'portrait' | 'landscape';
  unit?: 'mm' | 'cm' | 'in' | 'pt';
  format?: string | number[];
  compress?: boolean;
}

interface ContentItem {
  type: string;
  [key: string]: any;
}

export class SimplePDF {
  orientation: string;
  unit: string;
  format: string | number[];
  compress: boolean;
  content: ContentItem[];
  currentY: number;
  lineWidth: number;
  drawColor: string;
  fillColor: string;
  fontSize: number;
  fontFamily: string;
  fontStyle: string;
  textColor: string;

  constructor(
    orientation: string | SimplePDFOptions = 'portrait', 
    unit: string = 'mm', 
    format: string | number[] = 'a4', 
    compress: boolean = false
  ) {
    console.log('[SimplePDF] Constructor called with:', { orientation, unit, format, compress });
    
    // Si le premier paramètre est un objet (nouveau format jsPDF)
    if (typeof orientation === 'object') {
      const options = orientation as SimplePDFOptions;
      this.orientation = options.orientation || 'portrait';
      this.unit = options.unit || 'mm';
      this.format = options.format || 'a4';
      this.compress = options.compress || false;
    } else {
      // Format classique avec paramètres séparés
      this.orientation = orientation || 'portrait';
      this.unit = unit || 'mm';
      this.format = format || 'a4';
      this.compress = compress || false;
    }
    
    this.content = [];
    this.currentY = 10;
    this.lineWidth = 1;
    this.drawColor = 'black';
    this.fillColor = 'transparent';
    this.fontSize = 12;
    this.fontFamily = 'Arial';
    this.fontStyle = 'normal';
    this.textColor = 'black';
    
    console.log('[SimplePDF] Instance created with config:', {
      orientation: this.orientation,
      unit: this.unit,
      format: this.format,
      compress: this.compress
    });
    console.log('[SimplePDF] Checking methods:');
    console.log('[SimplePDF] setDrawColor exists:', typeof this.setDrawColor);
    console.log('[SimplePDF] setFontSize exists:', typeof this.setFontSize);
    console.log('[SimplePDF] text exists:', typeof this.text);
    console.log('[SimplePDF] rect exists:', typeof this.rect);
    console.log('[SimplePDF] line exists:', typeof this.line);
  }

  setFontSize(size: number): void {
    this.fontSize = size;
  }

  setFont(family?: string, style?: string): void {
    if (family) this.fontFamily = family;
    if (style) this.fontStyle = style;
  }

  setTextColor(r: number, g: number, b: number): void {
    this.textColor = `rgb(${r}, ${g}, ${b})`;
  }

  setLineWidth(width: number): void {
    this.lineWidth = width;
  }

  setDrawColor(r: number, g: number, b: number): void {
    this.drawColor = `rgb(${r}, ${g}, ${b})`;
  }

  setFillColor(r: number, g: number, b: number): void {
    this.fillColor = `rgb(${r}, ${g}, ${b})`;
  }

  text(text: string | string[], x: number, y: number, options: any = {}): void {
    this.content.push({
      type: 'text',
      text: Array.isArray(text) ? text.join('\n') : text,
      x,
      y,
      fontSize: this.fontSize || 12,
      fontFamily: this.fontFamily || 'Arial',
      fontStyle: this.fontStyle || 'normal',
      color: this.textColor || 'black',
      align: options.align || 'left'
    });
  }

  addImage(imageData: string, format: string, x: number, y: number, width: number, height: number): void {
    this.content.push({
      type: 'image',
      imageData,
      x,
      y,
      width,
      height
    });
  }

  line(x1: number, y1: number, x2: number, y2: number): void {
    this.content.push({
      type: 'line',
      x1,
      y1,
      x2,
      y2,
      lineWidth: this.lineWidth,
      color: this.drawColor
    });
  }

  rect(x: number, y: number, width: number, height: number): void {
    this.content.push({
      type: 'rect',
      x,
      y,
      width,
      height,
      lineWidth: this.lineWidth,
      strokeColor: this.drawColor,
      fillColor: this.fillColor
    });
  }

  addPage(format?: string | number[]): void {
    this.content.push({ type: 'pageBreak', format });
    this.currentY = 10;
  }

  splitTextToSize(text: string, maxWidth: number): string[] {
    // Simulation simple du split de texte
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      // Estimation simple de la largeur (à améliorer selon vos besoins)
      if (testLine.length * 2 < maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });
    
    if (currentLine) lines.push(currentLine);
    return lines;
  }

  async save(filename: string): Promise<void> {
    console.log('[SimplePDF] save() called with filename:', filename);
    
    try {
      // Ouvrir un aperçu du PDF dans une nouvelle page
      await this.openPreview(filename);
    } catch (error) {
      console.error('[SimplePDF] Error opening preview:', error);
      // Fallback : télécharger en HTML
      await this.saveAsHTML(filename);
    }
  }

  private async openPreview(filename: string): Promise<void> {
    const html = this.generateHTML();
    
    // Créer un blob avec le contenu HTML
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    
    // Ouvrir dans une nouvelle fenêtre/onglet
    const previewWindow = window.open(url, '_blank');
    
    if (!previewWindow) {
      console.warn('[SimplePDF] Popup blocked, falling back to download');
      // Si le popup est bloqué, fallback vers téléchargement
      await this.saveAsHTML(filename);
      return;
    }
    
    // Essayer d'utiliser l'API Web Share si disponible (mobile)
    if (navigator.share) {
      try {
        // Attendre un peu que la page se charge
        setTimeout(async () => {
          try {
            await navigator.share({
              title: filename,
              text: 'Étiquettes générées',
              url: url
            });
            console.log('[SimplePDF] Shared successfully');
          } catch (shareError) {
            console.log('[SimplePDF] Share cancelled or failed:', shareError);
          }
        }, 1000);
      } catch (error) {
        console.log('[SimplePDF] Web Share API not supported or failed');
      }
    }
    
    // Nettoyer l'URL après un délai
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 30000); // 30 secondes pour laisser le temps à l'utilisateur
    
    console.log('[SimplePDF] Preview opened in new tab');
  }

  private async saveAsHTML(filename: string): Promise<void> {
    const html = this.generateHTML();
    
    // Créer un blob avec le contenu HTML
    const blob = new Blob([html], { type: 'text/html' });
    
    // Créer un lien de téléchargement
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace('.pdf', '.html');
    
    // Déclencher le téléchargement
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Nettoyer l'URL
    URL.revokeObjectURL(url);
    
    console.log('[SimplePDF] File downloaded as HTML. User can print to PDF from browser.');
    console.log('[SimplePDF] Instructions: Open the downloaded HTML file and use Ctrl+P (Cmd+P on Mac) to save as PDF');
  }

  generateHTML(): string {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Aperçu des étiquettes</title>
        <style>
          @page {
            size: ${Array.isArray(this.format) ? `${this.format[0]}mm ${this.format[1]}mm` : this.format};
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            position: relative;
            background-color: #f5f5f5;
          }
          .toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #333;
            color: white;
            padding: 10px;
            z-index: 1000;
            display: flex;
            gap: 10px;
            align-items: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          }
          .toolbar button {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .toolbar button:hover {
            background: #0056b3;
          }
          .content {
            margin-top: 60px;
            padding: 20px;
          }
          .page {
            width: 100%;
            max-width: 210mm;
            min-height: 297mm;
            margin: 0 auto 20px;
            position: relative;
            page-break-after: always;
            background: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border-radius: 4px;
            overflow: hidden;
          }
          .page:last-child {
            page-break-after: avoid;
          }
          .text-element {
            position: absolute;
            white-space: pre-wrap;
          }
          .image-element {
            position: absolute;
          }
          .line-element {
            position: absolute;
            border-top-style: solid;
          }
          .rect-element {
            position: absolute;
            border-style: solid;
          }
          @media print {
            .toolbar { display: none; }
            .content { margin-top: 0; padding: 0; }
            .page { 
              box-shadow: none; 
              margin: 0; 
              border-radius: 0;
              max-width: none;
            }
            body { background: white; }
          }
        </style>
        <script>
          function printPage() {
            window.print();
          }

          function sharePage() {
            if (navigator.share) {
              navigator.share({
                title: 'Étiquettes générées',
                text: 'Aperçu des étiquettes',
                url: window.location.href
              }).catch(console.error);
            } else {
              // Fallback: copier l'URL
              navigator.clipboard.writeText(window.location.href).then(() => {
                alert('URL copiée dans le presse-papiers');
              }).catch(() => {
                alert('Impossible de partager. URL: ' + window.location.href);
              });
            }
          }
        </script>
      </head>
      <body>
        <div class="toolbar">
          <span>📄 Aperçu des étiquettes</span>
          <button onclick="printPage()">🖨️ Imprimer / Sauvegarder PDF</button>
          <button onclick="sharePage()">📤 Partager</button>
        </div>
        <div class="content">
    `;

    let currentPage = '<div class="page">';
    
    // Si le contenu est vide, ajouter un message de test
    if (this.content.length === 0) {
      currentPage += '<div style="position: absolute; left: 10mm; top: 10mm; font-size: 16px; color: red;">Aucun contenu généré - Problème de génération d\'étiquettes</div>';
    }
    
    this.content.forEach((item, index) => {
      if (item.type === 'pageBreak') {
        currentPage += '</div>';
        html += currentPage;
        currentPage = '<div class="page">';
      } else if (item.type === 'text') {
        const style = `
          left: ${item.x}mm;
          top: ${item.y}mm;
          font-size: ${item.fontSize}px;
          font-family: ${item.fontFamily};
          font-weight: ${item.fontStyle === 'bold' ? 'bold' : 'normal'};
          color: ${item.color};
          text-align: ${item.align};
        `;
        currentPage += `<div class="text-element" style="${style}">${item.text}</div>`;
      } else if (item.type === 'image') {
        const style = `
          left: ${item.x}mm;
          top: ${item.y}mm;
          width: ${item.width}mm;
          height: ${item.height}mm;
        `;
        currentPage += `<img class="image-element" src="${item.imageData}" style="${style}" />`;
      } else if (item.type === 'line') {
        const style = `
          left: ${item.x1}mm;
          top: ${item.y1}mm;
          width: ${item.x2 - item.x1}mm;
          border-top-width: ${item.lineWidth}px;
          border-top-color: ${item.color};
        `;
        currentPage += `<div class="line-element" style="${style}"></div>`;
      } else if (item.type === 'rect') {
        const style = `
          left: ${item.x}mm;
          top: ${item.y}mm;
          width: ${item.width}mm;
          height: ${item.height}mm;
          border-width: ${item.lineWidth}px;
          border-color: ${item.strokeColor};
          background-color: ${item.fillColor !== 'transparent' ? item.fillColor : 'transparent'};
        `;
        currentPage += `<div class="rect-element" style="${style}"></div>`;
      }
    });

    currentPage += '</div>';
    html += currentPage;
    html += '</div></body></html>';

    return html;
  }

  output(type: string): Blob | null {
    if (type === 'blob') {
      const html = this.generateHTML();
      return new Blob([html], { type: 'text/html' });
    }
    return null;
  }
}

// Export pour compatibilité avec jsPDF
export const jsPDF = SimplePDF;
export default SimplePDF; 