'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped' | 'error';

interface AudioDevice {
  deviceId: string;
  label: string;
}

interface UseAudioRecorderReturn {
  status: RecorderStatus;
  isRecording: boolean;
  startRecording: (deviceId?: string) => Promise<void>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  stopRecording: () => void;
  error: string | null;
  audioContext: AudioContext | null;
  audioLevel: number; // 0-1 audio level for visual feedback
  devices: AudioDevice[];
  selectedDeviceId: string;
  setSelectedDeviceId: (id: string) => void;
  refreshDevices: () => Promise<void>;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported';
}

function getSecureContextStatus(): { ok: boolean; message: string } {
  if (typeof window === 'undefined') {
    return { ok: false, message: '不在浏览器环境中运行' };
  }
  if (window.isSecureContext) {
    return { ok: true, message: '当前页面是安全上下文 (HTTPS 或 localhost)' };
  }
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    return { ok: true, message: 'localhost 被视为安全上下文' };
  }
  return {
    ok: false,
    message:
      '当前页面不是安全上下文。麦克风访问需要 HTTPS。\n' +
      '你正在通过 ' +
      location.protocol +
      '//' +
      location.hostname +
      ' 访问。\n' +
      '解决方案：使用 HTTPS 或 localhost 访问。',
  };
}

function getChromePermissionState(): Promise<PermissionState | 'unsupported'> {
  if (navigator.permissions && navigator.permissions.query) {
    return navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then((result) => result.state)
      .catch(() => 'unsupported' as PermissionState);
  }
  return Promise.resolve('unsupported');
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default');
  const [permissionState, setPermissionState] = useState<
    'prompt' | 'granted' | 'denied' | 'unsupported'
  >('prompt');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isCleaningUpRef = useRef(false);
  const statusRef = useRef<RecorderStatus>('idle');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Check permission state on mount
  useEffect(() => {
    getChromePermissionState().then((state) => {
      if (state === 'denied') {
        setPermissionState('denied');
        setError(
          '麦克风权限已被浏览器阻止。请在 Chrome 设置 → 隐私与安全 → 网站设置 → 麦克风中，允许此网站访问麦克风。'
        );
      } else if (state === 'granted') {
        setPermissionState('granted');
      } else if (state === 'prompt') {
        setPermissionState('prompt');
      } else {
        setPermissionState('unsupported');
      }
    });
  }, []);

  // Auto-refresh device list on mount
  useEffect(() => {
    const initDevices = async () => {
      try {
        // Get existing device labels (may be empty if no permission yet)
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `麦克风 (${d.deviceId.slice(0, 8)}...)` }));
        if (audioInputs.length > 0) {
          setDevices(audioInputs);
        }
      } catch {
        // Ignore enumeration errors
      }
    };
    initDevices();
  }, []);

  // Listen for device changes
  useEffect(() => {
    const handleDeviceChange = async () => {
      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = allDevices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({
            deviceId: d.deviceId,
            label: d.label || `麦克风 (${d.deviceId.slice(0, 8)}...)`,
          }));
        setDevices(audioInputs);
      } catch {
        // Ignore
      }
    };

    navigator.mediaDevices?.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  const refreshDevices = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `麦克风 (${d.deviceId.slice(0, 8)}...)`,
        }));
      setDevices(audioInputs);
      if (audioInputs.length === 0) {
        setError('未检测到任何麦克风设备，请检查麦克风连接。');
      }
    } catch (err) {
      console.warn('Failed to enumerate devices:', err);
    }
  }, []);

  const startRecording = useCallback(
    async (deviceId?: string) => {
      console.log('[Recorder] startRecording called, current status:', statusRef.current);

      // Check secure context
      const secureCtx = getSecureContextStatus();
      if (!secureCtx.ok) {
        setError(secureCtx.message);
        setStatus('error');
        return;
      }

      try {
        setStatus('requesting');
        setError(null);

        const constraints: MediaStreamConstraints = {
          audio: {
            deviceId: deviceId || selectedDeviceId || 'default',
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        };

        console.log('[Recorder] getUserMedia constraints:', JSON.stringify(constraints));
        const stream = await navigator.mediaDevices.getUserMedia(constraints);

        console.log('[Recorder] getUserMedia success');
        audioStreamRef.current = stream;

        // Get actual device label after permission granted
        const track = stream.getAudioTracks()[0];
        if (track) {
          console.log('[Recorder] Using audio device:', track.label);
          // Refresh device list with real labels
          refreshDevices();
        }

        // Set up audio analyser for level detection
        const ctx = new AudioContext();
        setAudioContext(ctx);
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        // Start level detection
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          if (analyserRef.current) {
            analyserRef.current.getByteTimeDomainData(dataArray);
            let max = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const v = Math.abs(dataArray[i] - 128);
              if (v > max) max = v;
            }
            setAudioLevel(max / 128); // Scale to 0-1
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          }
        };
        updateLevel();

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          console.log('[Recorder] MediaRecorder stopped');
          if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
          }
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
          }
          setAudioLevel(0);
          analyserRef.current = null;
        };

        mediaRecorder.onerror = (event) => {
          console.error('[Recorder] MediaRecorder error:', event);
          setError('录音器发生错误');
          setStatus('error');
        };

        mediaRecorder.start(100);
        setPermissionState('granted');
        setStatus('recording');
        console.log('[Recorder] MediaRecorder started with mimeType:', mimeType);
      } catch (err) {
        console.error('[Recorder] Failed to start recording:', err);
        const errorMessage = mapGetUserMediaError(err);
        setError(errorMessage);
        setStatus('error');

        // Check if permanently denied
        if (
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')
        ) {
          setPermissionState('denied');
        }
      }
    },
    [selectedDeviceId, refreshDevices]
  );

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && statusRef.current === 'recording') {
      mediaRecorderRef.current.pause();
      setStatus('paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && statusRef.current === 'paused') {
      mediaRecorderRef.current.resume();
      setStatus('recording');
    }
  }, []);

  const stopRecording = useCallback(() => {
    isCleaningUpRef.current = true;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    setAudioLevel(0);
    analyserRef.current = null;

    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(console.warn);
    }
    setAudioContext(null);

    setStatus('stopped');
    chunksRef.current = [];

    setTimeout(() => {
      isCleaningUpRef.current = false;
    }, 100);
  }, [audioContext]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isCleaningUpRef.current) return;
      isCleaningUpRef.current = true;

      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          console.warn('MediaRecorder stop error:', e);
        }
      }
      mediaRecorderRef.current = null;

      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((t) => t.stop());
        audioStreamRef.current = null;
      }

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (audioContext && audioContext.state !== 'closed') {
        try {
          audioContext.close();
        } catch (e) {
          console.warn('AudioContext close error:', e);
        }
      }
    };
  }, [audioContext]);

  return {
    status,
    isRecording: status === 'recording',
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    error,
    audioContext,
    audioLevel,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    permissionState,
  };
}

function mapGetUserMediaError(err: unknown): string {
  if (err instanceof DOMException || err instanceof Error) {
    const name = (err as DOMException).name || '';
    const message = err.message;

    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return (
        '麦克风权限被拒绝。\n' +
        '请在 Chrome 中点击地址栏左侧的 🔒 或 ⓘ 图标 → 网站设置 → 麦克风 → 允许。\n' +
        '或者检查是否有其他应用正在使用麦克风。'
      );
    }
    if (name === 'NotFoundError') {
      return '未检测到麦克风设备。请连接麦克风后重试。';
    }
    if (name === 'NotReadableError') {
      return '麦克风被其他应用占用，请关闭其他使用麦克风的程序后重试。';
    }
    if (name === 'AbortError') {
      return '麦克风请求被中断，请重试。';
    }
    if (name === 'TypeError' || message?.includes('constraints')) {
      return '音频配置参数无效，请刷新页面重试。';
    }
    if (name === 'SecurityError') {
      return (
        '浏览器安全策略阻止了麦克风访问。\n' +
        '请使用 HTTPS 或 localhost 访问此页面。'
      );
    }
  }
  return `无法访问麦克风: ${err instanceof Error ? err.message : '未知错误'}`;
}
