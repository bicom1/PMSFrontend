import { createBrowserSpeechProvider } from './browserSpeechProvider.js';
import { createOpenAiRealtimeProvider } from './openaiRealtimeProvider.js';

/**
 * Modular transcription factory.
 * - Prefers OpenAI Realtime (WebRTC) when the backend returns a configured session.
 * - Falls back to the browser SpeechRecognition API (real STT, not mocked).
 * Audio capture stays independent of whichever AI provider is active.
 */
export async function createTranscriptionProvider({ onPartial, onFinal, onStatus, onError, createRealtimeSession }) {
  try {
    const session = await createRealtimeSession();
    if (session?.configured && session.provider === 'openai-realtime' && session.clientSecret) {
      const provider = createOpenAiRealtimeProvider({
        session,
        onPartial,
        onFinal,
        onStatus,
        onError,
        renewSession: createRealtimeSession,
      });
      await provider.connect();
      return provider;
    }
  } catch (error) {
    onStatus?.('openai-unavailable');
    onError?.(error);
  }

  const browser = createBrowserSpeechProvider({ onPartial, onFinal, onStatus, onError });
  if (!browser.isSupported()) {
    throw new Error('Live transcription is unavailable in this browser. Recording still works.');
  }
  await browser.connect();
  return browser;
}
