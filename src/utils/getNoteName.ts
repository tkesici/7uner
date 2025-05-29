import {notes} from "../constants/notes";

export const getNoteName = (freq: number): string => {
    const A4 = 440;
    const noteNumber = 12 * (Math.log2(freq / A4)) + 69;
    const rounded = Math.round(noteNumber);
    const noteIndex = (rounded + 12) % 12;
    const octave = Math.floor(rounded / 12) - 1;
    return `${notes[noteIndex]}${octave}`;
}
