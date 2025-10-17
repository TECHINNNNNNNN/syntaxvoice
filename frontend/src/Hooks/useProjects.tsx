import {useState, useEffect} from 'react'




const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

export type Project = {
    id: number;
    name: string;
    description: string | undefined;
}

export function useProjects() {
    const [projects, setProjects] = useState<Project[]>([])
    const [loading, setLoading] = useState<boolean>(true)
    const [error, setError] = useState<string | null>(null)


    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const response = await fetch(`${BASE_URL}/projects`, {
                    method: 'GET',
                    headers: {
                        "Authorization": `Bearer ${localStorage.getItem('token')}`
                    }
                })

                if (response.status === 401) {
                    localStorage.removeItem('token')
                    window.location.href = '/login'
                    return
                }
                if (response.ok) {
                    const data = await response.json()
                    setProjects(data.projects)
                } else {
                    setError('Failed to fetch projects')
                }
                setLoading(false)
            } catch {
                setError('An error occurred while fetching projects')
                setLoading(false)
            } finally {
                setLoading(false)
            }
        }
        fetchProjects()
    },[])

    const createProject = async (newProjectData: {name: string, description?: string} ) => {
        try {
            const response = await fetch(`${BASE_URL}/project`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    "Authorization": `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(newProjectData)
            })

            if (response.status === 401) {
                localStorage.removeItem('token')
                window.location.href = '/login'
                return
            }
            const responseData = await response.json()

            if (!response.ok) {
                throw new Error('Failed to create project')
            }

            const created = responseData.project
            
            setProjects(current => [{ id: created.id, name: created.name, description: created.description }, ...current])
            return created
        } catch (error) {
            console.error('Error creating project:', error)
            setError('An error occurred while creating the project')
        }
    }

    const updateProject = async (updatedProject: { projectId: number, name: string, description?: string,techStack?:string}) => {
        try {
            const response = await fetch(`${BASE_URL}/project/${updatedProject.projectId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    name: updatedProject.name,
                    description: updatedProject.description,
                    techStack: updatedProject.techStack
                })
            })
            if (response.status === 401) {
                localStorage.removeItem('token')
                window.location.href = '/login'
                return
            }
            if (!response.ok) {
                throw new Error('Failed to update project')
            }
            // Use correct property names and ensure type matches Project
            setProjects(currentProjects => {
                const projectExists = currentProjects.some(p => p.id === updatedProject.projectId)

                if (projectExists) {
                    return currentProjects.map(p =>
                        p.id === updatedProject.projectId
                            ? { ...p, name: updatedProject.name, description: updatedProject.description }
                            : p
                    )

                } else {
                    return [
                        {
                            id: updatedProject.projectId,
                            name: updatedProject.name,
                            description: updatedProject.description
                        },
                        ...currentProjects
                    ]
                }
            }
            )
        } catch (error) {
            setError('An error occurred while updating the project')
            console.error('Error updating project:', error)
        }
    }

    const updateProjectDetails = async (updatedData: { projectId: number, name?: string, description?: string,techStack?:string}) => {
        console.log(`projectId: ${updatedData.projectId} ${typeof updatedData.projectId}, name: ${updatedData.name}, description: ${updatedData.description}, techStack: ${updatedData.techStack}`)
        try {
            const response = await fetch(`${BASE_URL}/enhance-project-context`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    projectId: updatedData.projectId,
                    name: updatedData.name,
                    description: updatedData.description,
                    techStack: updatedData.techStack
                })

            })

            if (response.status === 401) {
                localStorage.removeItem('token')
                window.location.href = '/login'
                return
            }
            if (!response.ok) {
                setError('Failed to update project details')
            }



            const responseData = await response.json()


            
            setProjects(currentProjects => currentProjects.map(p => 
                p.id === updatedData.projectId ? {...p, ...responseData.project} : p
            ))

            return responseData.project
        } catch (error) {
            setError('An error occurred while updating the project details')
            console.error('Error updating project:', error)

        }
    }


    return {projects, loading, error, createProject, updateProject, updateProjectDetails}

}