/**
 * Sonido de piedra sintetizado con Web Audio API, sin archivos de audio: una
 * ráfaga corta de ruido filtrado paso-bajo con envolvente rápida, parecida al
 * "clac" de una piedra física. Se reutiliza un único AudioContext (los
 * navegadores limitan cuántos se pueden crear) y se crea recién al primer
 * uso, dentro de un gesto del usuario, como exigen los navegadores modernos.
 */
let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    audioContext = new Ctor()
    return audioContext
  } catch {
    return null
  }
}

export function playStoneSound(): void {
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    if (ctx.state === 'suspended') void ctx.resume()

    const duration = 0.07
    const bufferSize = Math.ceil(ctx.sampleRate * duration)
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.pow(1 - i / bufferSize, 3)
      data[i] = (Math.random() * 2 - 1) * envelope
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 1400
    filter.Q.value = 0.6

    const gain = ctx.createGain()
    gain.gain.value = 0.5

    source.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)
    source.start()
  } catch {
    // Sin audio disponible, la interfaz sigue funcionando en silencio.
  }
}
