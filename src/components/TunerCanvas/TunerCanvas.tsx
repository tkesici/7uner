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
}

export const TunerCanvas: React.FC<Props> = ({ detected, micStatus, error }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const requestRef = useRef<number>(0);
    const visualCentsRef = useRef<number>(0);
    const graphHistoryRef = useRef<HistoryPoint[]>([]);
    const smoothingBufferRef = useRef<number[]>([]);
    const lastNoteRef = useRef<string | null>(null);

    useEffect(() => {
        const animate = () => {
            if (canvasRef.current) {
                const now = Date.now();
                let targetCents = 0;

                if (detected) {
                    // 1. NOTA DEĞİŞİM KONTROLÜ
                    // Eğer kullanıcı E telinden A teline geçtiyse, buffer'ı sıfırla.
                    // Yoksa ibre E'den A'ya kayarak gitmeye çalışır, saçmalar.
                    if (lastNoteRef.current !== detected.note) {
                        smoothingBufferRef.current = [];
                        visualCentsRef.current = 0; // İbreyi merkeze (veya yeni değere) resetle
                        lastNoteRef.current = detected.note;
                    }

                    const rawCents = isNaN(detected.cents) ? 0 : detected.cents;

                    // 2. BUFFERA EKLE (ROLLING WINDOW)
                    // Son 8 veri noktasını tutalım (Yaklaşık 130ms gecikme ile çok yüksek kararlılık sağlar)
                    const BUFFER_SIZE = 8;
                    smoothingBufferRef.current.push(rawCents);

                    if (smoothingBufferRef.current.length > BUFFER_SIZE) {
                        smoothingBufferRef.current.shift(); // En eskiyi at
                    }

                    // 3. ORTALAMA AL (AVERAGING)
                    // Bufferdaki değerlerin ortalamasını hedef olarak belirle.
                    // Bu, anlık titremeleri (noise) matematiksel olarak yok eder.
                    const sum = smoothingBufferRef.current.reduce((a, b) => a + b, 0);
                    const averageCents = sum / smoothingBufferRef.current.length;

                    targetCents = averageCents;

                    // 4. LOW PASS FILTER (LERP)
                    // Hedefe doğru git ama yavaşça.
                    // 0.05 = Çok ağır/yavaş (Çok kararlı)
                    // 0.10 = Orta
                    // 0.20 = Hızlı
                    // "Hafif daha az yavaş ama kesin" dediğin için 0.08 idealdir.
                    const SMOOTHING_FACTOR = 0.01;

                    visualCentsRef.current += (targetCents - visualCentsRef.current) * SMOOTHING_FACTOR;

                    // Çok küçük değerleri sıfırla (mikro titremeyi önler)
                    if (Math.abs(visualCentsRef.current) < 0.1) visualCentsRef.current = 0;

                    // 5. GRAFİK İÇİN GEÇMİŞE EKLE
                    graphHistoryRef.current.push({
                        cents: visualCentsRef.current,
                        timestamp: now
                    });
                } else {
                    // Nota yoksa bufferları yavaşça temizle
                    if (smoothingBufferRef.current.length > 0) {
                        smoothingBufferRef.current = [];
                    }
                    // Nota kaybolunca ibre yavaşça 0'a veya son konuma sönümlenebilir,
                    // burada direkt çizimi durduracağımız için sorun yok.
                    lastNoteRef.current = null;
                }

                // Grafik geçmişini temizle (10 sn)
                const timeWindow = 10000;
                graphHistoryRef.current = graphHistoryRef.current.filter(p => now - p.timestamp < timeWindow);

                drawCanvas(
                    canvasRef.current,
                    micStatus,
                    detected,
                    visualCentsRef.current,
                    graphHistoryRef.current,
                    error
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