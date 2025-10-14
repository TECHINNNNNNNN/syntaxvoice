import { useState } from 'react'
import { useRef, useEffect } from 'react'

type InputButtonProps = {
    onAudioCapture: (audioBlob: Blob) => void
}


const InputButton = ({onAudioCapture} : InputButtonProps) => {
    const [recording, setRecording] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
    const rafRef = useRef<number | null>(null)
    const [levels, setLevels] = useState<number[]>([2,4,8,4,2])
    const rippleRef = useRef<HTMLSpanElement | null>(null)

    // cleanup on unmount
    useEffect(() => {
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            audioContextRef.current?.close()?.catch(() => {})
        }
    }, [])

    type WindowWithWebAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
    const playTone = (freq: number, durationMs: number, volume: number) => {
        try {
            const { AudioContext: StdCtx, webkitAudioContext } = window as WindowWithWebAudio
            const Ctx: typeof AudioContext = StdCtx || (webkitAudioContext as unknown as typeof AudioContext)
            const ctx = new Ctx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.value = freq
            gain.gain.setValueAtTime(0.0001, ctx.currentTime)
            gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02)
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs/1000)
            osc.connect(gain).connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + durationMs/1000 + 0.02)
            // close a bit later to allow tail
            setTimeout(() => ctx.close()?.catch(() => {}), durationMs + 60)
        } catch {
            // no-op: audio cues are optional; ignore if the environment blocks audio
        }
    }




    const handleStart = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        // Press ripple feedback
        if (rippleRef.current) {
            rippleRef.current.classList.remove('mic-ripple')
            // reflow to restart animation
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            rippleRef.current.offsetHeight
            rippleRef.current.classList.add('mic-ripple')
        }

        mediaRecorder.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data)
        }

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
            onAudioCapture(audioBlob)
            // stop analyser
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            rafRef.current = null
            audioContextRef.current?.close()?.catch(() => {})
            audioContextRef.current = null
            analyserRef.current = null
            dataArrayRef.current = null
        }

        mediaRecorder.start()
        setRecording(true)
        // start cue
        playTone(660, 140, 0.08)

        // Setup Web Audio for live levels
        type WindowWithWebAudio = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }
        const { AudioContext: StdCtx, webkitAudioContext } = window as WindowWithWebAudio
        const Ctx: typeof AudioContext = StdCtx || (webkitAudioContext as unknown as typeof AudioContext)
        const audioContext = new Ctx()
        const source = audioContext.createMediaStreamSource(stream)
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 256
        const bufferLength = analyser.frequencyBinCount
        // Ensure underlying ArrayBuffer to satisfy TS type for WebAudio methods
        const dataArray = new Uint8Array(new ArrayBuffer(bufferLength)) as unknown as Uint8Array<ArrayBuffer>
        source.connect(analyser)

        audioContextRef.current = audioContext
        analyserRef.current = analyser
        dataArrayRef.current = dataArray

        const update = () => {
            if (!analyserRef.current || !dataArrayRef.current) return
            const arr = dataArrayRef.current as unknown as Uint8Array<ArrayBuffer>
            analyserRef.current.getByteTimeDomainData(arr as unknown as Uint8Array<ArrayBuffer>)
            // Compute simple peak over segments to drive 5 bars (more sensitive)
            const slice = Math.floor((arr as unknown as Uint8Array).length / 5)
            const nextLevels: number[] = []
            for (let i = 0; i < 5; i++) {
                let max = 0
                for (let j = i * slice; j < (i + 1) * slice; j++) {
                    const v = Math.abs((arr as unknown as Uint8Array)[j] - 128)
                    if (v > max) max = v
                }
                // Normalize with higher sensitivity: treat 48 as near-full level
                const normalized = Math.min(1, max / 48)
                const h = 3 + Math.min(24, Math.round(normalized * 24))
                nextLevels.push(h)
            }
            setLevels(nextLevels)
            rafRef.current = requestAnimationFrame(update)
        }
        rafRef.current = requestAnimationFrame(update)
    }
    const handleStop = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
            setRecording(false)
            // stop cue
            playTone(440, 120, 0.08)
        }
    }
    return (
        <div className="flex items-center justify-center">
            <button
                aria-label={recording ? 'Stop recording' : 'Start recording'}
                className={`relative ${recording ? 'h-16 w-40 rounded-full' : 'h-20 w-20 rounded-full'} glass ${recording ? 'bg-amber-700/80' : 'bg-black/20'} transition-all duration-300 ease-out`}
                onClick={recording ? handleStop : handleStart}
            >
                <span ref={rippleRef} />
                {recording && <span className="mic-glow" />}
                <span className={recording ? 'pill-ring' : 'mic-ring-classic'} />
                {!recording && <span className="mic-face" />}
                {!recording && <span className="mic-face-art" />}
                {!recording && <span className="mic-highlight" />}
                {!recording && <span className="mic-inner-etch" />}
                <span className={`absolute inset-1 rounded-full flex items-center justify-center ${recording ? 'bg-amber-600' : ''}`}>
                    {recording ? (
                        <div className="flex items-center gap-3 px-4" aria-hidden>
                            <div className="eq-bars-live">
                                {levels.map((h, i) => (
                                    <span key={i} className="eq-bar-live" style={{ height: h }} />
                                ))}
                            </div>
                            <span className="text-white/90 text-sm">Listening…</span>
                        </div>
                    ) : (
                        <svg className="mic-icon" width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                            <defs>
                                <linearGradient id="micGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#fff8e6" stopOpacity=".95"/>
                                    <stop offset="100%" stopColor="#e7c36b" stopOpacity=".9"/>
                                </linearGradient>
                                <linearGradient id="outlineGrad" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stopColor="#ffffff" stopOpacity=".9"/>
                                    <stop offset="100%" stopColor="#ffffff" stopOpacity=".4"/>
                                </linearGradient>
                            </defs>
                            {/* mic capsule */}
                            <rect x="12" y="7" width="6" height="12" rx="3" fill="url(#micGrad)"/>
                            <rect x="12" y="7" width="6" height="12" rx="3" stroke="url(#outlineGrad)" strokeWidth="0.6"/>
                            {/* cradle arc */}
                            <path d="M8 13.5a7 7 0 1 0 14 0" stroke="url(#outlineGrad)" strokeWidth="1.6" strokeLinecap="round"/>
                            {/* stem and base */}
                            <path d="M15 21.5v3.2" stroke="url(#outlineGrad)" strokeWidth="1.6" strokeLinecap="round"/>
                            <path d="M11.2 24.7h7.6" stroke="url(#outlineGrad)" strokeWidth="1.6" strokeLinecap="round"/>
                        </svg>
                    )}
                </span>
            </button>
        </div>
    )
}

export default InputButton