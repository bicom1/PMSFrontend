import { Mic, Pause, Play, Square, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, http, loadProtectedFile } from '../../services/api.js';
import { errorMessage, formatWhen } from '../../utils/format.js';
import { Badge, Button, Field, TextArea, useToast } from '../../components/common/ui.jsx';
import { createTranscriptionProvider } from './transcription/createTranscriptionProvider.js';

function formatDuration(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function recoveryKey(submissionId) {
  return `cpms-voice-draft:${submissionId}`;
}

export default function VoiceDocumentation({
  submissionId,
  canEdit,
  recordings: initialRecordings = [],
  onChanged,
}) {
  const toast = useToast();
  const [recordings, setRecordings] = useState(initialRecordings);
  const [status, setStatus] = useState('idle');
  const [providerName, setProviderName] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [livePartial, setLivePartial] = useState('');
  const [transcript, setTranscript] = useState('');
  const [recordingId, setRecordingId] = useState('');
  const [clientSessionId, setClientSessionId] = useState('');
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [busy, setBusy] = useState(false);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const providerRef = useRef(null);
  const startedAtRef = useRef(0);
  const accumulatedRef = useRef(0);
  const timerRef = useRef(null);
  const autosaveRef = useRef(null);
  const recordingIdRef = useRef('');

  useEffect(() => {
    setRecordings(initialRecordings || []);
  }, [initialRecordings]);

  useEffect(() => {
    recordingIdRef.current = recordingId;
  }, [recordingId]);

  useEffect(() => {
    const raw = localStorage.getItem(recoveryKey(submissionId));
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (draft?.transcript) setTranscript(draft.transcript);
      if (draft?.recordingId) setRecordingId(draft.recordingId);
      if (draft?.clientSessionId) setClientSessionId(draft.clientSessionId);
      if (draft?.durationMs) setDurationMs(draft.durationMs);
    } catch {
      // ignore corrupt drafts
    }
  }, [submissionId]);

  useEffect(() => () => {
    clearInterval(timerRef.current);
    clearInterval(autosaveRef.current);
    stopMediaTracks();
    providerRef.current?.disconnect?.();
    if (playbackUrl) URL.revokeObjectURL(playbackUrl);
  }, [playbackUrl]);

  function persistLocalDraft(next = {}) {
    const payload = {
      recordingId: next.recordingId ?? recordingIdRef.current,
      clientSessionId: next.clientSessionId ?? clientSessionId,
      transcript: next.transcript ?? transcript,
      durationMs: next.durationMs ?? durationMs,
      updatedAt: Date.now(),
    };
    localStorage.setItem(recoveryKey(submissionId), JSON.stringify(payload));
  }

  function stopMediaTracks() {
    mediaStreamRef.current?.getTracks?.().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }

  function startTimers() {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (!startedAtRef.current) return;
      setDurationMs(accumulatedRef.current + (Date.now() - startedAtRef.current));
    }, 250);
    clearInterval(autosaveRef.current);
    autosaveRef.current = setInterval(() => {
      autosaveDraft().catch(() => {});
    }, 8_000);
  }

  async function createRealtimeSession() {
    const body = await api.post('/doctor/voice/realtime-session');
    return body.data;
  }

  async function ensureProvider() {
    if (providerRef.current) return providerRef.current;
    const provider = await createTranscriptionProvider({
      createRealtimeSession,
      onPartial: (text) => setLivePartial(text),
      onFinal: (text) => {
        setTranscript((current) => {
          const next = `${current}${current && !current.endsWith(' ') ? ' ' : ''}${text}`.trim();
          persistLocalDraft({ transcript: next });
          return next;
        });
        setLivePartial('');
      },
      onStatus: (value) => setTranscriptStatus(value),
      onError: (error) => toast.error(errorMessage(error) || 'Transcription issue'),
    });
    providerRef.current = provider;
    setProviderName(provider.name);
    return provider;
  }

  async function autosaveDraft() {
    const id = recordingIdRef.current;
    if (!id || !canEdit) return;
    const elapsed = startedAtRef.current
      ? accumulatedRef.current + (Date.now() - startedAtRef.current)
      : accumulatedRef.current || durationMs;
    await api.patch(`/voice-recordings/${id}`, {
      status: status === 'paused' ? 'paused' : status === 'recording' ? 'recording' : undefined,
      durationMs: elapsed,
      transcriptDraft: `${transcript}${livePartial ? ` ${livePartial}` : ''}`.trim(),
      transcriptionProvider: providerName || undefined,
    });
    persistLocalDraft({ durationMs: elapsed });
  }

  async function startRecording() {
    if (!canEdit || busy) return;
    setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = async (event) => {
        if (!event.data?.size) return;
        chunksRef.current.push(event.data);
        const id = recordingIdRef.current;
        if (!id) return;
        try {
          const form = new FormData();
          form.append('audio', event.data, `chunk-${Date.now()}.webm`);
          form.append('asChunk', 'true');
          form.append('chunkIndex', String(chunksRef.current.length - 1));
          form.append('durationMs', String(accumulatedRef.current + (Date.now() - (startedAtRef.current || Date.now()))));
          await http.post(`/voice-recordings/${id}/audio`, form);
        } catch {
          // Keep local chunks; final upload recovers on stop
        }
      };

      const sessionId = clientSessionId || (crypto.randomUUID?.() || `voice-${Date.now()}`);
      setClientSessionId(sessionId);
      const created = await api.post(`/submissions/${submissionId}/voice-recordings`, {
        clientSessionId: sessionId,
        mimeType: recorder.mimeType || 'audio/webm',
        status: 'recording',
        transcriptionProvider: providerName || '',
      });
      setRecordingId(created.data.id);
      recordingIdRef.current = created.data.id;
      persistLocalDraft({ recordingId: created.data.id, clientSessionId: sessionId });

      let provider;
      try {
        provider = await ensureProvider();
        await provider.start();
      } catch (error) {
        toast.error(errorMessage(error) || 'Live transcription unavailable — audio will still be saved.');
      }

      recorder.start(10_000);
      accumulatedRef.current = 0;
      startedAtRef.current = Date.now();
      setDurationMs(0);
      setStatus('recording');
      startTimers();
      toast.success('Recording started');
    } catch (error) {
      stopMediaTracks();
      toast.error(errorMessage(error) || 'Microphone access failed');
      setStatus('idle');
    } finally {
      setBusy(false);
    }
  }

  async function pauseRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    recorder.pause();
    if (startedAtRef.current) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = 0;
    }
    setDurationMs(accumulatedRef.current);
    setStatus('paused');
    await providerRef.current?.pause?.();
    await autosaveDraft();
  }

  async function resumeRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return;
    recorder.resume();
    startedAtRef.current = Date.now();
    setStatus('recording');
    await providerRef.current?.resume?.();
    startTimers();
  }

  async function stopRecording() {
    const recorder = mediaRecorderRef.current;
    if (!recorder || status === 'idle') return;
    setBusy(true);
    clearInterval(timerRef.current);
    clearInterval(autosaveRef.current);
    if (startedAtRef.current) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = 0;
    }
    const finalDuration = accumulatedRef.current;
    setDurationMs(finalDuration);

    await new Promise((resolve) => {
      recorder.onstop = resolve;
      try { recorder.stop(); } catch { resolve(); }
    });
    stopMediaTracks();
    await providerRef.current?.stop?.();
    await providerRef.current?.disconnect?.();
    providerRef.current = null;

    try {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
      const id = recordingIdRef.current;
      if (id && blob.size) {
        const form = new FormData();
        form.append('audio', blob, `consultation-${submissionId}.webm`);
        form.append('durationMs', String(finalDuration));
        await http.post(`/voice-recordings/${id}/audio`, form);
        await api.patch(`/voice-recordings/${id}`, {
          status: 'ready',
          durationMs: finalDuration,
          transcriptDraft: transcript,
          transcript,
          finalizeTranscript: true,
          transcriptionProvider: providerName || undefined,
        });
      }
      localStorage.removeItem(recoveryKey(submissionId));
      setStatus('idle');
      toast.success('Recording saved');
      onChanged?.();
      const list = await api.get(`/submissions/${submissionId}/voice-recordings`);
      setRecordings(list.data || []);
    } catch (error) {
      setStatus('failed');
      toast.error(errorMessage(error) || 'Could not save recording');
      persistLocalDraft({ durationMs: finalDuration, transcript });
    } finally {
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setBusy(false);
    }
  }

  async function saveTranscriptEdits() {
    if (!recordingId) {
      toast.error('Start a recording before saving the transcript');
      return;
    }
    try {
      await api.patch(`/voice-recordings/${recordingId}`, {
        transcript,
        transcriptDraft: transcript,
        finalizeTranscript: true,
      });
      persistLocalDraft({ transcript });
      toast.success('Transcript saved');
      onChanged?.();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function playRecording(item) {
    try {
      if (playbackUrl) URL.revokeObjectURL(playbackUrl);
      const file = await loadProtectedFile(`/voice-recordings/${item.id}/audio`, {
        mimeType: item.mimeType,
        filename: `${item.patientCode || 'voice'}.webm`,
      });
      setPlaybackUrl(file.url);
    } catch (error) {
      toast.error(errorMessage(error) || 'Playback failed');
    }
  }

  const statusTone = status === 'recording' ? 'rose' : status === 'paused' ? 'amber' : status === 'failed' ? 'rose' : 'slate';

  return (
    <section className="space-y-4">
      <div className="card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-ink-900">Voice documentation</h2>
            <p className="mt-1 text-sm font-bold text-slate-600">
              Record consultation audio independently of live transcription. Transcripts autosave and can be edited.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone={statusTone}>{status}</Badge>
            {providerName && <Badge tone="teal">{providerName}</Badge>}
            <Badge tone="slate">{formatDuration(durationMs)}</Badge>
          </div>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            {status === 'idle' || status === 'failed' ? (
              <Button disabled={busy} onClick={startRecording}><Mic size={18} /> Start recording</Button>
            ) : null}
            {status === 'recording' ? (
              <Button variant="secondary" onClick={pauseRecording}><Pause size={18} /> Pause</Button>
            ) : null}
            {status === 'paused' ? (
              <Button onClick={resumeRecording}><Play size={18} /> Resume</Button>
            ) : null}
            {status === 'recording' || status === 'paused' ? (
              <Button variant="danger" onClick={stopRecording} disabled={busy}><Square size={18} /> Stop & save</Button>
            ) : null}
          </div>
        ) : (
          <p className="text-sm font-bold text-slate-600">Only the assigned doctor can create voice documentation for this visit.</p>
        )}

        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
          Transcription {transcriptStatus}{providerName ? ` · ${providerName}` : ''}
        </p>

        <Field label="Live / editable transcript">
          <TextArea
            rows={8}
            value={`${transcript}${livePartial ? `${transcript ? ' ' : ''}${livePartial}` : ''}`}
            onChange={(event) => {
              setLivePartial('');
              setTranscript(event.target.value);
              persistLocalDraft({ transcript: event.target.value });
            }}
            placeholder="Transcript appears here as you speak. You can edit before saving."
            disabled={!canEdit}
          />
        </Field>
        {canEdit && (
          <Button variant="secondary" onClick={saveTranscriptEdits} disabled={!recordingId}>
            <Save size={18} /> Save transcript
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {(recordings || []).map((item) => (
          <article key={item.id} className="card space-y-3 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-ink-900">{item.doctorName}</h3>
                <p className="text-sm font-bold text-slate-500">
                  {formatDuration(item.durationMs)} · {item.status} · {formatWhen(item.createdAt)}
                </p>
              </div>
              {item.hasAudio && (
                <Button size="sm" variant="secondary" onClick={() => playRecording(item)}>
                  <Play size={16} /> Play
                </Button>
              )}
            </div>
            {(item.transcript || item.transcriptDraft) && (
              <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm text-ink-900">
                {item.transcript || item.transcriptDraft}
              </p>
            )}
          </article>
        ))}
        {!recordings?.length && status === 'idle' && (
          <p className="card p-5 text-base font-bold text-slate-600">No voice recordings for this visit yet.</p>
        )}
      </div>

      {playbackUrl && (
        <div className="card p-4">
          <audio controls autoPlay src={playbackUrl} className="w-full" />
        </div>
      )}
    </section>
  );
}
