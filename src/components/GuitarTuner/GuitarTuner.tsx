import React from "react";
import { TunerCanvas } from "../TunerCanvas";
import { usePitchDetector } from "../../utils/usePitchDetector";
import styles from './GuitarTuner.module.css';

export const GuitarTuner: React.FC = () => {
    const { detected, micStatus, error } = usePitchDetector();

    return (
        <div className={styles.container}>
            <h1 className={styles.title}>7uner</h1>
            <div className={styles.wrapper}>
                <TunerCanvas
                    detected={detected}
                    micStatus={micStatus}
                    error={error}
                />
            </div>
        </div>
    );
};