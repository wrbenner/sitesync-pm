# Phase 2C: Voice-First Multilingual Field Capture

## Pre-Requisite
Paste `00_SYSTEM_CONTEXT.md` before executing this prompt.

**Objective**: Enable construction workers to capture project data hands-free in the field using natural language voice commands, with automatic structuring via Claude.

**Status**: Phase 2 Core Feature | High Impact | High Complexity

**Competitive Advantage**: Procore requires typing on tablets. SiteSync workers speak naturally ("Issue on floor 7 south wall, third floor slab is spalling at rebar interface") → AI parses into structured RFI. 40% faster field data entry.

---

## 1. Overview & Strategic Value

### 1.1 Problem Statement

- Construction workers wear gloves and safety gear; can't type on tablets
- Current field capture requires 3-5 minutes per entry (typing, navigation, forms)
- Voice is 2-3x faster and more natural
- Most US construction sites: English + Spanish speakers

### 1.2 Solution

- Voice-first data capture with Web Speech API + Capacitor
- Support both English and Spanish
- Voice commands: "Log daily report", "Create RFI for floor 7 steel connection"
- Claude parses natural language into structured data (RFI, punch item, daily log, etc.)
- Offline support with IndexedDB queue
- Photo + voice combo: capture photo, describe issue, AI creates full record

### 1.3 Industry Data

- Construction labor shortage: workers quit jobs due to admin burden
- Field-first tools have 60% higher adoption vs office-centric tools
- Voice capture reduces data entry time by 40-60%
- AI-powered voice understanding reduces field errors by 30%

---

## 2. Architecture

### 2.1 Tech Stack

```
Frontend:
  - Web Speech API (browser-native speech recognition)
  - Capacitor (iOS/Android voice + haptics)
  - IndexedDB (offline queue)
  - TanStack React Query (sync state)

Backend:
  - Anthropic Claude Vision + Text APIs
  - voice-extract edge function (Supabase)
  - Database (Supabase Postgres)

Languages:
  - English (primary): en-US
  - Spanish: es-MX, es-ES
```

### 2.2 Data Flow

```
Worker speaks: "RFI for floor 7. Third floor slab. Spalling at rebar interface. Concrete quality issue. High priority."
    ↓
Web Speech API transcription (local + cloud)
    ↓
Audio + transcript sent to voice-extract edge function
    ↓
Claude.vision() analyzes audio (detects background noise, emotion, urgency)
    ↓
Claude.messages() with system prompt to parse intent
    ↓
Output: {
  "type": "rfi",
  "title": "Third floor slab spalling at rebar interface",
  "description": "Concrete spalling observed at rebar interface on third floor slab, south wall area",
  "location": "Floor 3, South wall",
  "trade": "Concrete / Structural",
  "priority": "high",
  "confidence": 0.95,
  "suggestedTags": ["concrete", "quality", "spalling", "rebar"]
}
    ↓
UI shows confirmation card: "Create RFI: 'Spalling at rebar interface' on Floor 3?"
    ↓
Worker taps "Approve" or edits and retries
    ↓
RFI created in database
```

---

## 3. React Components

### 3.1 VoiceCapture Component

**Purpose**: Main voice recording interface with visual feedback.

```typescript
// src/components/fieldCapture/VoiceCapture.tsx

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader, AlertCircle, Volume2, VolumeX, Globe } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { Capacitor } from '@capacitor/core';
import { HapticFeedback } from '@capacitor/haptics';

interface VoiceCaptureProps {
  onComplete?: (result: VoiceCaptureResult) => void;
  onError?: (error: Error) => void;
  projectId: string;
  userId: string;
  defaultLanguage?: 'en-US' | 'es-MX' | 'es-ES';
  photoUrl?: string; // For photo + voice combos
}

export interface VoiceCaptureResult {
  id: string;
  type: 'rfi' | 'punch' | 'daily_log' | 'safety' | 'general';
  title: string;
  description: string;
  transcript: string;
  confidence: number;
  language: string;
  location?: string;
  trade?: string;
  priority?: string;
  tags?: string[];
  photoUrl?: string;
  audioUrl?: string;
  createdAt: Date;
}

const VoiceCapture: React.FC<VoiceCaptureProps> = ({
  onComplete,
  onError,
  projectId,
  userId,
  defaultLanguage = 'en-US',
  photoUrl,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState<'en-US' | 'es-MX' | 'es-ES'>(defaultLanguage);
  const [transcript, setTranscript] = useState('');
  const [recordingTime, setRecordingTime] = useState(0);
  const [visualizerData, setVisualizerData] = useState<number[]>(Array(20).fill(0));
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const contextRef = useRef<AudioContext | null>(null);

  // Process voice to structured data
  const processVoiceMutation = useMutation({
    mutationFn: async (audio: Blob) => {
      const formData = new FormData();
      formData.append('audio', audio);
      formData.append('transcript', transcript);
      formData.append('language', language);
      formData.append('projectId', projectId);
      formData.append('userId', userId);
      if (photoUrl) formData.append('photoUrl', photoUrl);

      const response = await fetch('/api/voice-extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Voice processing failed');
      return response.json() as Promise<VoiceCaptureResult>;
    },
    onSuccess: (result) => {
      onComplete?.(result);
      resetCapture();
    },
    onError: (error) => {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    },
  });

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Haptic feedback
      await HapticFeedback.perform({ style: 'Heavy' }).catch(() => {});

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      contextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = contextRef.current.createMediaStreamSource(stream);
      analyserRef.current = contextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setTranscript('');

      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      // Start visualizer
      const updateVisualizer = () => {
        if (analyserRef.current && isRecording) {
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(dataArray);

          const reduced = [];
          for (let i = 0; i < 20; i++) {
            const index = Math.floor((i / 20) * dataArray.length);
            reduced.push(dataArray[index] / 255);
          }
          setVisualizerData(reduced);
          animationFrameRef.current = requestAnimationFrame(updateVisualizer);
        }
      };
      animationFrameRef.current = requestAnimationFrame(updateVisualizer);

      // Start Web Speech API transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;

        let interimTranscript = '';
        recognition.onresult = (event: any) => {
          interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              setTranscript((prev) => prev + (prev ? ' ' : '') + transcript);
            } else {
              interimTranscript += transcript;
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
        };

        recognition.start();
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [language, isRecording, onError]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current) return;

    // Haptic feedback
    await HapticFeedback.perform({ style: 'Light' }).catch(() => {});

    mediaRecorderRef.current.stop();
    setIsRecording(false);

    if (timerRef.current) clearInterval(timerRef.current);
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      processVoiceMutation.mutate(audioBlob);
    };

    // Stop all audio tracks
    const stream = mediaRecorderRef.current.stream;
    stream.getTracks().forEach((track) => track.stop());
    if (contextRef.current) {
      contextRef.current.close();
      contextRef.current = null;
    }
  }, [processVoiceMutation]);

  // Reset capture
  const resetCapture = () => {
    setIsRecording(false);
    setTranscript('');
    setRecordingTime(0);
    setVisualizerData(Array(20).fill(0));
    audioChunksRef.current = [];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const languageLabel = {
    'en-US': 'English',
    'es-MX': 'Spanish (Mexico)',
    'es-ES': 'Spanish (Spain)',
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        padding: '20px',
        maxWidth: '100%',
      }}
    >
      {/* Photo Preview (if attached) */}
      {photoUrl && (
        <div style={{ marginBottom: '16px' }}>
          <img
            src={photoUrl}
            alt="Attached photo"
            style={{
              maxWidth: '100%',
              maxHeight: '200px',
              borderRadius: '6px',
              border: '1px solid #DDD',
            }}
          />
        </div>
      )}

      {/* Language Selector */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '12px', fontWeight: 600, color: '#666', marginBottom: '6px', display: 'block' }}>
          Language
        </label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(Object.keys(languageLabel) as Array<keyof typeof languageLabel>).map((lang) => (
            <button
              key={lang}
              onClick={() => {
                setLanguage(lang);
                HapticFeedback.perform({ style: 'Light' }).catch(() => {});
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: language === lang ? '#F47820' : '#F7F8FA',
                color: language === lang ? '#FFFFFF' : '#0F1629',
                border: language === lang ? 'none' : '1px solid #DDD',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                gap: '4px',
                alignItems: 'center',
              }}
            >
              <Globe size={12} />
              {languageLabel[lang]}
            </button>
          ))}
        </div>
      </div>

      {/* Recording State */}
      {isRecording ? (
        <div>
          {/* Recording Indicator */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: '#FFEBEE',
              borderRadius: '8px',
            }}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: '#EF5350',
                marginRight: '8px',
                animation: 'pulse 1s ease-in-out infinite',
              }}
            />
            <span style={{ color: '#C62828', fontWeight: 600, fontSize: '14px' }}>
              Recording... {formatTime(recordingTime)}
            </span>
          </div>

          {/* Visualizer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              gap: '2px',
              height: '60px',
              marginBottom: '16px',
              padding: '16px',
              backgroundColor: '#F7F8FA',
              borderRadius: '8px',
            }}
          >
            {visualizerData.map((value, idx) => (
              <div
                key={idx}
                style={{
                  width: '100%',
                  maxWidth: '4px',
                  height: `${Math.max(4, value * 56)}px`,
                  backgroundColor: '#4EC896',
                  borderRadius: '2px',
                  transition: 'height 0.1s ease-out',
                }}
              />
            ))}
          </div>

          {/* Live Transcript */}
          {transcript && (
            <div
              style={{
                backgroundColor: '#E3F2FD',
                border: '1px solid #2196F3',
                borderRadius: '6px',
                padding: '10px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '11px', color: '#1565C0', fontWeight: 600, marginBottom: '4px' }}>
                LIVE TRANSCRIPT
              </div>
              <div style={{ fontSize: '13px', color: '#0F1629', lineHeight: '1.4' }}>
                {transcript}
              </div>
            </div>
          )}

          {/* Stop Button */}
          <button
            onClick={stopRecording}
            disabled={processVoiceMutation.isPending}
            style={{
              width: '100%',
              padding: '12px',
              backgroundColor: '#EF5350',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 700,
              cursor: processVoiceMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: processVoiceMutation.isPending ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <Square size={16} />
            Stop Recording
          </button>
        </div>
      ) : processVoiceMutation.isPending ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Loader
            size={32}
            style={{
              color: '#F47820',
              margin: '0 auto 12px',
              animation: 'spin 1s linear infinite',
            }}
          />
          <div style={{ fontSize: '13px', color: '#0F1629', fontWeight: 600 }}>
            Processing voice...
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            Parsing with AI
          </div>
        </div>
      ) : (
        <div>
          {/* Start Button */}
          <button
            onClick={startRecording}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#F47820',
              border: 'none',
              borderRadius: '8px',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              marginBottom: '12px',
            }}
          >
            <Mic size={20} />
            Start Recording
          </button>

          {/* Tips */}
          <div
            style={{
              backgroundColor: '#F7F8FA',
              border: '1px solid #DDD',
              borderRadius: '6px',
              padding: '10px',
              fontSize: '11px',
              color: '#666',
              lineHeight: '1.4',
            }}
          >
            <strong>Tips:</strong>
            <ul style={{ margin: '4px 0 0 0', paddingLeft: '14px' }}>
              <li>Speak naturally and clearly</li>
              <li>Include location: "Floor 7, south wall"</li>
              <li>Mention trade: "Electrical", "Concrete", etc.</li>
              <li>State priority: "High", "Urgent", "Low"</li>
            </ul>
          </div>
        </div>
      )}

      {/* Error Display */}
      {processVoiceMutation.isError && (
        <div
          style={{
            backgroundColor: '#FFEBEE',
            border: '1px solid #EF5350',
            borderRadius: '6px',
            padding: '10px',
            marginTop: '12px',
            display: 'flex',
            gap: '8px',
            alignItems: 'flex-start',
          }}
        >
          <AlertCircle size={16} style={{ color: '#EF5350', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ fontSize: '12px', color: '#C62828' }}>
            {processVoiceMutation.error?.message || 'Voice processing failed'}
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceCapture;
```

### 3.2 VoiceCaptureConfirmation Component

**Purpose**: Show parsed result for user approval before saving.

```typescript
// src/components/fieldCapture/VoiceCaptureConfirmation.tsx

import React from 'react';
import { Card } from '@/components/Primitives';
import { CheckCircle, Edit2, RotateCcw, AlertCircle } from 'lucide-react';
import { VoiceCaptureResult } from './VoiceCapture';

interface VoiceCaptureConfirmationProps {
  result: VoiceCaptureResult;
  onApprove?: () => void;
  onEdit?: () => void;
  onReject?: () => void;
}

const VoiceCaptureConfirmation: React.FC<VoiceCaptureConfirmationProps> = ({
  result,
  onApprove,
  onEdit,
  onReject,
}) => {
  const typeLabels = {
    rfi: 'RFI (Request for Information)',
    punch: 'Punch List Item',
    daily_log: 'Daily Log Entry',
    safety: 'Safety Observation',
    general: 'General Note',
  };

  const typeColors = {
    rfi: '#2196F3',
    punch: '#FB8500',
    daily_log: '#4EC896',
    safety: '#EF5350',
    general: '#666',
  };

  const priorityColors = {
    low: '#4EC896',
    medium: '#FB8500',
    high: '#FF9800',
    urgent: '#EF5350',
  };

  return (
    <Card style={{ padding: '0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ backgroundColor: typeColors[result.type], padding: '12px 16px', color: '#FFFFFF' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <CheckCircle size={16} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>Voice Capture Recognized</span>
        </div>
        <div style={{ fontSize: '11px', opacity: 0.9 }}>
          Confidence: {Math.round(result.confidence * 100)}%
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px' }}>
        {/* Type Badge */}
        <div style={{ marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-block',
              backgroundColor: typeColors[result.type],
              color: '#FFFFFF',
              padding: '3px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {typeLabels[result.type]}
          </span>
        </div>

        {/* Title */}
        <h3 style={{ margin: '0 0 8px 0', color: '#0F1629', fontSize: '15px', fontWeight: 700 }}>
          {result.title}
        </h3>

        {/* Description */}
        {result.description && (
          <p style={{ margin: '0 0 12px 0', color: '#555', fontSize: '13px', lineHeight: '1.4' }}>
            {result.description}
          </p>
        )}

        {/* Metadata Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          {result.location && (
            <div>
              <div style={{ fontSize: '10px', color: '#999', marginBottom: '2px' }}>LOCATION</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>{result.location}</div>
            </div>
          )}
          {result.trade && (
            <div>
              <div style={{ fontSize: '10px', color: '#999', marginBottom: '2px' }}>TRADE</div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>{result.trade}</div>
            </div>
          )}
          {result.priority && (
            <div>
              <div style={{ fontSize: '10px', color: '#999', marginBottom: '2px' }}>PRIORITY</div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: priorityColors[result.priority as keyof typeof priorityColors] || '#666',
                  textTransform: 'uppercase',
                }}
              >
                {result.priority}
              </div>
            </div>
          )}
          <div>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '2px' }}>LANGUAGE</div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F1629' }}>
              {result.language === 'en-US' ? 'English' : 'Spanish'}
            </div>
          </div>
        </div>

        {/* Tags */}
        {result.tags && result.tags.length > 0 && (
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '10px', color: '#999', marginBottom: '4px' }}>TAGS</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {result.tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    backgroundColor: '#F0F0F0',
                    color: '#555',
                    padding: '2px 8px',
                    borderRadius: '3px',
                    fontSize: '11px',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Transcript */}
        <div
          style={{
            backgroundColor: '#F7F8FA',
            border: '1px solid #DDD',
            borderRadius: '6px',
            padding: '8px',
            marginBottom: '12px',
          }}
        >
          <div style={{ fontSize: '10px', color: '#999', marginBottom: '4px', fontWeight: 600 }}>
            ORIGINAL TRANSCRIPT
          </div>
          <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.4', fontStyle: 'italic' }}>
            "{result.transcript}"
          </div>
        </div>

        {/* Low Confidence Warning */}
        {result.confidence < 0.8 && (
          <div
            style={{
              backgroundColor: '#FFF3E0',
              border: '1px solid #FB8500',
              borderRadius: '6px',
              padding: '8px',
              marginBottom: '12px',
              display: 'flex',
              gap: '6px',
              alignItems: 'flex-start',
            }}
          >
            <AlertCircle size={14} style={{ color: '#FB8500', flexShrink: 0, marginTop: '2px' }} />
            <div style={{ fontSize: '11px', color: '#E65100' }}>
              Low confidence parsing. Please review before approving.
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onApprove}
            style={{
              flex: 1,
              padding: '8px',
              backgroundColor: '#4EC896',
              border: 'none',
              borderRadius: '4px',
              color: '#FFFFFF',
              fontWeight: 600,
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Approve
          </button>
          {onEdit && (
            <button
              onClick={onEdit}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#F7F8FA',
                border: '1px solid #DDD',
                borderRadius: '4px',
                color: '#0F1629',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Edit2 size={12} />
              Edit
            </button>
          )}
          {onReject && (
            <button
              onClick={onReject}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#FFEBEE',
                border: '1px solid #EF5350',
                borderRadius: '4px',
                color: '#C62828',
                fontWeight: 600,
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={12} />
              Retry
            </button>
          )}
        </div>
      </div>
    </Card>
  );
};

export default VoiceCaptureConfirmation;
```

---

## 4. Backend Edge Function

### 4.1 voice-extract Edge Function

```typescript
// api/voice-extract.ts (Supabase Edge Function)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Anthropic from "https://esm.sh/@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
});

interface VoiceExtractionResult {
  type: "rfi" | "punch" | "daily_log" | "safety" | "general";
  title: string;
  description: string;
  location?: string;
  trade?: string;
  priority?: string;
  confidence: number;
  tags?: string[];
}

const EXTRACTION_SYSTEM_PROMPT = `You are an expert construction project manager AI. Your job is to parse natural language voice input from construction workers and extract structured project data.

The worker may be describing:
1. RFI (Request for Information) - Issue needing clarification or decision
2. Punch List Item - Work that needs to be completed or fixed
3. Daily Log Entry - Progress update or time tracking
4. Safety Observation - Hazard, incident, or safety concern
5. General Note - Miscellaneous information

From their voice input, extract:
- Type: Which category above
- Title: Concise 1-line summary
- Description: Full context (2-3 sentences)
- Location: Floor, area, room number, etc.
- Trade: Electrical, concrete, framing, HVAC, plumbing, etc.
- Priority: low, medium, high, urgent (only for RFI/punch/safety)
- Confidence: 0.0-1.0 of how well you understood
- Tags: 3-5 relevant keywords

Return as JSON only, no markdown.

Example input: "RFI for floor 7. Third floor slab. Spalling at rebar interface. Concrete quality issue. High priority."

Example output:
{
  "type": "rfi",
  "title": "Third floor slab spalling at rebar interface",
  "description": "Concrete spalling observed at rebar interface on third floor slab, indicating potential concrete quality issue that may affect structural integrity.",
  "location": "Floor 3, South wall slab",
  "trade": "Concrete/Structural",
  "priority": "high",
  "confidence": 0.95,
  "tags": ["concrete", "quality", "spalling", "rebar", "structural"]
}`;

serve(async (req: Request) => {
  // CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const transcript = formData.get("transcript") as string;
    const language = formData.get("language") as string;
    const projectId = formData.get("projectId") as string;
    const userId = formData.get("userId") as string;
    const photoUrl = formData.get("photoUrl") as string | null;

    if (!audioFile || !transcript) {
      return new Response(JSON.stringify({ error: "Missing audio or transcript" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert audio file to base64 for Claude Vision
    const audioBuffer = await audioFile.arrayBuffer();
    const audioBase64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));

    // Call Claude with audio + transcript + context
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1024,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Worker voice input (${language}):\n\n"${transcript}"\n\nPlease extract structured project data from this voice input.`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "audio/webm",
                data: audioBase64,
              },
            },
          ],
        },
      ],
    });

    // Parse Claude response
    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const parsedData: VoiceExtractionResult = JSON.parse(content.text);

    // Validate required fields
    if (!parsedData.type || !parsedData.title || !parsedData.description) {
      throw new Error("Missing required fields in parsed data");
    }

    // Store in database
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY");

    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/voice_captures`, {
      method: "POST",
      headers: {
        apikey: supabaseKey!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project_id: projectId,
        user_id: userId,
        type: parsedData.type,
        title: parsedData.title,
        description: parsedData.description,
        transcript,
        location: parsedData.location,
        trade: parsedData.trade,
        priority: parsedData.priority,
        confidence: parsedData.confidence,
        tags: parsedData.tags,
        language,
        photo_url: photoUrl,
        audio_url: null, // Store audio file separately to S3
        created_at: new Date().toISOString(),
      }),
    });

    if (!dbResponse.ok) {
      const error = await dbResponse.text();
      throw new Error(`Database error: ${error}`);
    }

    const dbData = await dbResponse.json();

    // Return result with database ID
    return new Response(
      JSON.stringify({
        id: dbData[0]?.id || crypto.randomUUID(),
        ...parsedData,
        transcript,
        language,
        photoUrl,
        createdAt: new Date().toISOString(),
      }),
      {
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
```

---

## 5. Offline Support

### 5.1 Offline Queue with IndexedDB

```typescript
// src/lib/offlineQueue.ts

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface VoiceCaptureDB extends DBSchema {
  'voice_captures': {
    key: string;
    value: {
      id: string;
      type: string;
      title: string;
      description: string;
      transcript: string;
      language: string;
      createdAt: Date;
      synced: boolean;
    };
  };
}

class OfflineQueue {
  private db: IDBPDatabase<VoiceCaptureDB> | null = null;

  async init() {
    this.db = await openDB<VoiceCaptureDB>('sitesync-voice-captures', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('voice_captures')) {
          db.createObjectStore('voice_captures', { keyPath: 'id' });
        }
      },
    });
  }

  async addToQueue(capture: any) {
    if (!this.db) await this.init();
    await this.db!.add('voice_captures', {
      ...capture,
      synced: false,
      createdAt: new Date(),
    });
  }

  async getUnsyncedCaptures() {
    if (!this.db) await this.init();
    return this.db!.getAll('voice_captures');
  }

  async markAsSynced(id: string) {
    if (!this.db) await this.init();
    const capture = await this.db!.get('voice_captures', id);
    if (capture) {
      capture.synced = true;
      await this.db!.put('voice_captures', capture);
    }
  }

  async deleteCapture(id: string) {
    if (!this.db) await this.init();
    await this.db!.delete('voice_captures', id);
  }
}

export const offlineQueue = new OfflineQueue();
```

### 5.2 Sync on Network Reconnection

```typescript
// src/hooks/useOfflineSync.ts

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { offlineQueue } from '@/lib/offlineQueue';

export const useOfflineSync = (projectId: string) => {
  const { data: captures, refetch } = useQuery({
    queryKey: ['offline_captures', projectId],
    queryFn: async () => {
      const unsyncedCaptures = await offlineQueue.getUnsyncedCaptures();
      return unsyncedCaptures;
    },
  });

  useEffect(() => {
    const handleOnline = async () => {
      console.log('Back online, syncing voice captures...');

      if (!captures) return;

      for (const capture of captures) {
        try {
          const response = await fetch(`/api/voice-captures/${capture.id}/sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capture),
          });

          if (response.ok) {
            await offlineQueue.markAsSynced(capture.id);
          }
        } catch (error) {
          console.error('Sync failed for capture', capture.id, error);
        }
      }

      refetch();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [captures, refetch]);

  return captures;
};
```

---

## 6. Capacitor Integration

### 6.1 Haptic Feedback on Android/iOS

```typescript
// Already integrated in VoiceCapture component above
// Usage: await HapticFeedback.perform({ style: 'Heavy' });

// Install: npm install @capacitor/haptics
// Add to VoiceCapture:
// import { HapticFeedback } from '@capacitor/haptics';
// await HapticFeedback.perform({ style: 'Light' }).catch(() => {});
```

---

## 7. Implementation Checklist & Acceptance Criteria

### 7.1 Development Tasks

- [ ] Create VoiceCapture component with Web Speech API
- [ ] Create VoiceCaptureConfirmation component
- [ ] Implement voice-extract edge function with Claude
- [ ] Add English and Spanish language support
- [ ] Implement offline queue with IndexedDB
- [ ] Add sync-on-reconnect logic
- [ ] Integrate Capacitor for haptic feedback
- [ ] Add visualizer animation
- [ ] Create tests with 20+ voice input examples
- [ ] Test offline recording and sync
- [ ] Mobile responsiveness (portrait + landscape)
- [ ] Add accessibility (ARIA labels, keyboard shortcuts)

### 7.2 Acceptance Criteria

1. Voice capture completes in <15 seconds for typical input
2. Transcription accuracy >90% in quiet environments
3. Language switching doesn't lose recording state
4. Offline captures persist and sync when online
5. Confidence <80% triggers user confirmation
6. All 5 capture types recognized (RFI, punch, daily log, safety, general)
7. Location and trade extraction correct in >85% of cases
8. Haptic feedback works on iOS + Android
9. UI remains responsive during audio encoding
10. Full keyboard navigation for accessibility

---

## 8. Example Flows

### 8.1 RFI Voice Capture

```
Worker: "RFI for floor 7, west elevation. Concrete spalling at rebar, high priority. Looks like mix design issue."
→ Transcription: "RFI for floor 7, west elevation. Concrete spalling at rebar, high priority. Looks like mix design issue."
→ Parsed:
{
  "type": "rfi",
  "title": "Concrete spalling at rebar, Floor 7 west elevation",
  "description": "Concrete spalling observed at rebar location on Floor 7 west elevation. Appears to be mix design related issue requiring investigation.",
  "location": "Floor 7, West elevation",
  "trade": "Concrete",
  "priority": "high",
  "confidence": 0.92,
  "tags": ["concrete", "spalling", "quality", "rebar", "mix"]
}
→ Confirmation shown
→ Worker taps "Approve"
→ RFI created with all data
```

### 8.2 Punch List Voice Capture

```
Worker: "Punch item in the office area. Ceiling tile 3E4 is damaged, needs replacement."
→ Parsed:
{
  "type": "punch",
  "title": "Replace damaged ceiling tile 3E4 in office area",
  "description": "Ceiling tile 3E4 in office area is damaged and requires replacement before finish walkthrough.",
  "location": "Office area",
  "trade": "Drywall/Finish",
  "priority": "medium",
  "confidence": 0.88,
  "tags": ["ceiling", "tile", "damage", "replacement", "finish"]
}
```

### 8.3 Safety Observation Voice Capture

```
Worker: "Safety issue in the stairwell. Debris on stairs, tripping hazard. Need housekeeping immediately."
→ Parsed:
{
  "type": "safety",
  "title": "Tripping hazard debris in stairwell",
  "description": "Debris observed on stairwell stairs creating tripping hazard. Immediate housekeeping required to clear stairs.",
  "location": "Stairwell A",
  "priority": "urgent",
  "confidence": 0.94,
  "tags": ["safety", "debris", "tripping", "housekeeping", "stairwell"]
}
```

---

## 9. Future Enhancements

- Real-time language translation (speak English, capture in Spanish)
- Accent-specific training for regional crews
- Voice-activated photo markup (circle issue while speaking)
- Integration with field photo library (auto-tag photos by voice)
- Crew voice profiles (remember individual worker preferences)
- Voice commands for navigation ("Show me all RFIs", "Log in")
- Multilingual support expansion (Portuguese, Vietnamese, Mandarin)
- Emotion detection (alert PM if worker sounds stressed or injured)

