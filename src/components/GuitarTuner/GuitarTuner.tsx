import React from "react";
import { TunerCanvas } from "../TunerCanvas";
import {usePitchDetector} from "../../utils/usePitchDetector";

export const GuitarTuner: React.FC = () => {
    const { detected, micStatus, error } = usePitchDetector();

    return (
        <div style={{
            fontFamily: "'Arial', sans-serif",
            backgroundColor: '#121212',
            color: '#FFFFFF',
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <h1 style={{ color: '#4CAF50', marginBottom: '40px' }}>7uner</h1>
            <div style={{
                width: '100%',
                maxWidth: '600px',
                backgroundColor: '#1E1E1E',
                borderRadius: '10px',
                padding: '20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
            }}>
                <TunerCanvas
                    detected={detected}
                    micStatus={micStatus}
                    error={error}
                />
            </div>
        </div>
    );
};