import { useEffect, useRef, useState } from "react";
import { yinDetector } from "./yinDetector";
import { getNearestNoteFreq } from "./getNearestNoteFreq";
import { getNoteName } from "./getNoteName";

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
    rms: number; // Debug için ses seviyesini dışarı açalım
}

export const usePitchDetector = (): PitchDetectorResult => {
    const [detected, setDetected] = useState<DetectedNote | null>(null);
    const [micStatus, setMicStatus] = useState<MicrophoneStatus>('idle');
    const [error, setError] = useState<string>();
    const [rms, setRms] = useState<number>(0); // Ses seviyesini görmek için state

    const runningRef = useRef<boolean>(false);
    const bufferRef = useRef<number[]>([]);

    useEffect(() => {
        let audioContext: AudioContext | null = null;
        let analyser: AnalyserNode;
        let dataArray: Float32Array;
        let source: MediaStreamAudioSourceNode;
        let animationRef: number;

        let lastProcessTime = 0;

        const detectPitch = (timestamp: number) => {
            if (!analyser || !runningRef.current) return;

            // 50ms (saniyede ~20 kare) işlem limiti
            if (timestamp - lastProcessTime < 50) {
                animationRef = requestAnimationFrame(detectPitch);
                return;
            }
            lastProcessTime = timestamp;

            analyser.getFloatTimeDomainData(dataArray);

            // 1. ADIM: SES ŞİDDETİ HESABI (RMS)
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i] * dataArray[i];
            }
            const currentRms = Math.sqrt(sum / dataArray.length);
            setRms(currentRms); // Arayüzde gerekirse göstermek için

            // --- AYAR: HASSASİYET EŞİĞİ ---
            // 0.015 çok yüksekti, bunu 0.002'ye çektik.
            // Artık fısıltı kadar sesi bile işlemeye çalışacak.
            const SENSITIVITY_THRESHOLD = 0.01;

            if (currentRms < SENSITIVITY_THRESHOLD) {
                // Ses yoksa detected'i null yap ama buffer'ı hemen silme (kopukluk olmasın diye)
                // Amaç gürültüyü engellemek
                setDetected(null);
                animationRef = requestAnimationFrame(detectPitch);
                return;
            }

            // 2. ADIM: PITCH DETECTION
            const freq = yinDetector(dataArray, audioContext!.sampleRate);

            if (freq !== -1) {
                // --- FİLTRELEME ---
                bufferRef.current.push(freq);
                if (bufferRef.current.length > 5) {
                    bufferRef.current.shift();
                }

                const sorted = [...bufferRef.current].sort((a, b) => a - b);
                const medianFreq = sorted[Math.floor(sorted.length / 2)];

                const nearest = getNearestNoteFreq(medianFreq);
                const note = getNoteName(medianFreq);
                const cents = 1200 * Math.log2(medianFreq / nearest.freq);

                setDetected({ note, freq: medianFreq, cents });
            }

            animationRef = requestAnimationFrame(detectPitch);
        };

        const initializeAudio = async () => {
            try {
                setMicStatus('requesting');
                setError(undefined);

                // --- AYAR: MİKROFON YAPILANDIRMASI ---
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: false, // Pitch için kapalı kalmalı
                        autoGainControl: true,   // ÖNEMLİ: Bunu TRUE yaptık (Sesi otomatik yükseltir)
                        noiseSuppression: false  // Tınıyı bozmaması için kapalı
                    }
                });

                setMicStatus('granted');
                audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

                source = audioContext.createMediaStreamSource(stream);
                analyser = audioContext.createAnalyser();
                analyser.fftSize = 2048; // 2048 daha hızlı tepki verir, 4096 biraz gecikme yapabilir
                dataArray = new Float32Array(analyser.fftSize);

                source.connect(analyser);
                runningRef.current = true;

                requestAnimationFrame(detectPitch);

            } catch (err: any) {
                console.error("Microphone error:", err);
                if (err.name === 'NotAllowedError') {
                    setMicStatus('denied');
                    setError('Mikrofon izni reddedildi.');
                } else {
                    setMicStatus('error');
                    setError('Mikrofon hatası oluştu.');
                }
            }
        };

        initializeAudio();

        return () => {
            runningRef.current = false;
            if (animationRef) cancelAnimationFrame(animationRef);
            audioContext?.close();
        };
    }, []);

    // rms değerini de döndürüyoruz, istersen ekranda debug için yazdırabilirsin
    return { detected, micStatus, error, rms };
};