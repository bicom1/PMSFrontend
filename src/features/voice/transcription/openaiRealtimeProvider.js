/**
 * OpenAI Realtime Transcription provider (WebRTC).
 * Keeps the AI data channel separate from MediaRecorder audio capture.
 * Session secrets come from POST /doctor/voice/realtime-session and are renewed automatically.
 */
export function createOpenAiRealtimeProvider({
  session,
  onPartial,
  onFinal,
  onStatus,
  onError,
  renewSession,
}) {
  let pc = null;
  let dc = null;
  let localStream = null;
  let currentSession = session;
  let renewTimer = null;
  let active = false;
  let shouldRun = false;

  function isSupported() {
    return typeof RTCPeerConnection !== 'undefined' && Boolean(currentSession?.clientSecret);
  }

  function clearRenew() {
    if (renewTimer) clearTimeout(renewTimer);
    renewTimer = null;
  }

  function scheduleRenewal() {
    clearRenew();
    const expiresAt = Number(currentSession?.expiresAt || 0);
    if (!expiresAt) return;
    const ms = Math.max(30_000, expiresAt * 1000 - Date.now() - 60_000);
    renewTimer = setTimeout(async () => {
      try {
        const next = await renewSession?.();
        if (next?.clientSecret) {
          currentSession = next;
          onStatus?.('session-renewed');
          scheduleRenewal();
        }
      } catch (error) {
        onError?.(error);
      }
    }, ms);
  }

  async function connect() {
    if (!isSupported()) throw new Error('OpenAI Realtime WebRTC is not available');
    pc = new RTCPeerConnection();
    dc = pc.createDataChannel('oai-events');
    dc.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const type = message.type || '';
        if (type.includes('transcription.delta') || type.includes('audio_transcription.delta')) {
          const text = message.delta || message.text || '';
          if (text) onPartial?.(text);
        }
        if (type.includes('transcription.completed') || type.includes('audio_transcription.completed')) {
          const text = message.transcript || message.text || '';
          if (text) onFinal?.(text);
        }
      } catch {
        // Non-JSON events ignored
      }
    };

    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    const base = (currentSession.webrtcUrl || 'https://api.openai.com/v1/realtime').replace(/\/$/, '');
    const model = encodeURIComponent(currentSession.model || 'gpt-4o-realtime-preview');
    const response = await fetch(`${base}?model=${model}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${currentSession.clientSecret}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });
    if (!response.ok) {
      throw new Error(`OpenAI Realtime WebRTC handshake failed (${response.status})`);
    }
    const answer = await response.text();
    await pc.setRemoteDescription({ type: 'answer', sdp: answer });
    scheduleRenewal();
    onStatus?.('ready');
  }

  async function start() {
    shouldRun = true;
    active = true;
    localStream?.getAudioTracks().forEach((track) => { track.enabled = true; });
    onStatus?.('listening');
  }

  async function pause() {
    shouldRun = false;
    active = false;
    localStream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    onStatus?.('paused');
  }

  async function resume() {
    await start();
  }

  async function stop() {
    shouldRun = false;
    active = false;
    localStream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    onStatus?.('stopped');
  }

  async function disconnect() {
    await stop();
    clearRenew();
    try { dc?.close(); } catch { /* ignore */ }
    try { pc?.close(); } catch { /* ignore */ }
    localStream?.getTracks().forEach((track) => track.stop());
    dc = null;
    pc = null;
    localStream = null;
  }

  return {
    name: 'openai-realtime',
    isSupported,
    connect,
    start,
    pause,
    resume,
    stop,
    disconnect,
    isActive: () => active && shouldRun,
  };
}
