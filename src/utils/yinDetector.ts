export function yinDetector(buffer: Float32Array, sampleRate: number): number {
    const threshold = 0.1;
    const bufferSize = buffer.length;
    const yinBuffer = new Float32Array(bufferSize / 2);

    let tau, delta;

    for (tau = 0; tau < yinBuffer.length; tau++) {
        yinBuffer[tau] = 0;
        for (let i = 0; i < yinBuffer.length; i++) {
            delta = buffer[i] - buffer[i + tau];
            yinBuffer[tau] += delta * delta;
        }
    }

    yinBuffer[0] = 1;
    let runningSum = 0;
    for (tau = 1; tau < yinBuffer.length; tau++) {
        runningSum += yinBuffer[tau];
        yinBuffer[tau] *= tau / runningSum;
    }

    let minTau = -1;
    for (tau = 2; tau < yinBuffer.length; tau++) {
        if (yinBuffer[tau] < threshold) {
            while (tau + 1 < yinBuffer.length && yinBuffer[tau + 1] < yinBuffer[tau]) {
                tau++;
            }
            minTau = tau;
            break;
        }
    }

    if (minTau === -1) return -1;

    const x0 = yinBuffer[minTau - 1];
    const x1 = yinBuffer[minTau];
    const x2 = yinBuffer[minTau + 1];

    const betterTau = minTau + (x2 - x0) / (2 * (2 * x1 - x2 - x0));

    return sampleRate / betterTau;
}
