import { stubTranslation as _ } from '@/utils/misc';
import { TranslationProvider } from '../types';
import OpenAI from 'openai';

export const openaiProvider: TranslationProvider = {
  name: 'openai',
  label: _('OpenAI'),
  translate: async (text: string[], sourceLang: string, targetLang: string): Promise<string[]> => {
    if (!text.length) return [];

    const apiKey = process.env['OPENAI_API_KEY'] || (typeof window !== 'undefined' ? (window as any).OPENAI_API_KEY : undefined);
    if (!apiKey) {
      throw new Error('OpenAI API key is not set.');
    }

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const results: string[] = [];

    const translationPromises = text.map(async (line, index) => {
      if (!line?.trim().length) {
        results[index] = line;
        return;
      }
      const prompt = `Translate the following text from ${sourceLang} to ${targetLang}:\n"""${line}"""\nOnly return the translated text, nothing else.`;
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4.1-mini',
          messages: [
            { role: 'system', content: 'You are a translation engine.' },
            { role: 'user', content: prompt },
          ],
          max_tokens: 1000,
        });
        const translated = completion.choices?.[0]?.message?.content?.trim();
        results[index] = translated || line;
      } catch {
        results[index] = line;
      }
    });

    await Promise.all(translationPromises);
    return results;
  },
  streamTranslate: async function* (
    text: string,
    sourceLang: string,
    targetLang: string,
    token?: string | null,
    useCache?: boolean,
  ): AsyncGenerator<string, void, unknown> {
    if (!text?.trim()) return;

    const apiKey = process.env['OPENAI_API_KEY'] || (typeof window !== 'undefined' ? (window as any).OPENAI_API_KEY : undefined);
    if (!apiKey) {
      throw new Error('OpenAI API key is not set.');
    }

    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const prompt = `Translate the following text from ${sourceLang} to ${targetLang}:\n"""${text}"""\nOnly return the translated text, nothing else.`;

    try {
      const stream = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: 'You are a translation engine.' },
          { role: 'user', content: prompt },
        ],
        max_tokens: 1000,
        stream: true,
      });

      // Only yield the delta (new chunk), not the accumulated string
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          yield delta;
        }
      }
    } catch {
      // fail silently
    }
  },
};
