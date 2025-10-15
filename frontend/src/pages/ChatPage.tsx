import {useState, useEffect, useRef} from 'react'
import { useParams,useNavigate } from 'react-router-dom'
import { useProjects } from '../Hooks/useProjects'
import Sidebar from '../components/Sidebar'
import InputButton from '../components/InputButton'
import ProjectSettingsModal from '../components/ProjectSettingsModal'
import { Cog, Copy } from 'lucide-react';

type Message = {
    id: number;
    content: string;
    enhancedPrompt: string;
}

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

function escapeHtml(input: string): string {
    return input
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function highlightXml(text: string): string {
    const escaped = escapeHtml(text)
    // Color angle brackets, slashes and tag names. Attributes left as-is for subtlety
    return escaped.replace(/&lt;(\/)?([a-zA-Z0-9_-]+)([^&]*?)&gt;/g, (_m, slash, tag, rest) => {
        const slashPart = slash ? '<span class="syntax-slash">/</span>' : ''
        return `<span class="syntax-angle">&lt;</span>${slashPart}<span class="syntax-tag">${tag}</span>${rest}<span class="syntax-angle">&gt;</span>`
    })
}

export default function ChatPage(){
    const {projectId} = useParams()
    const navigate = useNavigate()
    const [loading, setLoading] = useState(true)
    const {createProject, projects, loading: projectsLoading, error: errorProjectsLoading, updateProject, updateProjectDetails} = useProjects()
    const [isNewChat, setIsNewChat] = useState(projectId === 'new')
    const [messages, setMessages] = useState<Message[]>([])
    const [error, setError] = useState<string | null>(null)
    const [project, setProject] = useState<{name: string, description?: string} | null>(null)
    const [isSettingModalOpen, setIsSettingModalOpen] = useState<boolean>(false)
    const [showCopiedToast, setShowCopiedToast] = useState<boolean>(false)
    const bottomRef = useRef<HTMLDivElement | null>(null)
    const projectIdNumber = Number(projectId)
    let projectNameFromAudio: string  =  ''

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
                        setProject(responseData.project)
                        setLoading(false)
                    } else {
                        setError('Failed to fetch messages')
                        setLoading(false)
                    }
                } catch {
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

    // Auto-scroll: keep the latest message visible by scrolling a bottom sentinel into view
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages.length])

    // Inline feedback for loading and errors to keep UI responsive
    if (loading) {
        return (
            <div className="flex">
                <Sidebar projects={projects} loading={projectsLoading} error={errorProjectsLoading} createProject={createProject} /> 
                <main className="flex-1 p-6 md:p-10">
                    <div className='glass card-rounded px-4 py-3'>Loading…</div>
                </main>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex">
                <Sidebar projects={projects} loading={projectsLoading} error={errorProjectsLoading} createProject={createProject} /> 
                <main className="flex-1 p-6 md:p-10">
                    <div className='glass card-rounded px-4 py-3 text-red-300'>
                        {error}
                    </div>
                </main>
            </div>
        )
    }

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
                // scroll after DOM updates
                requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))

                while (reader) {
                    const result = await reader.read();
                    if (result.done) break;

                    buffer += decoder.decode(result.value, { stream: true });

                   if (!headerProcessed){
                    const delimiterIndex = buffer.indexOf('\n---\n')
                    if (delimiterIndex !== -1){
                        const headerJson = buffer.substring(0,delimiterIndex)
                        const {originalTranscript} = JSON.parse(headerJson)
                        projectNameFromAudio = originalTranscript

                        setMessages(prev => prev.map(msn => 
                            msn.id === placeholderId ? {...msn,content: originalTranscript} : msn
                        ))
                        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))

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
                        // keep following the stream to bottom
                        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }))
                   }

                   if (isProjectJustCreated) {
                        const newTitle = generateTitleFromText(projectNameFromAudio)
                        const updatedProject = {projectId: Number(currentProjectId), name: newTitle, description: project?.description}
                        await updateProject(updatedProject)
                        setProject({name: newTitle, description: project?.description})
                    }

                    
                }

                await navigator.clipboard.writeText(buffer)
                setShowCopiedToast(true)
                setTimeout(() => setShowCopiedToast(false), 2000)
                console.log("🫡 Your enhanced Prompt is copied to clipboard")

            }else {
                if (response.status === 402) {
                    navigate('/billing/subscribe')
                    return
                }
                console.error('Failed to transcribe audio')
                setError('Failed to transcribe audio')
            }
        } catch (error) {
            console.error('Error:', error)
            setError('An error occurred during audio transcription')
        }
    }

    const handleManualCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
            setShowCopiedToast(true)
            setTimeout(() => setShowCopiedToast(false), 2000)
        } catch (e) {
            console.error('Failed to copy text:', e)
        }
    }

    const handleUpdateProjet = async (data: {name?:string, description?:string,techStack?:string}) => {
        console.log(`projectId: ${projectId}, name: ${data.name}, description: ${data.description}, techStack: ${data.techStack}`)
        const updatedDetails = await updateProjectDetails({projectId: projectIdNumber, ...data})
        setProject(updatedDetails)
        setIsSettingModalOpen(false)
    }

    return (
        <>
            <div className="flex">
                <Sidebar projects={projects} loading={projectsLoading} error={errorProjectsLoading} createProject={createProject} /> 
                <main className="flex-1 flex flex-col p-6 font-sans">
                    <div className='px-4 py-3 mb-6 flex items-center justify-between font-[var(--font-display)]'>
                        <div>
                            <h1 className="text-xl md:text-2xl font-display">
                                {project?.name?.startsWith('New Project ') ? 'New Project' : project ? project?.name : 'New Project'}
                            </h1>
                            {project?.description && (
                                <p className="text-sm text-white/70 mt-1">{project.description}</p>
                            )}
                        </div>
                        {project && (
                            <button
                                onClick={() => setIsSettingModalOpen(true)}
                                disabled={!project}
                                aria-disabled={!project}
                                className={!project ? 'opacity-50 cursor-not-allowed' : ''}
                            >
                                <Cog className="h-6 w-6 text-gray-300 hover:text-white" />
                            </button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                        {messages.map((msg) => (
                            <div key={msg.id} className="glass-subtle card-rounded p-4">
                                <p className="text-xs uppercase tracking-wide text-white/60 mb-3">Original</p>
                                <div className="relative mb-3">
                                    <div className="bg-black/70 border border-white/10 rounded-md p-3 text-sm leading-relaxed text-white/90 whitespace-pre-wrap">
                                        {msg.content}
                                    </div>
                                    <span className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-md bg-gradient-to-b from-amber-400/70 to-amber-500/50" />
                                </div>
                                <div className="relative mt-2">
                                    {/* Editor chrome */}
                                    <div className="bg-black/70 border border-white/10 rounded-md overflow-hidden">
                                        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                                            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80"></span>
                                            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80"></span>
                                            <span className="h-2.5 w-2.5 rounded-full bg-green-500/80"></span>
                                            <span className="ml-2 text-[11px] text-white/60">enhanced_prompt.xml</span>
                                        </div>
                                        {/* Code area */}
                                        <div className="flex">
                                            <div className="select-none text-white/40 bg-black/60 px-3 py-3 text-[12px] leading-relaxed">
                                                {msg.enhancedPrompt.split('\n').map((_, i) => (
                                                    <div key={i} className="text-right w-8">{i + 1}</div>
                                                ))}
                                            </div>
                                            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed p-3 bg-black/85 text-white/90 flex-1 overflow-x-auto">
                                                <span dangerouslySetInnerHTML={{ __html: highlightXml(msg.enhancedPrompt) }} />
                                            </pre>
                                        </div>
                                    </div>
                                    <button
                                        aria-label="Copy enhanced prompt"
                                        className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/15"
                                        onClick={() => handleManualCopy(msg.enhancedPrompt)}
                                    >
                                        <Copy className="h-4 w-4 text-white/80" />
                                    </button>
                                </div>
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {/* Center mic button */}
                    <div className='flex items-end justify-center mt-5'>
                        <InputButton onAudioCapture={handleAudioCapture} />
                    </div>

                    {/* Copy toast */}
                    {showCopiedToast && (
                        <div className='fixed bottom-24 left-1/2 -translate-x-1/2 glass card-rounded px-4 py-2 text-sm'>
                            Enhanced prompt copied to clipboard
                        </div>
                    )}
                </main>
            </div>
            <ProjectSettingsModal
                isOpen={isSettingModalOpen}
                onClose={() => setIsSettingModalOpen(false)}
                onSubmit={handleUpdateProjet}
                project={project}
            />
        </>
    )
}