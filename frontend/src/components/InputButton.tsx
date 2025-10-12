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
                className={`size-10 border-4 border-red-400 rounded-full ${recording ? 'bg-red-500' : ''}`}
                onClick={recording ? handleStop : handleStart}
            />
        </div>
    )
}

export default InputButton