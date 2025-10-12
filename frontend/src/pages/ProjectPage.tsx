import {useState, useEffect} from 'react'
import { useParams } from 'react-router-dom'
import InputButton from '../components/InputButton'
import Sidebar from '../components/Sidebar'
import { useProjects } from '../Hooks/useProjects'



const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

type Message = {
    id: number;
    content: string;
    enhancedPrompt: string;
}

type Project = {
    name: string;
    description?: string;

    messages?: Message[];
}

export default function ProjectPage() {
    const {projectId} = useParams()
    const [project, setProject] = useState<Project | null>(null)
    const [messages, setMessages] = useState<Message[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const {projects, loading: projectsLoading, error: errorProjectsLoading, createProject} = useProjects()

    useEffect(() => {
        const fetchProjectDetails = async () => {
            try {
                const response = await fetch(`${BASE_URL}/project/${projectId}`, {
                    method: 'GET',
                    headers: {
                        "Authorization": `Bearer ${localStorage.getItem('token')}`
                    }
                })

                const responseData = await response.json()

                if (response.ok){
                    setProject(responseData.project)
                    setMessages(responseData.project.messages || [])
                    setLoading(false)
                }else{
                    setError('Failed to fetch project details')
                    setLoading(false)
                }
            } catch (error) {
                setError('An error occurred while fetching project details')
                setLoading(false)
            }
        }

        fetchProjectDetails()
    },[projectId])

    const handleAudioCapture = async (audioBlob: Blob) => {
        const formData = new FormData()
        formData.append('audio', audioBlob, 'audio.wav')
        if (projectId) {
            formData.append('projectId', projectId)
        }
        
        try {
            const response = await fetch(`${BASE_URL}/transcribe`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem('token')}`
                },
                body: formData,
            })

            const responseData = await response.json()
            // backend returns the created message under responseData.message
            const newMessage = responseData.message
            console.log("Enhanced Prompt:", newMessage?.enhancedPrompt)

            if (response.ok && newMessage) {
                await navigator.clipboard.writeText(newMessage.enhancedPrompt)
                console.log('Transcript copied to clipboard!')
                setMessages(prevMessages => [...prevMessages, newMessage])
            }
        } catch (error) {
            console.error('Error:', error)
        }
    }

    if (loading) {
        return <div>Loading...</div>
    }
        if (error) {
                return <div className="p-8">Error: {error}</div>
        }

        return (
                <div className="flex">
                        <Sidebar projects={projects} loading={projectsLoading} error={errorProjectsLoading} createProject={createProject} /> 
                        <main className="flex-1 p-8">
                                <h1>Project: {project?.name}</h1>
                                <p>{project?.description}</p>
                                <div className="message-list">
                                {messages.map((msg,i) => (
                                        <div key={i} className="message">
                                            <p><strong>Original:</strong> {msg.content}</p>
                                            <p><strong>Enhanced:</strong> {msg.enhancedPrompt}</p>
                                        </div>
                                ))}
                                </div>
                                <div className='fixed bottom-10 w-full flex justify-center'>
                                <InputButton onAudioCapture={handleAudioCapture} />
                                </div>
                        </main>
                </div>
        )

}