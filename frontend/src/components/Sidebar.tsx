import { } from 'react'
import {type Project} from '../Hooks/useProjects'
import { Link, useNavigate } from 'react-router-dom';


type SidebarProps = {
    projects: Project[];
    loading: boolean;
    error: string | null;
    createProject: (project: {name: string}) => void;
}


export default function Sidebar({projects, loading, error}: SidebarProps) {

    const navigate = useNavigate()


    const handleLogout = () => {
        localStorage.removeItem('token')
        navigate('/login')
    }

    const handleProjectCreaetion = () => {
        navigate('/project/new')
    }


    return (
        <>
            {/* Sidebar is now always visible; hover rail removed */}

            {/* Main Sidebar */}
            <aside
                className={`max-w-sm w-72 h-screen max-h-screen sticky top-0 text-white flex flex-col rounded-r-lg glass-heavy`}
            >
                <div className="p-4 glass-divider">
                <h2 className="text-xl font-serif mb-2 mt-5">Projects</h2>
                <button
                    onClick={() => handleProjectCreaetion()}
                    className="mt-4 w-full bg-white/30 font-sans text-white py-2 px-3 rounded-2xl backdrop-blur-3xl"
                >
                    + New Project
                </button>
                </div>

                {/* Project List */}
                <nav className="flex-1 p-4 overflow-y-auto">
                {loading && <p>Loading projects...</p>}
                {error && <p className="text-amber-300">{error}</p>}
                <ul>
                    {projects.map((project) => (
                        <Link to={`/project/${project.id}`}>
                            <li key={project.id} className="p-2 text-sm rounded cursor-pointer mb-2 font-sans text-white/90">
                                {project.name}
                            </li>
                        </Link>
                    ))}
                </ul>
                </nav>

                <div className='mt-auto p-4'>
                    <button onClick={handleLogout} className="w-full bg-red-600/35 hover:bg-red-600/50 bg-opacity-75 backdrop-blur-3xl  text-white py-2 px-3 rounded-3xl">
                        Sign out
                    </button>
                </div>
            </aside>
        </>
    )
}