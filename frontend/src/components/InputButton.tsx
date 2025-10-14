import { useState } from 'react'
import { useRef } from 'react'

type InputButtonProps = {
    onAudioCapture: (audioBlob: Blob) => void
}


const InputButton = ({onAudioCapture} : InputButtonProps) => {
    const [recording, setRecording] = useState(false)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const audioChunksRef = useRef<Blob[]>([])




    const handleStart = async () => {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        audioChunksRef.current = []

        mediaRecorder.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data)
        }

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' })
            onAudioCapture(audioBlob)
        }

        mediaRecorder.start()
        setRecording(true)
    }
    const handleStop = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
            mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop())
            setRecording(false)
        }
    }
    return (
        <div className="flex items-center justify-center">
            <button
                aria-label={recording ? 'Stop recording' : 'Start recording'}
                className={`relative h-14 w-14 rounded-full glass ${recording ? 'bg-red-500/70' : 'bg-white/10'} transition-colors`}
                onClick={recording ? handleStop : handleStart}
            >
                <span className={`absolute inset-0 rounded-full ${recording ? 'animate-ping bg-red-400/30' : ''}`} />
                <span className={`absolute inset-1 rounded-full flex items-center justify-center ${recording ? 'bg-red-500' : 'bg-white/20'}`}>
                    <span className={`block ${recording ? 'h-3 w-3 rounded-sm bg-white' : 'h-4 w-4 rounded-full bg-white'}`} />
                </span>
            </button>
        </div>
    )
}

export default InputButton