'use client';

import { useCallback, useState } from 'react';
import { Mic, Pause, StopCircle, Sun, Moon, Languages, RefreshCw, AlertCircle } from 'lucide-react';

import { useInterpreterStore } from '@/features/interpreter/store';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from '@/lib/config';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

export function ControlPanel() {
  const {
    theme,
    sourceLanguage,
    targetLanguage,
    setTheme,
    setSourceLanguage,
    setTargetLanguage,
    clearAll,
    loadDemoData,
  } = useInterpreterStore();

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
  } = useAudioRecorder();

  const [showDeviceMenu, setShowDeviceMenu] = useState(false);

  const handleToggleListening = useCallback(() => {
    if (status === 'idle' || status === 'stopped' || status === 'error') {
      startRecording();
    } else if (status === 'recording') {
      pauseRecording();
    } else if (status === 'paused') {
      resumeRecording();
    }
  }, [status, startRecording, pauseRecording, resumeRecording]);

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
                onClick={stopRecording}
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
