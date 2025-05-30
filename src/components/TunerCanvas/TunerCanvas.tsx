import React, { useEffect, useRef } from "react";
import { DetectedNote, MicrophoneStatus } from "../../utils/usePitchDetector";
import { drawCanvas } from "./TunerCanvas.utils";
import styles from "./TunerCanvas.module.css";

interface Props {
    detected: DetectedNote | null;
    micStatus: MicrophoneStatus;
    error?: string;
}

export const TunerCanvas: React.FC<Props> = ({ detected, micStatus, error }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        drawCanvas(canvasRef.current, micStatus, detected, error);
    }, [detected, micStatus, error]);

    return (
        <canvas
            ref={canvasRef}
            width={1200}
            height={600}
            className={styles.canvas}
        />
    );
};