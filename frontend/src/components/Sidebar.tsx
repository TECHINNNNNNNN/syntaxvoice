import {useState} from 'react'
import {type Project} from '../Hooks/useProjects'
import { Link, useNavigate } from 'react-router-dom';


type SidebarProps = {
    projects: Project[];
    loading: boolean;
    error: string | null;
    createProject: (project: {name: string}) => void;
}


export default function SignInPage({projects, loading, error}: SidebarProps) {
    const [isOpen, setIsOpen] = useState(false)

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
            {!isOpen && (
            <div
            className="fixed top-0 left-0 h-full w-4 bg-transparent z-20"
            onMouseEnter={() => setIsOpen(true)}
            />
            )}

            {/* Main Sidebar */}
            <aside
                className={`fixed top-0 left-0 h-full bg-gray-800 text-white flex flex-col transition-all duration-300 ease-in-out z-30 ${
                isOpen ? 'w-64' : 'w-0 overflow-hidden'
                }`}
                onMouseLeave={() => setIsOpen(false)}
            >
                <div className="p-4">
                <h2 className="text-xl font-bold">Projects</h2>
                <button
                    onClick={() => handleProjectCreaetion()}
                    className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                >
                    + New Project
                </button>
                </div>

                {/* Project List */}
                <nav className="flex-1 p-4 overflow-y-auto">
                {loading && <p>Loading projects...</p>}
                {error && <p className="text-red-400">{error}</p>}
                <ul>
                    {projects.map((project) => (
                        <Link to={`/project/${project.id}`}>
                            <li key={project.id} className="p-2 hover:bg-gray-700 rounded cursor-pointer">
                                {project.name}
                            </li>
                        </Link>
                    ))}
                </ul>
                </nav>

                <div className='mt-auto p-4'>
                    <button onClick={handleLogout} className="w-full bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded">
                        Logout
                    </button>
                </div>
            </aside>
        </>
    )
}