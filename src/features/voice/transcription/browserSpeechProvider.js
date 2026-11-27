export function createBrowserSpeechProvider({ onPartial, onFinal, onStatus, onError }) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let active = false;
  let shouldRun = false;

  function isSupported() {
    return Boolean(SpeechRecognition);
  }

  async function connect() {
    if (!isSupported()) throw new Error('SpeechRecognition is not supported');
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => onStatus?.('listening');
    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      onError?.(new Error(event.error || 'Speech recognition error'));
    };
    recognition.onend = () => {
      onStatus?.('idle');
      if (shouldRun) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };
    recognition.onresult = (event) => {
      let interim = '';
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) finalText += `${text} `;
        else interim += text;
      }
      if (interim) onPartial?.(interim.trim());
      if (finalText.trim()) onFinal?.(finalText.trim());
    };
    onStatus?.('ready');
  }

  async function start() {
    if (!recognition) await connect();
    shouldRun = true;
    active = true;
    try {
      recognition.start();
    } catch {
      // Ignored when already started
    }
  }

  async function pause() {
    shouldRun = false;
    active = false;
    try { recognition?.stop(); } catch { /* ignore */ }
    onStatus?.('paused');
  }

  async function resume() {
    await start();
  }

  async function stop() {
    shouldRun = false;
    active = false;
    try { recognition?.stop(); } catch { /* ignore */ }
    onStatus?.('stopped');
  }

  async function disconnect() {
    await stop();
    recognition = null;
  }

  return {
    name: 'browser-speech',
    isSupported,
    connect,
    start,
    pause,
    resume,
    stop,
    disconnect,
    isActive: () => active,
  };
}
