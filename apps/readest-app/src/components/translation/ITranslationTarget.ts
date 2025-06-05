export type StreamTranslateFn = (input: string[], options?: { source?: string; target?: string; useCache?: boolean }) => AsyncGenerator<string, void, unknown>;

export interface ITranslationTarget {
  initialize(nodes: Node[], streamTranslateFn: StreamTranslateFn): void;
  removeTranslationTarget(element: HTMLElement): void;
  showTranslation(): void;
  showOriginal(): void;
}
