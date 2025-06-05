import { ITranslationTarget, StreamTranslateFn } from "./ITranslationTarget";

export class TranslationTarget extends HTMLElement implements ITranslationTarget {

  private originalNodes: Node[] = [];
  private streamTranslateFn?: StreamTranslateFn;
  private originalText: string = '';
  private translatedText: string = '';

  constructor() {
    super();
  }

  public initialize(nodes: Node[], streamTranslateFn: StreamTranslateFn | undefined): void {
    this.originalNodes = nodes;
    this.streamTranslateFn = streamTranslateFn;

    this.originalText = nodes.map(n => n.textContent || '').join('').trim();
    this.textContent = this.originalText;

    if (this.originalText) {
      this.startTranslation(this.originalText);
    }
  }

  public removeTranslationTarget(element: HTMLElement): void {
    this.originalNodes.forEach(node => {
      element.appendChild(node);
    });
    this.remove();
  }

  public showTranslation(): void {
    this.textContent = this.translatedText;
  }

  public showOriginal(): void {
    this.textContent = this.originalText;
  }

  private async startTranslation(text: string) {
    try {
      if (!this.streamTranslateFn) return;

      let translationBuffer = text;
      let translatedSize = 0;

      for await (const chunk of this.streamTranslateFn([text])) {
        translationBuffer =
          translationBuffer.slice(0, translatedSize) +
          chunk +
          translationBuffer.slice(translatedSize + chunk.length);
        translatedSize += chunk.length;
        this.textContent = translationBuffer;
      }
      this.translatedText = translationBuffer.slice(0, translatedSize);
      this.textContent = this.translatedText;
    } catch (error) {
      console.error('Translation error:', error);
    }
  }
}

export function ensureRegistered() {
  if (typeof window !== 'undefined' && !customElements.get('translation-target')) {
    customElements.define('translation-target', TranslationTarget);
  }
}
