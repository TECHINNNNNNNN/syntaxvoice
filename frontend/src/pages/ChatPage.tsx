import {useState, useEffect, use} from 'react'
import { useParams,useNavigate } from 'react-router-dom'
import { useProjects } from '../Hooks/useProjects'
import Sidebar from '../components/Sidebar'
import InputButton from '../components/InputButton'
import { set } from 'zod'

type Message = {
    id: number;
    content: string;
    enhancedPrompt: string;
}

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

export default function ChatPage(){
    const {projectId} = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const {createProject, projects, loading: projectsLoading, error: errorProjectsLoading, updateProject} = useProjects()
    const [isNewChat, setIsNewChat] = useState(projectId === 'new')
    const [messages, setMessages] = useState<Message[]>([])
    const [error, setError] = useState<string | null>(null)
    const [project, setProject] = useState<{name: string, description?: string} | null>(null)

    useEffect(() => {
        const isNew = projectId === 'new'
        setIsNewChat(isNew)
        if (!isNew) {
            const fetchMessages = async () => {
                try {
                    const response = await fetch(`${BASE_URL}/project/${projectId}`, {
                        method: 'GET',
                        headers: {
                            "Authorization": `Bearer ${localStorage.getItem('token')}`
                        }
                    })

                    if (response.ok) {
                        const responseData = await response.json()
                        setMessages(responseData.project.messages || [])
                        setLoading(false)
                    } else {
                        setError('Failed to fetch messages')
                        setLoading(false)
                    }
                } catch (error) {
                    setError('An error occurred while fetching messages')
                    setLoading(false)
                }
            }
            fetchMessages()
        } else {
            setMessages([])
            setProject(null)
            setLoading(false)
        }
    },[projectId])

    const generateTitleFromText = (text:string) => {
        return text.split(' ').slice(0, 5).join(' ') + '...';
    };

    const handleAudioCapture = async (audioBlob: Blob) => {
        let currentProjectId = projectId
        let isProjectJustCreated = false

        if (isNewChat) {
            const newProjectData = {name: `New Project ${new Date().toLocaleString()}`}
            const createdProject = await createProject(newProjectData)
            if (createdProject) {
                currentProjectId = createdProject.id.toString()
                setIsNewChat(false)
                isProjectJustCreated = true
                navigate(`/project/${currentProjectId}`, {replace: true})
            } else {
                console.error('Failed to create project')
                return
            }
        }

        const formData = new FormData()
        formData.append('audio', audioBlob, 'audio.wav')
        if (currentProjectId){
            formData.append('projectId', currentProjectId)
        }

        try {
            const response = await fetch(`${BASE_URL}/transcribe`, {
                method: 'POST',
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem('token')}`
                },
                body: formData,
            })

            if (response.ok) {
                // const data = await response.json()
                // const newMessage: Message = {
                //     id: data.message.id,
                //     content: data.message.content,
                //     enhancedPrompt: data.message.enhancedPrompt
                // }
                // setMessages(prevMessages => [newMessage,...prevMessages])
                const reader = response.body?.getReader()
                const decoder = new TextDecoder()
                let buffer = ''
                let headerProcessed = false;


                const placeholderId = Date.now()
                const newMessage: Message = { 
                    id: placeholderId, 
                    content: ' processing...', // Placeholder content
                    enhancedPrompt: '' 
                }; 

                setMessages(prevMessages => [...prevMessages,newMessage])

                while (reader) {
                    const result = await reader.read();
                    if (result.done) break;

                    buffer += decoder.decode(result.value, { stream: true });

                   if (!headerProcessed){
                    const delimiterIndex = buffer.indexOf('\n---\n')
                    if (delimiterIndex !== -1){
                        const headerJson = buffer.substring(0,delimiterIndex)
                        const {originalTranscript} = JSON.parse(headerJson)

                        setMessages(prev => prev.map(msn => 
                            msn.id === placeholderId ? {...msn,content: originalTranscript} : msn
                        ))

                        buffer = buffer.substring(delimiterIndex + 5);
                        headerProcessed = true;
                    }
                   }

                   if (headerProcessed) {
                        setMessages(prev => 
                            prev.map(msg => 
                                msg.id === placeholderId ? {...msg, enhancedPrompt: buffer} : msg
                            )
                        )
                   }
                    
                }

                await navigator.clipboard.writeText(buffer)
                console.log("🫡 Your enhanced Prompt is copied to clipboard")

                if (isProjectJustCreated) {
                    const newTitle = generateTitleFromText(newMessage.content)
                    const updatedProject = {projectId: Number(currentProjectId), name: newTitle, description: project?.description}
                    await updateProject(updatedProject)
                    setProject({name: newTitle, description: project?.description})
                }
            }else {
                console.error('Failed to transcribe audio')
                setError('Failed to transcribe audio')
            }
        } catch (error) {
            console.error('Error:', error)
            setError('An error occurred during audio transcription')
        }
    }

    return (
        <div className="flex">
                <Sidebar projects={projects} loading={projectsLoading} error={errorProjectsLoading} createProject={createProject} /> 
                <main className="flex-1 p-8">
                        <h1>Project: {project?.name}</h1>
                        <p>{project?.description}</p>
                        <div className="message-list">
                        {messages.map((msg) => (
                                <div key={msg.id} className="message">
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