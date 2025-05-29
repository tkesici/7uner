import { useEffect, useRef, useState } from "react";
import {yinDetector} from "./yinDetector";
import {getNearestNoteFreq} from "./getNearestNoteFreq";
import {getNoteName} from "./getNoteName";

export interface DetectedNote {
    note: string;
    freq: number;
    cents: number;
}

export type MicrophoneStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'error';

export interface PitchDetectorResult {
    detected: DetectedNote | null;
    micStatus: MicrophoneStatus;
    error?: string;
}

export const usePitchDetector = (): PitchDetectorResult => {
    const [detected, setDetected] = useState<DetectedNote | null>(null);
    const [micStatus, setMicStatus] = useState<MicrophoneStatus>('idle');
    const [error, setError] = useState<string>();
    const runningRef = useRef<boolean>(false);

    useEffect(() => {
        let audioContext: AudioContext | null = null;
        let analyser: AnalyserNode;
        let dataArray: Float32Array;
        let source: MediaStreamAudioSourceNode;
        let animationRef: number;

        const detectPitch = () => {
            if (!analyser) return;
            analyser.getFloatTimeDomainData(dataArray);
            const freq = yinDetector(dataArray, audioContext!.sampleRate);
            if (freq !== -1) {
                const nearest = getNearestNoteFreq(freq);
                const note = getNoteName(freq);
                const cents = 1200 * Math.log2(freq / nearest.freq);
                setDetected({ note, freq, cents });
            }
            if (runningRef.current) {
                animationRef = requestAnimationFrame(detectPitch);
            }
        };

        const initializeAudio = async () => {
            try {
                setMicStatus('requesting');
                setError(undefined);

                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

                setMicStatus('granted');
                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                source = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048;
                dataArray = new Float32Array(analyser.fftSize);
                source.connect(analyser);
                runningRef.current = true;
                detectPitch();

            } catch (err: any) {
                console.error("Microphone error:", err);

                if (err.name === 'NotAllowedError') {
                    setMicStatus('denied');
                    setError('Microphone access denied. Please allow microphone access to use the tuner.');
                } else if (err.name === 'NotFoundError') {
                    setMicStatus('error');
                    setError('No microphone found. Please connect a microphone and refresh the page.');
                } else if (err.name === 'NotSupportedError') {
                    setMicStatus('error');
                    setError('Your browser does not support microphone access.');
                } else {
                    setMicStatus('error');
                    setError(`Microphone error: ${err.message || 'Unknown error occurred'}`);
                }
            }
        };

        initializeAudio();

        return () => {
            runningRef.current = false;
            if (animationRef) {
                cancelAnimationFrame(animationRef);
            }
            audioContext?.close().then(() => {
                audioContext = null;
                source?.disconnect();
            });
        };
    }, []);

    return { detected, micStatus, error };
};