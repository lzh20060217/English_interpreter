'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Mic, Pause, StopCircle, Sun, Moon, Languages, RefreshCw, AlertCircle, Wifi, WifiOff } from 'lucide-react';

import { useInterpreterStore } from '@/features/interpreter/store';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from '@/lib/config';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { cn } from '@/lib/utils';

export function ControlPanel() {
  const {
    theme,
    connectionStatus,
    sourceLanguage,
    targetLanguage,
    setTheme,
    setSourceLanguage,
    setTargetLanguage,
    clearAll,
    loadDemoData,
  } = useInterpreterStore();

  // WebSocket connection
  const {
    sendAudio,
    sendText,
    sendControl,
    connect: wsConnect,
    disconnect: wsDisconnect,
  } = useWebSocket();

  // Browser-based speech recognition (fallback when backend ASR is unavailable)
  const speechLang =
    sourceLanguage === 'zh' ? 'zh-CN' :
    sourceLanguage === 'en' ? 'en-US' :
    sourceLanguage === 'ja' ? 'ja-JP' :
    sourceLanguage === 'ko' ? 'ko-KR' :
    'zh-CN';

  const speech = useSpeechRecognition({
    language: speechLang,
    continuous: true,
    interimResults: true,
    onResult: (text, isFinal) => {
      if (isFinal && text.trim()) {
        // Send recognized text to backend for LLM processing
        sendText(text);
      }
    },
  });

  // Audio recorder with PCM callback → WebSocket
  const {
    status,
    isRecording,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    error,
    audioLevel,
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    permissionState,
  } = useAudioRecorder({
    onAudioChunk: (chunk) => {
      sendAudio(chunk);
    },
  });

  // Track if we manually stopped to avoid re-triggering
  const manualStopRef = useRef(false);

  const handleToggleListening = useCallback(() => {
    if (status === 'idle' || status === 'stopped' || status === 'error') {
      manualStopRef.current = false;
      // Connect WebSocket first, then start recording
      wsConnect();
      if (speech.isSupported) {
        speech.start();
      }
      startRecording();
    } else if (status === 'recording') {
      sendControl('pause');
      pauseRecording();
      speech.stop();
    } else if (status === 'paused') {
      sendControl('resume');
      resumeRecording();
      if (speech.isSupported) {
        speech.start();
      }
    }
  }, [status, startRecording, pauseRecording, resumeRecording, wsConnect, speech, sendControl]);

  const handleStop = useCallback(() => {
    manualStopRef.current = true;
    sendControl('stop');
    stopRecording();
    speech.stop();
    wsDisconnect();
  }, [stopRecording, speech, wsDisconnect, sendControl]);

  // Clean up WebSocket and speech recognition when recording errors
  useEffect(() => {
    if (status === 'error' && !manualStopRef.current) {
      wsDisconnect();
      speech.stop();
    }
  }, [status, wsDisconnect, speech]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle': return '就绪';
      case 'requesting': return '请求麦克风权限...';
      case 'recording': return '正在录音...';
      case 'paused': return '已暂停';
      case 'stopped': return '已停止';
      case 'error': return error || '发生错误';
      default: return '就绪';
    }
  };

  // Connection status dot
  const getConnectionDot = () => {
    switch (connectionStatus) {
      case 'connected': return { color: 'bg-green-500', text: '已连接' };
      case 'connecting': return { color: 'bg-yellow-500 animate-pulse', text: '连接中...' };
      case 'error': return { color: 'bg-red-500', text: '连接失败' };
      default: return { color: 'bg-zinc-400', text: '未连接' };
    }
  };

  const connDot = getConnectionDot();

  // Audio level bar color
  const getLevelBarColor = () => {
    if (audioLevel < 0.3) return 'bg-green-500';
    if (audioLevel < 0.6) return 'bg-amber-500';
    return 'bg-red-500';
  };

  // Permission warning
  const showPermissionWarning = permissionState === 'denied';
  const showPermissionInfo = permissionState === 'prompt' && status === 'idle';

  return (
    <div className={cn(
      'border-b px-6 py-4 flex flex-col gap-2',
      theme === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-white border-zinc-200'
    )}>
      {/* Main control row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-2 rounded-lg',
              theme === 'dark' ? 'bg-cyan-950/50 text-cyan-400' : 'bg-cyan-50 text-cyan-600'
            )}>
              <Languages size={24} />
            </div>
            <h1 className={cn(
              'text-xl font-bold',
              theme === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
            )}>
              AI 智能同传助手
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Language selectors */}
          <div className="flex items-center gap-2">
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-cyan-500',
                theme === 'dark'
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                  : 'bg-zinc-50 border-zinc-300 text-zinc-900'
              )}
            >
              {SOURCE_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <span className={theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400'}>→</span>
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-lg text-sm border focus:outline-none focus:ring-2 focus:ring-cyan-500',
                theme === 'dark'
                  ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                  : 'bg-zinc-50 border-zinc-300 text-zinc-900'
              )}
            >
              {TARGET_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Connection status */}
          <div className="flex items-center gap-1.5" title={connDot.text}>
            {connectionStatus === 'connected'
              ? <Wifi size={14} className="text-green-400" />
              : connectionStatus === 'connecting'
                ? <Wifi size={14} className="text-yellow-400 animate-pulse" />
                : <WifiOff size={14} className="text-zinc-500" />
            }
            <span className="text-[10px] text-zinc-500">{connDot.text}</span>
          </div>

          <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Recording controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleListening}
              disabled={status === 'requesting'}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                isRecording
                  ? 'bg-amber-500 hover:bg-amber-600 text-white'
                  : 'bg-cyan-600 hover:bg-cyan-700 text-white',
                status === 'requesting' && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isRecording ? <Pause size={18} /> : <Mic size={18} />}
              {isRecording ? '暂停' : status === 'paused' ? '继续' : '开始录音'}
            </button>
            {(status === 'recording' || status === 'paused') && (
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-zinc-600 hover:bg-zinc-700 text-white transition-all"
              >
                <StopCircle size={18} />
                停止
              </button>
            )}
          </div>

          {/* Audio level indicator */}
          {isRecording && (
            <div className="flex items-center gap-2">
              <div className="w-20 h-2 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-75', getLevelBarColor())}
                  style={{ width: `${Math.max(audioLevel * 100, 4)}%` }}
                />
              </div>
              <span className={cn(
                'text-xs font-mono w-8 text-right',
                theme === 'dark' ? 'text-zinc-400' : 'text-zinc-500'
              )}>
                {Math.round(audioLevel * 100)}%
              </span>
            </div>
          )}

          {/* Microphone device selector */}
          {devices.length > 1 && (
            <>
              <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700" />
              <div className="relative">
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className={cn(
                    'px-2 py-2 rounded-lg text-xs border max-w-[160px] focus:outline-none focus:ring-2 focus:ring-cyan-500',
                    theme === 'dark'
                      ? 'bg-zinc-900 border-zinc-700 text-zinc-100'
                      : 'bg-zinc-50 border-zinc-300 text-zinc-900'
                  )}
                >
                  {devices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={refreshDevices}
                  className={cn(
                    'ml-1 p-1.5 rounded transition-all inline-flex',
                    theme === 'dark'
                      ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                      : 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
                  )}
                  title="刷新设备列表"
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </>
          )}

          <div className="h-8 w-px bg-zinc-300 dark:bg-zinc-700" />

          {/* Utility buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadDemoData}
              className={cn(
                'p-2 rounded-lg text-sm transition-all',
                theme === 'dark'
                  ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  : 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
              )}
              title="加载演示数据"
            >
              演示数据
            </button>
            <button
              onClick={clearAll}
              className={cn(
                'p-2 rounded-lg text-sm transition-all',
                theme === 'dark'
                  ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  : 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
              )}
              title="清空"
            >
              清空
            </button>
            <button
              onClick={toggleTheme}
              className={cn(
                'p-2 rounded-lg transition-all',
                theme === 'dark'
                  ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  : 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900'
              )}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Status and error row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Status text */}
        <div className={cn(
          'text-xs',
          status === 'error' ? 'text-red-400' : status === 'recording' ? 'text-amber-400' : (theme === 'dark' ? 'text-zinc-500' : 'text-zinc-400')
        )}>
          {status === 'recording' && <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse mr-1" />}
          {getStatusText()}
        </div>

        {/* Speech recognition indicator */}
        {speech.isListening && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400">
            浏览器语音识别
          </span>
        )}

        {/* Connection error notice */}
        {connectionStatus === 'error' && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <AlertCircle size={12} />
            <span>后端未连接，翻译/笔记功能不可用</span>
          </div>
        )}

        {/* Permission warnings */}
        {showPermissionWarning && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertCircle size={12} />
            <span>麦克风已被阻止。请在 Chrome 地址栏左侧点击 🔒 → 网站设置 → 麦克风 → 允许</span>
          </div>
        )}
        {showPermissionInfo && (
          <div className="flex items-center gap-1 text-xs text-amber-400">
            <AlertCircle size={12} />
            <span>点击「开始录音」将请求麦克风权限</span>
          </div>
        )}
      </div>
    </div>
  );
}
