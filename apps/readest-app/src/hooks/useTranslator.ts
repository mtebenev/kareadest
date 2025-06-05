import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ErrorCodes, getTranslator, getTranslators, TranslatorName } from '@/services/translators';
import { getFromCache, storeInCache, polish, UseTranslatorOptions } from '@/services/translators';
import { eventDispatcher } from '@/utils/event';
import { useTranslation } from './useTranslation';

export function useTranslator({
  provider = 'deepl',
  sourceLang = 'AUTO',
  targetLang = 'EN',
  enablePolishing = true,
}: UseTranslatorOptions = {}) {
  const _ = useTranslation();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(provider);
  const [translator, setTransltor] = useState(() => getTranslator(provider));
  const [translators] = useState(() => getTranslators());

  useEffect(() => {
    setLoading(false);
  }, [provider, sourceLang, targetLang]);

  useEffect(() => {
    const availableTranslators = getTranslators().filter(
      (t) => (t.authRequired ? !!token : true) && !t.quotaExceeded,
    );
    const selectedTranslator =
      availableTranslators.find((t) => t.name === provider) || availableTranslators[0]!;
    const selectedProviderName = selectedTranslator.name as TranslatorName;
    setTransltor(getTranslator(selectedProviderName));
    setSelectedProvider(selectedProviderName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider]);

  const translate = useCallback(
    async (
      input: string[],
      options?: { source?: string; target?: string; useCache?: boolean },
    ): Promise<string[]> => {
      const sourceLanguage = options?.source || sourceLang;
      const targetLanguage = options?.target || targetLang;
      const useCache = options?.useCache ?? false;
      const textsToTranslate = input;

      if (textsToTranslate.length === 0 || textsToTranslate.every((t) => !t?.trim())) {
        return textsToTranslate;
      }

      const textsNeedingTranslation: string[] = [];
      const indicesNeedingTranslation: number[] = [];

      await Promise.all(
        textsToTranslate.map(async (text, index) => {
          if (!text?.trim()) return;

          const cachedTranslation = await getFromCache(
            text,
            sourceLanguage,
            targetLanguage,
            selectedProvider,
          );
          if (cachedTranslation) return;

          textsNeedingTranslation.push(text);
          indicesNeedingTranslation.push(index);
        }),
      );

      if (textsNeedingTranslation.length === 0) {
        const results = await Promise.all(
          textsToTranslate.map((text) =>
            getFromCache(text, sourceLanguage, targetLanguage, selectedProvider).then(
              (cached) => cached || text,
            ),
          ),
        );

        return enablePolishing ? polish(results, targetLanguage) : results;
      }

      setLoading(true);

      try {
        const translator = translators.find((t) => t.name === selectedProvider);
        if (!translator) {
          throw new Error(`No translator found for provider: ${selectedProvider}`);
        }
        const translatedTexts = await translator.translate(
          textsNeedingTranslation,
          sourceLanguage,
          targetLanguage,
          token,
          useCache,
        );

        await Promise.all(
          textsNeedingTranslation.map(async (text, index) => {
            return storeInCache(
              text,
              translatedTexts[index] || '',
              sourceLanguage,
              targetLanguage,
              selectedProvider,
            );
          }),
        );

        const results = [...textsToTranslate];
        indicesNeedingTranslation.forEach((originalIndex, translationIndex) => {
          results[originalIndex] = translatedTexts[translationIndex] || '';
        });

        await Promise.all(
          results.map(async (_, index) => {
            if (!indicesNeedingTranslation.includes(index)) {
              const originalText = textsToTranslate[index];
              if (!originalText?.trim()) return;

              const cachedTranslation = await getFromCache(
                originalText,
                sourceLanguage,
                targetLanguage,
                selectedProvider,
              );

              if (cachedTranslation) {
                results[index] = cachedTranslation;
              }
            }
          }),
        );

        setLoading(false);
        return enablePolishing ? polish(results, targetLanguage) : results;
      } catch (err) {
        if (err instanceof Error && err.message.includes(ErrorCodes.DAILY_QUOTA_EXCEEDED)) {
          eventDispatcher.dispatch('toast', {
            message: _(
              'Daily translation quota reached. Select another translate service to proceed.',
            ),
            type: 'error',
          });
          setSelectedProvider('azure');
        }
        setLoading(false);
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProvider, sourceLang, targetLang, translator, token],
  );

  const streamTranslate = useCallback(
    async function* (
      input: string[],
      options?: { source?: string; target?: string; useCache?: boolean },
    ): AsyncGenerator<string, void, unknown> {
      const sourceLanguage = options?.source || sourceLang;
      const targetLanguage = options?.target || targetLang;
      const useCache = options?.useCache ?? false;
      const textsToTranslate = input;

      // Only support single string streaming for now
      if (textsToTranslate.length !== 1 || !textsToTranslate[0]?.trim()) {
        return;
      }

      const text = textsToTranslate[0];

      // Try cache first
      const cachedTranslation = await getFromCache(
        text,
        sourceLanguage,
        targetLanguage,
        provider,
      );
      if (cachedTranslation) {
        yield cachedTranslation;
        return;
      }

      setLoading(true);

      try {
        const translator = translators.find((t) => t.name === provider);
        let result = ''; // store accumulated result for caching
        if (!translator) {
          throw new Error(`No translator found for provider: ${provider}`);
        }

        if (typeof translator.streamTranslate !== 'function') {
          // Fallback to non-streaming translation
          const translated = await translator.translate(
            [text], sourceLanguage, targetLanguage, token, useCache,
          );
          result = translated[0] || '';
          yield result;
        }
        else {
          for await (const chunk of translator.streamTranslate(
            text,
            sourceLanguage,
            targetLanguage,
            token,
            useCache,
          )) {
            result += chunk;
            yield chunk;
          }
        }

        // Store the final result in cache
        if (result) {
          await storeInCache(
            text,
            result,
            sourceLanguage,
            targetLanguage,
            provider,
          );
        }

        setLoading(false);
      } catch (err) {
        setLoading(false);
        console.error('Streaming translation error:', err);
        throw err instanceof Error ? err : new Error(String(err));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [provider, sourceLang, targetLang, translator, token],
  );

  return {
    translate,
    streamTranslate,
    translator,
    translators,
    loading,
  };
}
