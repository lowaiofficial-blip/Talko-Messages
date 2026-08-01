import React, { useState, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, Send } from 'lucide-react';

interface VoiceRecorderProps {
  onSendVoice: (duration: number, audioUrl: string) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSendVoice, onCancel }) => {
  const [isRecording, setIsRecording] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const handleStop = () => {
    setIsRecording(false);
  };

  const handleSend = () => {
    // Generate simulated audio data URL
    const simulatedAudioUrl = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    onSendVoice(Math.max(1, seconds), simulatedAudioUrl);
  };

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-2xl animate-fadeIn">
      <div className="flex items-center gap-2 flex-1">
        {isRecording ? (
          <div className="flex items-center gap-2 text-red-600 font-mono font-bold text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping" />
            <span>Kaydediliyor... {formatTime(seconds)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} />}
            </button>
            <span className="text-xs font-mono font-semibold text-slate-700">Sesli Mesaj ({formatTime(seconds)})</span>
          </div>
        )}

        {/* Waveform bars */}
        <div className="flex items-center gap-0.5 h-4 flex-1 max-w-[120px] px-2">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className={`flex-1 rounded-full bg-blue-500 transition-all ${
                isRecording ? 'animate-pulse' : ''
              }`}
              style={{
                height: isRecording
                  ? `${Math.floor(20 + Math.random() * 80)}%`
                  : `${Math.floor(30 + Math.sin(i) * 50)}%`,
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onCancel}
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          title="İptal Et"
        >
          <Trash2 size={18} />
        </button>

        {isRecording ? (
          <button
            onClick={handleStop}
            className="p-2 text-red-600 hover:bg-red-100 rounded-xl transition-colors font-semibold text-xs flex items-center gap-1"
          >
            <Square size={16} /> Durdur
          </button>
        ) : (
          <button
            onClick={handleSend}
            className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 active:scale-95 transition-all"
            title="Gönder"
          >
            <Send size={18} />
          </button>
        )}
      </div>
    </div>
  );
};
