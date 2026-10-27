/* 7uner – Practice exercise catalogue: names, descriptions and tempos.
   The notes live in practice/<id>.gp, written by tools/make-practice-files.js
   (which also reads this file). Modes and scales are in A, two octaves from
   the 5th fret; iv lists their intervals in semitones from the root and per
   caps how many notes go on one string. sub is notes per beat, start the
   suggested tempo and step how far to raise it once an exercise is clean. */
(function (root) {
    "use strict";

    const CATS = {
        tech: [
            { id: "chrom", name: "Alternate picking – chromatic", sub: 4, start: 60, step: 8,
                desc: "Sixteenth notes, changing pick direction on every note (down-up). One finger per fret, 1-2-3-4. The rhythm shouldn’t slip when you cross strings." },
            { id: "trem", name: "Tremolo and palm muting", sub: 4, start: 80, step: 10,
                desc: "Continuous down-up sixteenths on the low E string with palm muting (PM). Builds picking-hand consistency and stamina; play from the wrist with small motions." },
            { id: "down", name: "Downpicking endurance", sub: 2, start: 120, step: 10,
                desc: "Eighth notes with downstrokes only, palm muted. Keep the motion relaxed and the volume even; this is the stamina behind fast thrash rhythm playing." },
            { id: "gallop", name: "Gallop rhythm", sub: 4, start: 90, step: 8,
                desc: "An eighth followed by two sixteenths, palm muted: down, down-up. Lock the two short notes tightly to the click." },
            { id: "pent", name: "A minor pentatonic – box 1", sub: 4, start: 72, step: 8,
                desc: "The classic box at the 5th fret, up and down in sixteenths. Alternate picking." },
            { id: "nps", name: "A natural minor – three notes per string", sub: 6, start: 54, step: 6,
                desc: "Sextuplets: six notes per beat, so one string per beat. This is the foundation of fast solo runs." },
            { id: "fing", name: "Finger independence 1-3-2-4", sub: 4, start: 64, step: 6,
                desc: "Frets 5-7-6-8 on every string, then back down as 8-6-7-5. Keep each finger close to the fretboard and let the others rest lightly." },
            { id: "leg", name: "Legato – hammer-ons and pull-offs", sub: 4, start: 72, step: 8,
                desc: "Pick only the unmarked notes. h = hammer-on, p = pull-off. Your fretting hand should sound every note clearly on its own." },
            { id: "trill", name: "Trill endurance", sub: 4, start: 80, step: 8,
                desc: "Pick once, then keep the trill going with hammer-ons and pull-offs only. Stay even and keep both notes the same volume." },
            { id: "skip", name: "Octave string skipping", sub: 4, start: 70, step: 8,
                desc: "Octave pairs that skip a string, a melodic line in the low and middle register. Mute the skipped string with the underside of your fretting finger." },
            { id: "arp", name: "Arpeggios – Am F G E", sub: 6, start: 44, step: 6,
                desc: "Three-string arpeggios in sextuplets. Sweep the pick across the strings in one motion or alternate pick; keep the notes from ringing into each other." },
            { id: "sweep", name: "Sweep picking – five-string A minor", sub: 6, start: 40, step: 4,
                desc: "One down-sweep across five strings, a hammer-on at the top, then an up-sweep back. Roll the fretting fingers so only one note sounds at a time." }
        ],
        modes: [
            { id: "ionian", name: "Ionian (major)", iv: [0, 2, 4, 5, 7, 9, 11], formula: "1 2 3 4 5 6 7", spell: "A B C♯ D E F♯ G♯",
                desc: "The major scale: bright and settled. Use it over A major chords and in major keys." },
            { id: "dorian", name: "Dorian", iv: [0, 2, 3, 5, 7, 9, 10], formula: "1 2 ♭3 4 5 6 ♭7", spell: "A B C D E F♯ G",
                desc: "Minor with a major 6th, which makes it brighter than natural minor. A favourite for rock, funk and jazz solos over Am7 or an Am–D vamp." },
            { id: "phrygian", name: "Phrygian", iv: [0, 1, 3, 5, 7, 8, 10], formula: "1 ♭2 ♭3 4 5 ♭6 ♭7", spell: "A B♭ C D E F G",
                desc: "Minor with a flat 2nd: dark and tense, with a Spanish or metal flavour. Try it over A5 power-chord riffs that move to B♭." },
            { id: "lydian", name: "Lydian", iv: [0, 2, 4, 6, 7, 9, 11], formula: "1 2 3 ♯4 5 6 7", spell: "A B C♯ D♯ E F♯ G♯",
                desc: "Major with a raised 4th: dreamy and floating. Works over Amaj7 or an A–B vamp." },
            { id: "mixolydian", name: "Mixolydian", iv: [0, 2, 4, 5, 7, 9, 10], formula: "1 2 3 4 5 6 ♭7", spell: "A B C♯ D E F♯ G",
                desc: "Major with a flat 7th: bluesy, classic-rock major. Use it over A7 or an A–G–D progression." },
            { id: "aeolian", name: "Aeolian (natural minor)", iv: [0, 2, 3, 5, 7, 8, 10], formula: "1 2 ♭3 4 5 ♭6 ♭7", spell: "A B C D E F G",
                desc: "The natural minor scale: sad and dramatic. The default for minor keys, over progressions like Am–F–G." },
            { id: "locrian", name: "Locrian", iv: [0, 1, 3, 5, 6, 8, 10], formula: "1 ♭2 ♭3 4 ♭5 ♭6 ♭7", spell: "A B♭ C D E♭ F G",
                desc: "Flat 2nd and flat 5th: the most unstable mode. Rare as a key, but at home over Am7♭5 and in some dark metal riffs." }
        ],
        scales: [
            { id: "minpent", name: "Minor pentatonic", title: "A minor pentatonic", iv: [0, 3, 5, 7, 10], per: 2, formula: "1 ♭3 4 5 ♭7", spell: "A C D E G",
                desc: "Five notes, no weak spots: the backbone of rock and blues soloing." },
            { id: "majpent", name: "Major pentatonic", title: "A major pentatonic", iv: [0, 2, 4, 7, 9], per: 2, formula: "1 2 3 5 6", spell: "A B C♯ E F♯",
                desc: "The sweet, open sound of country and southern rock leads." },
            { id: "blues", name: "Blues scale", title: "A blues scale", iv: [0, 3, 5, 6, 7, 10], formula: "1 ♭3 4 ♭5 5 ♭7", spell: "A C D E♭ E G",
                desc: "Minor pentatonic plus the flat 5th, the ‘blue note’. Use the ♭5 as a passing note rather than a place to rest." },
            { id: "harmonic", name: "Harmonic minor", title: "A harmonic minor", iv: [0, 2, 3, 5, 7, 8, 11], formula: "1 2 ♭3 4 5 ♭6 7", spell: "A B C D E F G♯",
                desc: "Natural minor with a raised 7th. The wide step from F to G♯ gives the neoclassical sound heard in much shred and metal." },
            { id: "melodic", name: "Melodic minor", title: "A melodic minor", iv: [0, 2, 3, 5, 7, 9, 11], formula: "1 2 ♭3 4 5 6 7", spell: "A B C D E F♯ G♯",
                desc: "Minor with a major 6th and 7th; smooth and jazzy. Shown here in its ascending form, used both ways in jazz." },
            { id: "phrydom", name: "Phrygian dominant", iv: [0, 1, 4, 5, 7, 8, 10], formula: "1 ♭2 3 4 5 ♭6 ♭7", spell: "A B♭ C♯ D E F G",
                desc: "The fifth mode of harmonic minor: exotic and heavy, common in metal and flamenco. Try it over an A major or A5 riff." },
            { id: "hungarian", name: "Hungarian minor", iv: [0, 2, 3, 6, 7, 8, 11], formula: "1 2 ♭3 ♯4 5 ♭6 7", spell: "A B C D♯ E F G♯",
                desc: "Harmonic minor with a raised 4th: two wide steps make it sound dramatic and exotic." },
            { id: "dimwh", name: "Diminished (whole-half)", title: "A diminished (whole-half)", iv: [0, 2, 3, 5, 6, 8, 9, 11], formula: "1 2 ♭3 4 ♭5 ♭6 6 7", spell: "A B C D E♭ F F♯ G♯",
                desc: "Eight notes alternating whole and half steps; symmetrical and tense. Fits diminished seventh chords." },
            { id: "hirajoshi", name: "Hirajoshi (Japanese pentatonic)", title: "A Hirajoshi", iv: [0, 2, 3, 7, 8], per: 3, formula: "1 2 ♭3 5 ♭6", spell: "A B C E F",
                desc: "A Japanese five-note scale with two half steps that give it a haunting, exotic sound. This Japanese-style pentatonic colour is closely associated with Marty Friedman’s lead playing; try bending into the ♭6 and resolving to the 5." },
            { id: "whole", name: "Whole tone", title: "A whole tone", iv: [0, 2, 4, 6, 8, 10], formula: "1 2 3 ♯4 ♯5 ♭7", spell: "A B C♯ D♯ F G",
                desc: "Only whole steps, so there is no home note: dreamy and unresolved. Fits augmented chords." }
        ]
    };
    ["modes", "scales"].forEach((c) => CATS[c].forEach((x) => { x.sub = 4; x.start = 70; x.step = 6; }));

    if (typeof module !== "undefined" && module.exports) module.exports = CATS;
    else root.practiceCatalogue = CATS;
})(this);
