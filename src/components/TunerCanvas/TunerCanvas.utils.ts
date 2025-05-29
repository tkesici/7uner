import {DetectedNote} from "../../utils/usePitchDetector";

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

export const drawTunerInterface = (ctx: CanvasRenderingContext2D, width: number, height: number, detected: DetectedNote | null) => {
    ctx.strokeStyle = '#4CAF50';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(width / 2, 0);
    ctx.lineTo(width / 2, height);
    ctx.stroke();

    if (detected) {
        const { note, freq, cents } = detected;

        const maxCents = 49.9;
        const pos = Math.min(Math.max(cents / maxCents, -1), 1);
        const xPos = width / 2 + (width / 2) * pos;

        const gradient = ctx.createLinearGradient(width / 2, 0, width, 0);
        gradient.addColorStop(0, '#4CAF50');
        gradient.addColorStop(1, '#F44336');
        ctx.fillStyle = gradient;
        ctx.fillRect(width / 2, height - 40, (width / 2) * pos, 20);

        ctx.fillStyle = '#FFF';
        ctx.beginPath();
        ctx.arc(xPos, height - 30, 10, 0, Math.PI * 2);
        ctx.fill();

        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFF';
        ctx.fillText(`${Math.round(cents)} cents`, xPos, height - 50);

        ctx.font = '48px Arial';
        ctx.fillText(note, width / 2, 80);

        ctx.font = '24px Arial';
        ctx.fillText(`${freq.toFixed(2)} Hz`, width / 2, 120);
    }
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