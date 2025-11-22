// WAV conversion utilities

/**
 * Writes a string into a DataView at the given offset.
 */
export function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Converts a Float32Array to 16-bit PCM in a DataView.
 */
export function floatTo16BitPCM(output: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
}

/**
 * Encodes a Float32Array as a WAV file.
 */
export function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  // file length minus RIFF identifier length and file description length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, "WAVE");
  // format chunk identifier
  writeString(view, 12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (raw)
  view.setUint16(20, 1, true);
  // channel count - forcing mono here by averaging channels
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * 2, true);
  // block align (channel count * bytes per sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, "data");
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return buffer;
}

/**
 * Converts a WebM audio blob to a WAV blob.
 */
export async function convertWebMBlobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  const combined = new Float32Array(length);

  // Average channels to produce mono output
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      combined[i] += channelData[i];
    }
  }
  for (let i = 0; i < length; i++) {
    combined[i] /= numChannels;
  }
  const wavBuffer = encodeWAV(combined, audioBuffer.sampleRate);
  return new Blob([wavBuffer], { type: "audio/wav" });
} 

/**
 * Converts any audio Blob (e.g., WebM) to a 16 kHz mono WAV Blob.
 */
export async function convertBlobToWav16kMono(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const tempCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const decoded = await tempCtx.decodeAudioData(arrayBuffer);
  const targetSampleRate = 16000;

  if (decoded.sampleRate === targetSampleRate) {
    // Already 16k — just downmix to mono and encode
    const numChannels = decoded.numberOfChannels;
    const length = decoded.length;
    const combined = new Float32Array(length);
    for (let ch = 0; ch < numChannels; ch++) {
      const data = decoded.getChannelData(ch);
      for (let i = 0; i < length; i++) combined[i] += data[i];
    }
    for (let i = 0; i < length; i++) combined[i] /= numChannels;
    const wav = encodeWAV(combined, targetSampleRate);
    try { await tempCtx.close(); } catch {}
    return new Blob([wav], { type: "audio/wav" });
  }

  // Resample to 16k using OfflineAudioContext
  const length16k = Math.ceil(decoded.duration * targetSampleRate);
  const offline = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
    decoded.numberOfChannels,
    length16k,
    targetSampleRate
  );
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start(0);
  const rendered = await offline.startRendering();

  // Downmix to mono by averaging channels
  const outLen = rendered.length;
  const channels = rendered.numberOfChannels;
  const mono = new Float32Array(outLen);
  for (let ch = 0; ch < channels; ch++) {
    const data = rendered.getChannelData(ch);
    for (let i = 0; i < outLen; i++) mono[i] += data[i];
  }
  for (let i = 0; i < outLen; i++) mono[i] /= channels;
  const wavBuf = encodeWAV(mono, targetSampleRate);
  try { await tempCtx.close(); } catch {}
  return new Blob([wavBuf], { type: "audio/wav" });
}