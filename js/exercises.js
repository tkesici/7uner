/* 7uner – Practice exercise catalogue: names, descriptions and tempos.
   The notes live in practice/, written by tools/make-practice-files.js
   (which also reads this file): techniques in <id>.gp, scales and modes in
   <id>-p<position>.gp. Techniques are sorted into groups. Modes and scales
   are in A; iv lists their intervals in semitones from the root, and
   positions() places them on the neck. sub is notes per beat, start the
   suggested tempo and step how far to raise it once an exercise is clean. */
(function (root) {
    "use strict";

    const CATS = {
        tech: [
            { id: "chrom", group: "Alternate picking", name: "Chromatic 1-2-3-4", sub: 4, start: 60, step: 8,
                desc: "Sixteenth notes, changing pick direction on every note (down-up). One finger per fret, 1-2-3-4. The rhythm shouldn’t slip when you cross strings." },
            { id: "cross", group: "Alternate picking", name: "Two-string crossing", sub: 4, start: 72, step: 8,
                desc: "Alternate picking between two strings: the pick goes round the outside of the pair on one note and between them on the next. Keep the motion small and the notes even." },
            { id: "skip", group: "Alternate picking", name: "Octave string skipping", sub: 4, start: 70, step: 8,
                desc: "Octave pairs that skip a string, a melodic line in the low and middle register. Mute the skipped string with the underside of your fretting finger." },
            { id: "pent", group: "Alternate picking", name: "A minor pentatonic – box 1", sub: 4, start: 72, step: 8,
                desc: "The classic box at the 5th fret, up and down in sixteenths. Alternate picking." },
            { id: "seq3", group: "Alternate picking", name: "Pentatonic in threes", sub: 6, start: 50, step: 6,
                desc: "Box 1 of A minor pentatonic as overlapping groups of three (1-2-3, 2-3-4, …), six notes a beat. Sequences like this turn a scale into licks." },
            { id: "nps", group: "Alternate picking", name: "Three notes per string", sub: 6, start: 54, step: 6,
                desc: "A natural minor in sextuplets: six notes per beat, so one string per beat. This is the foundation of fast solo runs." },
            { id: "leg", group: "Legato", name: "Hammer-ons and pull-offs", sub: 4, start: 72, step: 8,
                desc: "Pick only the unmarked notes. h = hammer-on, p = pull-off. Your fretting hand should sound every note clearly on its own." },
            { id: "pullpent", group: "Legato", name: "Pentatonic legato", sub: 4, start: 70, step: 8,
                desc: "Box 1 going up with one pick and a hammer-on per string, then down with a pick and a pull-off. Let the fretting hand do the work." },
            { id: "trill", group: "Legato", name: "Trill endurance", sub: 4, start: 80, step: 8,
                desc: "Pick once, then keep the trill going with hammer-ons and pull-offs only. Stay even and keep both notes the same volume." },
            { id: "down", group: "Rhythm", name: "Downpicking endurance", sub: 2, start: 120, step: 10,
                desc: "Eighth notes with downstrokes only, palm muted. Keep the motion relaxed and the volume even; this is the stamina behind fast thrash rhythm playing." },
            { id: "gallop", group: "Rhythm", name: "Gallop", sub: 4, start: 90, step: 8,
                desc: "An eighth followed by two sixteenths, palm muted: down, down-up. Lock the two short notes tightly to the click." },
            { id: "revgallop", group: "Rhythm", name: "Reverse gallop", sub: 4, start: 90, step: 8,
                desc: "Two sixteenths and then an eighth, palm muted: down-up, down. The opposite lilt to the gallop; hold the eighth for its full length." },
            { id: "trem", group: "Rhythm", name: "Tremolo and palm muting", sub: 4, start: 80, step: 10,
                desc: "Continuous down-up sixteenths on the low E string with palm muting (PM). Builds picking-hand consistency and stamina; play from the wrist with small motions." },
            { id: "fing", group: "Finger independence", name: "1-3-2-4", sub: 4, start: 64, step: 6,
                desc: "Frets 5-7-6-8 on every string, then back down as 8-6-7-5. Keep each finger close to the fretboard and let the others rest lightly." },
            { id: "spider", group: "Finger independence", name: "Spider walk", sub: 4, start: 60, step: 6,
                desc: "Fingers 1 and 3 on one string, 2 and 4 on the next, climbing across all six strings. Only two fingers move at a time, which teaches them to work on their own." },
            { id: "arp", group: "Arpeggios and sweeps", name: "Am F G E arpeggios", sub: 6, start: 44, step: 6,
                desc: "Three-string arpeggios in sextuplets. Sweep the pick across the strings in one motion or alternate pick; keep the notes from ringing into each other." },
            { id: "sweep3", group: "Arpeggios and sweeps", name: "Three-string triad sweeps", sub: 6, start: 46, step: 4,
                desc: "Am, C, G and E triads on the top three strings: sweep up, hammer-on and pull-off at the top, sweep back. A first step towards five-string sweeps." },
            { id: "sweep", group: "Arpeggios and sweeps", name: "Five-string A minor sweep", sub: 6, start: 40, step: 4,
                desc: "One down-sweep across five strings, a hammer-on at the top, then an up-sweep back. Roll the fretting fingers so only one note sounds at a time." }
        ],
        modes: [
            { id: "ionian", name: "Ionian", iv: [0, 2, 4, 5, 7, 9, 11], formula: "1 2 3 4 5 6 7", spell: "A B C♯ D E F♯ G♯",
                desc: "Ionian is the major scale: bright and settled. Use it over A major chords and in major keys." },
            { id: "dorian", name: "Dorian", iv: [0, 2, 3, 5, 7, 9, 10], formula: "1 2 ♭3 4 5 6 ♭7", spell: "A B C D E F♯ G",
                desc: "Minor with a major 6th, which makes it brighter than natural minor. A favourite for rock, funk and jazz solos over Am7 or an Am–D vamp." },
            { id: "phrygian", name: "Phrygian", iv: [0, 1, 3, 5, 7, 8, 10], formula: "1 ♭2 ♭3 4 5 ♭6 ♭7", spell: "A B♭ C D E F G",
                desc: "Minor with a flat 2nd: dark and tense, with a Spanish or metal flavour. Try it over A5 power-chord riffs that move to B♭." },
            { id: "lydian", name: "Lydian", iv: [0, 2, 4, 6, 7, 9, 11], formula: "1 2 3 ♯4 5 6 7", spell: "A B C♯ D♯ E F♯ G♯",
                desc: "Major with a raised 4th: dreamy and floating. Works over Amaj7 or an A–B vamp." },
            { id: "mixolydian", name: "Mixolydian", iv: [0, 2, 4, 5, 7, 9, 10], formula: "1 2 3 4 5 6 ♭7", spell: "A B C♯ D E F♯ G",
                desc: "Major with a flat 7th: bluesy, classic-rock major. Use it over A7 or an A–G–D progression." },
            { id: "aeolian", name: "Aeolian", iv: [0, 2, 3, 5, 7, 8, 10], formula: "1 2 ♭3 4 5 ♭6 ♭7", spell: "A B C D E F G",
                desc: "Aeolian is the natural minor scale: sad and dramatic. The default for minor keys, over progressions like Am–F–G." },
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
    /* Rhythm: a course from counting the pulse to the odd and mixed meters,
       displaced accents and polymeters of progressive metal. All palm-muted
       chugs on the low E (x), with open, accented notes (X) marking where
       each group starts. Tempos are in quarter notes, also in x/8 and x/16
       meters. bars lists the meters (repeated in turn; 4/4 when there is
       none), count is how to say the bar out loud, and pick "alt" or "down"
       puts the pick strokes in the tab. */
    CATS.rhythm = [
        { id: "pulse", group: "1 · Counting the pulse", name: "Quarters, eighths, sixteenths", sub: 4, start: 60, step: 6, pick: "alt", count: "1 e & a 2 e & a 3 e & a 4 e & a",
            desc: "Count the sixteenths out loud the whole time, even while you play quarters. Your picking hand moves down-up on every sixteenth and only touches the string where a note is: down on the beat and on ‘&’, up on ‘e’ and ‘a’." },
        { id: "accents", group: "1 · Counting the pulse", name: "Moving the accent", sub: 4, start: 60, step: 6, pick: "alt", count: "1 e & a 2 e & a 3 e & a 4 e & a",
            desc: "Steady sixteenths, palm muted; the open, accented note lands on 1, then ‘e’, then ‘&’, then ‘a’. Say the syllable of the accent louder. The accents on ‘e’ and ‘a’ are upstrokes: don’t switch to a downstroke to hit them harder." },
        { id: "triplets", group: "1 · Counting the pulse", name: "Triplets: 1-trip-let", sub: 3, start: 60, step: 6, pick: "alt", count: "1 trip let 2 trip let 3 trip let 4 trip let",
            desc: "Three notes per beat. With alternate picking every other beat starts with an upstroke, which is what makes triplets feel slippery. Then move the accent to ‘trip’ and ‘let’: the triplet feel behind many slow, heavy grooves." },
        { id: "ghosts", group: "2 · Rests and syncopation", name: "Rests with a moving hand", sub: 4, start: 64, step: 6, pick: "alt", count: "1 e & a 2 e & a 3 e & a 4 e & a",
            desc: "The core of tight metal rhythm: your picking hand never stops. On a rest it still swings down or up, just missing the strings. The pick strokes in the tab show which way each note goes; if a note comes out the wrong way, you’ve lost the grid." },
        { id: "offbeats", group: "2 · Rests and syncopation", name: "Off-beat sixteenths", sub: 4, start: 56, step: 6, pick: "alt", count: "1 e & a 2 e & a 3 e & a 4 e & a",
            desc: "Notes only on ‘&’, then only on ‘e’, then only on ‘a’, then on both. Tap your foot on the beats, where nothing is played. The ‘e’ and ‘a’ notes are always upstrokes." },
        { id: "displace", group: "2 · Rests and syncopation", name: "Shifting a riff by a sixteenth", sub: 4, start: 60, step: 6, pick: "alt", count: "1 e & a 2 e & a 3 e & a 4 e & a",
            desc: "One small figure (accent, two chugs, a rest) starts on 1, then a sixteenth later each bar. This metric displacement is a favourite trick of modern metal: the riff stays the same but sits differently against the beat. Keep counting from 1." },
        { id: "stabs", group: "2 · Rests and syncopation", name: "Chugs and stabs", sub: 4, start: 64, step: 6, pick: "alt", count: "1 e & a 2 e & a 3 e & a 4 e & a",
            desc: "Palm-muted chugs answered by open, accented stabs on the first fret, and a held note on the A string: the push-and-pull of a Gojira-style groove. Let the held note ring for its full length and come in again exactly on time." },
        { id: "tresillo", group: "3 · Threes and fives over four", name: "3 + 3 + 2", sub: 2, start: 90, step: 8, pick: "down", count: "1 & 2 | & 3 & | 4 &",
            desc: "Eight eighth notes grouped 3 + 3 + 2. The accents fall on 1, the ‘&’ of 2 and 4, against the steady beat. Downpick everything, then play only the accents." },
        { id: "threes", group: "3 · Threes and fives over four", name: "Groups of three in sixteenths", sub: 4, start: 56, step: 6, pick: "alt", count: "1 e & a … (accent every third)",
            desc: "Accent every third sixteenth. The accent moves through the beat (1, ‘a’, ‘&’, ‘e’…) and comes back to 1 after three bars. Keep counting the bar, not the group: that is how you hear a polymeter like this against the drums." },
        { id: "fives", group: "3 · Threes and fives over four", name: "Groups of five in sixteenths", sub: 4, start: 56, step: 6, pick: "alt", count: "1 e & a … (a new group every fifth)",
            desc: "A five-sixteenth figure repeated against 4/4: it takes five bars to come round to 1 again. Riffs built like this sound lopsided while the drums stay in plain 4/4. Count both: the group (1-2-3-4-5) in your head and the bar with your foot." },
        { id: "qtriplets", group: "3 · Threes and fives over four", name: "Quarter-note triplets", sub: 3, start: 64, step: 6, pick: "alt", count: "1 trip let 2 trip let 3 trip let 4 trip let",
            desc: "Quarter notes, then quarter-note triplets (three notes across two beats), then half-note triplets. Count the eighth-note triplets all the way through: the quarter-note triplet is every other ‘trip-let’ syllable." },
        { id: "sevens", group: "3 · Threes and fives over four", name: "Groups of seven over four", sub: 4, start: 52, step: 4, pick: "alt", count: "1 e & a … (a new group every seventh)",
            desc: "A seven-sixteenth figure against 4/4, coming back to 1 after seven bars. The hardest of the polymeters here: keep the sixteenths perfectly even and let the accents fall where they fall." },
        { id: "five4", group: "4 · Odd meters", name: "5/4", sub: 2, start: 90, step: 8, pick: "down", bars: [[5, 4]], count: "1 & 2 & 3 & | 4 & 5 &",
            desc: "Five beats in a bar, felt as 3 + 2. Count all five out loud and accent 1 and 4. Once it feels natural, try counting it as 1 2 3 1 2." },
        { id: "seven8", group: "4 · Odd meters", name: "7/8 as 2 + 2 + 3", sub: 2, start: 100, step: 8, pick: "down", bars: [[7, 8]], count: "1 2 | 1 2 | 1 2 3",
            desc: "Seven eighth notes: two short groups and a long one. Count ‘1 2, 1 2, 1 2 3’ rather than up to seven; the accents are where you say 1. The metronome clicks every eighth note here." },
        { id: "seven8groups", group: "4 · Odd meters", name: "7/8: three ways to group it", sub: 2, start: 100, step: 8, pick: "down", bars: [[7, 8]], count: "2+2+3 | 3+2+2 | 2+3+2",
            desc: "The same seven eighths grouped 2 + 2 + 3, 3 + 2 + 2 and 2 + 3 + 2. Progressive bands often switch grouping inside a riff; feel where the long group is." },
        { id: "five8", group: "4 · Odd meters", name: "5/8", sub: 2, start: 100, step: 8, pick: "down", bars: [[5, 8]], count: "1 2 3 | 1 2",
            desc: "A short, limping bar: 3 + 2, then 2 + 3 at the end. Count ‘1 2 3 1 2’ and keep the eighth notes exactly even." },
        { id: "nine8", group: "4 · Odd meters", name: "9/8 as 2 + 2 + 2 + 3", sub: 2, start: 100, step: 8, pick: "down", bars: [[9, 8]], count: "1 2 | 1 2 | 1 2 | 1 2 3",
            desc: "Nine eighths in three short groups and one long one. The long group at the end gives the bar its lurch, a feel heard all over progressive rock and metal." },
        { id: "fiveseven", group: "5 · Mixed meters", name: "5/8 then 7/8", sub: 4, start: 70, step: 6, pick: "alt", bars: [[5, 8], [7, 8]], count: "5/8: 1 & 2 & 3 & 4 & 5 & | 7/8: 1 & 2 & … 7 &",
            desc: "Alternating 5/8 and 7/8 bars in sixteenths, with rests. Together they make 12 eighths, so the pair feels like one long, uneven bar: a common way progressive bands build riffs. Keep the picking hand moving through the rests." },
        { id: "countdown", group: "5 · Mixed meters", name: "Counting down: 9/8, 8/8, 7/8", sub: 2, start: 100, step: 8, pick: "down", bars: [[9, 8], [8, 8], [7, 8]], count: "3+3+3 | 3+3+2 | 2+2+3",
            desc: "Each bar is one eighth shorter than the one before. Shrinking and growing bars like these are a hallmark of Tool’s songwriting; here they’re built from groups of 3 and 2 so you can count them." },
        { id: "thirteen", group: "5 · Mixed meters", name: "13/16 as 4 + 4 + 5", sub: 4, start: 64, step: 6, pick: "alt", bars: [[13, 16]], count: "1 e & a | 1 e & a | 1 e & a 5",
            desc: "A 4/4 bar short of three sixteenths, felt as 4 + 4 + 5. Each bar starts with a downstroke, so the odd sixteenth at the end gives two downstrokes in a row across the bar line." },
        { id: "shifting", group: "5 · Mixed meters", name: "6/8, 7/8, 5/8, 6/8", sub: 4, start: 64, step: 6, pick: "alt", bars: [[6, 8], [7, 8], [5, 8], [6, 8]], count: "6: 1 2 3 4 5 6 | 7: 1 … 7 | 5: 1 … 5",
            desc: "The meter changes every bar. Count the eighths of each bar from 1; read the next bar’s length before you get there, the way you would in a long progressive song." },
        { id: "finale", group: "5 · Mixed meters", name: "Putting it together", sub: 4, start: 60, step: 4, pick: "alt", bars: [[7, 8], [7, 8], [4, 4], [5, 8]], count: "7/8 | 7/8 | 4/4 in threes | 5/8",
            desc: "Everything at once: syncopated chugs and stabs in 7/8, a held note, a bar of 4/4 in groups of three, and a 5/8 bar to turn it round. When this loops cleanly at speed, the riffs you’ve been learning by ear will start to make sense on paper too." }
    ];
    ["modes", "scales"].forEach((c) => CATS[c].forEach((x) => { x.sub = 4; x.start = 70; x.step = 6; }));

    /* Positions for the scales and modes, one per note of the scale: position
       k starts on the scale's k-th note on the low E string (counting up from
       the root at the 5th fret, and down an octave past the 14th) and covers
       that fret and the three above it, plus one below for the stretch. The
       generator plays the scale's notes inside each window. */
    function positions(iv) {
        return iv.map((d) => { const f = 5 + d > 14 ? d - 7 : 5 + d; return { lo: f - 1, hi: f + 3 }; });
    }

    // a hash of practice/*.gp, added to their URLs so caches never serve an
    // old copy; kept up to date by tools/stamp-assets.js
    const practiceFilesVersion = "1cfe8643";

    if (typeof module !== "undefined" && module.exports) { module.exports = CATS; Object.defineProperty(CATS, "positions", { value: positions }); }
    else { root.practiceCatalogue = CATS; root.practiceFilesVersion = practiceFilesVersion; root.practicePositions = positions; }
})(this);
