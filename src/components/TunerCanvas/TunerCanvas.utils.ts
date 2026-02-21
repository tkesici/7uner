import { DetectedNote, MicrophoneStatus } from "../../utils/usePitchDetector";
import { HistoryPoint } from "./TunerCanvas";

export const drawCanvas = (
    canvas: HTMLCanvasElement | null,
    micStatus: MicrophoneStatus,
    detected: DetectedNote | null,
    smoothedCents: number,
    history: HistoryPoint[],
    error?: string
) => {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Arkaplan
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, width, height);

    if (micStatus === 'granted') {
        drawVerticalHistoryGraph(ctx, width, height, history);
        drawTunerInterface(ctx, width, height, detected, smoothedCents);
    } else if (micStatus === 'requesting') {
        drawRequestingState(ctx, width, height);
    } else if (micStatus === 'denied') {
        drawPermissionDeniedState(ctx, width, height);
    } else if (micStatus === 'error') {
        drawErrorState(ctx, width, height, error);
    } else {
        drawInitialState(ctx, width, height);
    }
};

export const drawVerticalHistoryGraph = (ctx: CanvasRenderingContext2D, width: number, height: number, history: HistoryPoint[]) => {
    if (history.length < 2) return;

    const now = Date.now();
    const timeWindow = 10000;
    const centerX = width / 2;
    const startY = 250;
    const graphHeight = height - startY;

    ctx.save();

    // Referans çizgisi (Center Line)
    ctx.beginPath();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.moveTo(centerX, startY);
    ctx.lineTo(centerX, height);
    ctx.stroke();

    // Grafik Ayarları
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Renk Gradyanı (Sadece Pitch'e göre)
    const colorGradient = ctx.createLinearGradient(0, 0, width, 0);
    colorGradient.addColorStop(0.3, '#F44336');   // Flat (Kırmızı)
    colorGradient.addColorStop(0.45, '#4CAF50'); // In Tune (Yeşil)
    colorGradient.addColorStop(0.55, '#4CAF50'); // In Tune (Yeşil)
    colorGradient.addColorStop(0.7, '#F44336');   // Sharp (Kırmızı)
    ctx.strokeStyle = colorGradient;

    ctx.beginPath();

    let started = false;

    for (let i = 0; i < history.length; i++) {
        const point = history[i];
        const timeDiff = now - point.timestamp;

        // Eğer 10 saniyeden eskiyse çizme (performans)
        if (timeDiff > timeWindow) continue;

        const y = startY + ((timeDiff / timeWindow) * graphHeight);

        // X Hesabı
        const maxDeviation = (width / 2) * 0.8;
        const safeCents = isNaN(point.cents) ? 0 : point.cents;
        const normalizedCents = safeCents / 50;
        const x = centerX + (normalizedCents * maxDeviation);

        if (!started) {
            ctx.moveTo(x, y);
            started = true;
        } else {
            // Quadratic Curve daha yumuşak bir çizgi sağlar (köşeli olmaz)
            // Bir önceki nokta ile şimdiki nokta arasına curve atıyoruz
            // Ancak performans için lineTo da yeterlidir.
            // Daha pürüzsüz görünüm için lineTo yeterli çünkü data zaten smoothed.
            ctx.lineTo(x, y);
        }
    }

    ctx.stroke();
    ctx.restore();
};

export const drawTunerInterface = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    detected: DetectedNote | null,
    smoothedCents: number
) => {
    const centerX = width / 2;
    const scaleY = 200; // Cetvelin Y konumu

    // --- CETVEL (SCALE) ---
    const scaleWidth = width * 0.8;
    ctx.save();
    ctx.translate(centerX, scaleY);
    ctx.strokeStyle = '#555';
    ctx.fillStyle = '#777';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';

    for (let i = -5; i <= 5; i++) {
        const x = i * (scaleWidth / 10 / 2);
        ctx.beginPath();
        // Ana çizgiler
        ctx.moveTo(x, 0);
        ctx.lineTo(x, i === 0 ? 25 : 15); // Orta çizgi daha uzun
        ctx.stroke();

        // Sayılar
        if (i % 5 === 0) {
            ctx.fillText(`${i * 10}`, x, 40);
        }
    }
    ctx.restore();

    if (detected) {
        const { note, freq } = detected;

        // Renk Belirleme (±5 cents içi yeşil)
        const isInTune = Math.abs(smoothedCents) < 5;
        const color = isInTune ? '#4CAF50' : '#F44336';

        // --- İBRE (CURSOR) ---
        const maxCents = 100;
        // Değeri sınırla (-50 ile +50 arası)
        const displayCents = Math.max(Math.min(smoothedCents, maxCents), -maxCents);
        const pos = displayCents / maxCents;

        const maxDeviationPixels = (width * 0.8) / 2;
        const cursorX = centerX + (pos * maxDeviationPixels);
        const cursorY = scaleY;

        // Üçgen İbre
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(cursorX, cursorY);           // Uç nokta (cetvele değen)
        ctx.lineTo(cursorX - 12, cursorY - 24); // Sol üst
        ctx.lineTo(cursorX + 12, cursorY - 24); // Sağ üst
        ctx.fill();

        // İbre Ucu Noktası (Takip kolaylığı için)
        ctx.beginPath();
        ctx.arc(cursorX, cursorY + 5, 4, 0, Math.PI * 2);
        ctx.fill();

        // --- METİNLER ---
        ctx.textAlign = 'center';

        // Nota Adı
        ctx.font = 'bold 90px Arial'; // Biraz daha büyüttüm
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = isInTune ? 30 : 0; // Akortluysa parlasın
        ctx.fillText(note, centerX, 110);
        ctx.shadowBlur = 0; // Reset

        // Frekans
        ctx.font = '24px Arial';
        ctx.fillStyle = '#FFF';
        ctx.fillText(`${freq.toFixed(1)} Hz`, centerX, 150);

        // Cents Sayısı
        const roundedCents = Math.round(smoothedCents);
        const sign = roundedCents > 0 ? '+' : '';
        ctx.font = '18px Arial';
        ctx.fillStyle = isInTune ? '#4CAF50' : '#AAA';
        // ctx.fillText(`${sign}${roundedCents} cents`, centerX, 160); // Cetvelin altına aldım, daha temiz

    } else {
        ctx.font = '20px Arial';
        ctx.fillStyle = '#444';
        ctx.textAlign = 'center';
    }
};
export const drawRequestingState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#FFF';
    ctx.font = '24px Arial';
    ctx.fillText('Requesting microphone access...', width / 2, height / 2 + 20);

    ctx.font = '16px Arial';
    ctx.fillStyle = '#AAA';
    ctx.fillText('Please allow microphone access in your browser', width / 2, height / 2 + 50);
};

export const drawPermissionDeniedState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#F44336';
    ctx.font = '24px Arial';
    ctx.fillText('Microphone Access Denied', width / 2, height / 2 - 10);

    ctx.fillStyle = '#FFF';
    ctx.font = '16px Arial';
    ctx.fillText('Please allow microphone access to use the tuner', width / 2, height / 2 + 20);

    ctx.fillStyle = '#AAA';
    ctx.font = '14px Arial';
    ctx.fillText('Click the microphone icon in your browser\'s address bar', width / 2, height / 2 + 45);
    ctx.fillText('or refresh the page and try again', width / 2, height / 2 + 65);
};

export const drawErrorState = (ctx: CanvasRenderingContext2D, width: number, height: number, error?: string) => {
    ctx.fillStyle = '#FF5722';
    ctx.font = '24px Arial';
    ctx.fillText('Microphone Error', width / 2, height / 2 - 10);

    if (error) {
        ctx.fillStyle = '#FFF';
        ctx.font = '16px Arial';
        const lines = wrapText(ctx, error, width - 100);
        lines.forEach((line, index) => {
            ctx.fillText(line, width / 2, height / 2 + 20 + (index * 20));
        });
    }
};

export const drawInitialState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Initializing...', width / 2, height / 2 + 20);
};

export const wrapText = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
};

