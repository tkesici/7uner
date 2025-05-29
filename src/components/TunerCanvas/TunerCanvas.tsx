import React, { useEffect, useRef } from "react";
import {DetectedNote, MicrophoneStatus} from "../../utils/usePitchDetector";
import {
    drawErrorState,
    drawInitialState,
    drawPermissionDeniedState,
    drawRequestingState,
    drawTunerInterface
} from "./TunerCanvas.utils";

interface Props {
    detected: DetectedNote | null;
    micStatus: MicrophoneStatus;
    error?: string;
}

export const TunerCanvas: React.FC<Props> = ({ detected, micStatus, error }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const drawCanvas = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, width, height);

        if (micStatus === 'requesting') {
            drawRequestingState(ctx, width, height);
        } else if (micStatus === 'denied') {
            drawPermissionDeniedState(ctx, width, height);
        } else if (micStatus === 'error') {
            drawErrorState(ctx, width, height, error);
        } else if (micStatus === 'granted') {
            drawTunerInterface(ctx, width, height, detected);
        } else {
            drawInitialState(ctx, width, height);
        }
    };

    useEffect(() => {
        drawCanvas();
    }, [detected, micStatus, error]);

    useEffect(() => {
        drawCanvas();
    }, []);

    return (
        <canvas
            ref={canvasRef}
            width={1200}
            height={600}
            style={{ width: '100%', height: 'auto', borderRadius: '5px' }}
        />
    );
};