import { useState } from 'react'
import InputButton from '../components/InputButton'
import Sidebar from '../components/Sidebar'
import { useProjects } from '../Hooks/useProjects'

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

function Homepage() {
  const [transcript, setTranscript] = useState('')
    const {projects, loading, error, createProject} = useProjects()
  const handleAudioCapture = async (audioBlob: Blob) => {
    const formData = new FormData()
    formData.append('audio', audioBlob, 'audio.wav')

    try {
      const response = await fetch(`${BASE_URL}/transcribe`, {
        method: 'POST',
        headers: {
            "Authorization": `Bearer ${localStorage.getItem('token')}`
        },
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        const enhancedPrompt = data.enhancedprompt
        setTranscript(enhancedPrompt)

        if (enhancedPrompt) {
          await navigator.clipboard.writeText(enhancedPrompt)
          console.log('Transcript copied to clipboard!')
        }
        
      } else {
        console.error('Failed to transcribe audio')
      }
    } catch (error) {
      console.error('Error:', error)
    }
  }

  return (
    <main className="min-h-screen w-screen bg-gray-900 text-white">
      <Sidebar projects={projects} loading={loading} error={error} createProject={createProject} /> 
      <div className="flex-1 flex items-center justify-center">
        <p className="text-2xl">{transcript}</p>
      </div>
      <div className='fixed bottom-10 w-full flex justify-center'> 
        <InputButton onAudioCapture={handleAudioCapture} />
      </div>
    </main>
  )
}

export default Homepage
