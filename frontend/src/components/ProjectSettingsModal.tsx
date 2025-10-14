import {useForm} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useEffect } from 'react';


const settingsSchema = z.object({
    name: z.string().max(100, {message: 'Project name should be less than 100 characters'}).optional(),
    description: z.string().max(500, {message: "description shoud be less than 500 words"}).optional(),
    techStack: z.string().max(300,{message: "Tech Stack sjould be less that 300 characters"}).optional()
})

type settingsInputs = z.infer<typeof settingsSchema>

type ProjectModalProps = {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data:settingsInputs) => void
    project: { name: string; description?: string; techStack?: string } | null
}

export default function ProjectSettingsModal({isOpen,onClose,onSubmit,project}: ProjectModalProps) {

    const {register,handleSubmit,reset} = useForm<settingsInputs>({
        resolver: zodResolver(settingsSchema),
        defaultValues: {
            name: project?.name || '',
            description: project?.description || '',
            techStack: project?.techStack || '',
        }
    })

    useEffect(() => {
        if (project){
            reset(project)
        }
    },[project,reset])


    if (!isOpen) return null;

    return (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50'>
            <div className='glass card-rounded p-6 w-full max-w-md'>
                <h2 className='text-2xl font-semibold mb-4'>Project Settings</h2>
                <form onSubmit={handleSubmit(onSubmit)}>
                    <div className='mb-4'>
                        <label htmlFor="name" className='block mb-1'>Name</label>
                        <input type="text" id='name' placeholder={'My Awesome Project'} className='w-full p-2 rounded bg-white/10 border border-white/10 text-white placeholder-white/50' {...register('name')} />
                    </div>
                    <div className='mb-4'>
                        <label htmlFor="description" className='block mb-1'>Description</label>
                        <input type="text" id='description' placeholder={'My personal portfolio project'} className='w-full p-2 rounded bg-white/10 border border-white/10 text-white placeholder-white/50' {...register('description')} />
                    </div>
                    <div className='mb-4'>
                        <label htmlFor="techStack" className='block mb-1'>Tech Stack</label>
                        <input type="text" id='techStack' placeholder="React, Node.js, Tailwind CSS" className='w-full p-2 rounded bg-white/10 border border-white/10 text-white placeholder-white/50' {...register('techStack')} />
                    </div>
                    <div className='flex justify-end gap-3'>
                        <button type="button" onClick={onClose} className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white rounded">Cancel</button>
                        <button type="submit" className="px-3 py-2 bg-amber-600/80 hover:bg-amber-600 text-white rounded">Save Changes</button>
                    </div>
                </form>

            </div>

        </div>
    )
}
