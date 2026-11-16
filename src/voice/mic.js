/**
 * Starts the microphone and returns its live RMS level, or null when there is no
 * microphone or the player refused access (the game keeps working without it).
 */
export async function startMic() {
  try {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return null;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    return {
      level() {
        analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        return Math.sqrt(sum / buf.length);
      },
      stop() { stream.getTracks().forEach((tr) => tr.stop()); ctx.close(); },
    };
  } catch {
    return null;
  }
}
