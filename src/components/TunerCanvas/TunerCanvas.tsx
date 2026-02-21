import React, { useEffect, useRef } from "react";
import { DetectedNote, MicrophoneStatus } from "../../utils/usePitchDetector";
import { drawCanvas } from "./TunerCanvas.utils";
import styles from "./TunerCanvas.module.css";

interface Props {
    detected: DetectedNote | null;
    micStatus: MicrophoneStatus;
    error?: string;
}

export interface HistoryPoint {
    cents: number;
    timestamp: number;
    isGap?: boolean;
}

export const TunerCanvas: React.FC<Props> = ({ detected, micStatus, error }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const visualCentsRef = useRef<number>(0);
    const graphHistoryRef = useRef<HistoryPoint[]>([]);
    const smoothingBufferRef = useRef<number[]>([]);
    const lastNoteRef = useRef<string | null>(null);

    const noteStartTimeRef = useRef<number>(0);
    const lastValidDetectedRef = useRef<DetectedNote | null>(null);
    const lastValidCentsRef = useRef<number>(0);
    const wasNoteValidRef = useRef<boolean>(false);

    const MIN_HOLD_DURATION = 500;

    useEffect(() => {
        const animate = () => {
            if (canvasRef.current) {
                const now = Date.now();
                let displayDetected = detected;
                let isHolding = false;

                if (detected) {
                    if (lastNoteRef.current !== detected.note) {
                        smoothingBufferRef.current = [];
                        visualCentsRef.current = 0;
                        lastNoteRef.current = detected.note;
                        noteStartTimeRef.current = now;
                        wasNoteValidRef.current = false;

                        graphHistoryRef.current.push({
                            cents: 0,
                            timestamp: now,
                            isGap: true
                        });
                    }

                    const noteDuration = now - noteStartTimeRef.current;
                    if (noteDuration >= MIN_HOLD_DURATION) {
                        wasNoteValidRef.current = true;
                        lastValidDetectedRef.current = detected;
                    }

                    const rawCents = isNaN(detected.cents) ? 0 : detected.cents;

                    const BUFFER_SIZE = 8;
                    smoothingBufferRef.current.push(rawCents);

                    if (smoothingBufferRef.current.length > BUFFER_SIZE) {
                        smoothingBufferRef.current.shift();
                    }

                    const sum = smoothingBufferRef.current.reduce((a, b) => a + b, 0);
                    const averageCents = sum / smoothingBufferRef.current.length;

                    const SMOOTHING_FACTOR = 0.01;
                    visualCentsRef.current += (averageCents - visualCentsRef.current) * SMOOTHING_FACTOR;

                    if (Math.abs(visualCentsRef.current) < 0.1) visualCentsRef.current = 0;

                    if (wasNoteValidRef.current) {
                        lastValidCentsRef.current = visualCentsRef.current;
                    }

                    graphHistoryRef.current.push({
                        cents: visualCentsRef.current,
                        timestamp: now
                    });
                } else {
                    if (wasNoteValidRef.current && lastValidDetectedRef.current) {
                        displayDetected = lastValidDetectedRef.current;
                        visualCentsRef.current = lastValidCentsRef.current;
                        isHolding = true;
                    } else {
                        if (smoothingBufferRef.current.length > 0) {
                            smoothingBufferRef.current = [];
                        }
                        lastNoteRef.current = null;
                    }
                }

                const timeWindow = 20000;
                graphHistoryRef.current = graphHistoryRef.current.filter(p => now - p.timestamp < timeWindow);

                drawCanvas(
                    canvasRef.current,
                    micStatus,
                    displayDetected,
                    visualCentsRef.current,
                    graphHistoryRef.current,
                    error,
                    isHolding
                );
            }
            requestRef.current = requestAnimationFrame(animate);
        };

        requestRef.current = requestAnimationFrame(animate);

        return () => {
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
        };
    }, [detected, micStatus, error]);

    return (
        <canvas
            ref={canvasRef}
            width={1200}
            height={1800}
            className={styles.canvas}
        />
    );
};