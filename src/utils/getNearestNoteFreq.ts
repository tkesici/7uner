import {noteFrequencies} from "../constants/noteFrequencies";

export function getNearestNoteFreq(detectedFreq: number): { note: string; freq: number } {
    const notes = noteFrequencies
    let closest = notes[0];
    let minDiff = Math.abs(detectedFreq - closest.freq);

    for (const note of notes) {
        const diff = Math.abs(detectedFreq - note.freq);
        if (diff < minDiff) {
            minDiff = diff;
            closest = note;
        }
    }

    return closest;
}