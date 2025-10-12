import {useForm} from 'react-hook-form'
import {zodResolver} from '@hookform/resolvers/zod'
import {z} from 'zod'


const projectSchema = z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().max(500, 'Project description must be less than 500 characters').optional()
})

export type ProjectFormData = z.infer<typeof projectSchema>

type ModalProps = {
    isOpen: Boolean;
    onClose: () => void;
    onSubmit: (data: ProjectFormData) => void;
}

export default function NewProjectModal({isOpen, onClose, onSubmit}: ModalProps) {
    const {register, handleSubmit, formState: {errors},reset} = useForm<ProjectFormData>({
        resolver: zodResolver(projectSchema)
    })

    const handleFormSubmit = (data: ProjectFormData) => {
        onSubmit(data)
        reset()
    }

    if (!isOpen) return null

    return (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
            <div className='bg-white p-6 rounded-lg shadow-lg w-full max-w-md'>
                <h2 className='text-2xl mb-4'>Create New Project</h2>
                <form onSubmit={handleSubmit(handleFormSubmit)}>
                    <div className='mb-4'>
                        <label htmlFor='name' className='block mb-1'>Project Name</label>
                        <input type="text" id='name' placeholder='My Awesome Project' className='w-full p-2 rounded bg-gray-800 border border-gray-600' {...register('name')} />
                        {errors.name && <p className="text-red-400 mt-1">{errors.name.message}</p>}
                    </div>
                    <div className='mb-6'>
                        <label htmlFor="description" className='block mb-1'>Description (optional)</label>
                        <textarea id="description" placeholder='A brief description of the project' className='w-full p-2 rounded bg-gray-800 border border-gray-600' {...register('description')} />
                        {errors.description && <p className="text-red-400 mt-1">{errors.description.message}</p>}
                    </div>
                    <div className='flex justify-end gap-4'>
                        <button type='button' onClick={onClose} className='px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600'>Cancel</button>
                        <button type='submit' className='px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600'>Create</button>
                    </div>
                </form>

            </div>
        </div>
    )


}