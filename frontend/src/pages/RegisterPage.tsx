import {useForm} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {z} from 'zod';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';


const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

const registerSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    name: z.string().min(3, { message: "Name must be at least 3 characters long" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters long" }),
    confirmPassword: z.string().min(6, { message: "Confirm Password must be at least 6 characters long" }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path:['confirmPassword'],
})

type RegisterFormInputs = z.infer<typeof registerSchema>

export default function RegisterPage() {
    const navigate = useNavigate()
    const [serverError, setServerError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

    const {register, handleSubmit, formState: {errors}} = useForm<RegisterFormInputs>({
        resolver: zodResolver(registerSchema)
    })

    const onSubmit = async (data: RegisterFormInputs) => {
        setIsSubmitting(true)
        setServerError(null)
        try {
            const {email, password, name} = data
            console.log("Form data submitted:", data)
            const response = await fetch(`${BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({email, password, name})
            })

            const responseData = await response.json()

            if (response.ok) {
                console.log("Registration successful:", responseData)
                localStorage.setItem('token', responseData.token)
                navigate('/login')
            } else {
                setServerError(responseData.error|| 'Registration failed')
                console.error("Registration failed:", responseData)
            }


        } catch (error) {
            console.error("Error submitting form:", error)
            setServerError('Failed to connect to the server. Please check your connection.');
        } finally {
            setIsSubmitting(false)
        }
    }





    return (
        <main className="min-h-screen flex items-center justify-center p-6">
            <div className="glass card-rounded w-full max-w-md p-6">
                <header className="mb-5">
                    <h1 className="text-2xl font-[var(--font-display)]">Create account</h1>
                    <p className="text-white/70 text-sm mt-1">Join and start capturing voice to prompts</p>
                </header>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label htmlFor="email" className='block text-sm mb-1 text-white/80'>Email</label>
                        <input id='email' type="email" placeholder="name@domain.com" className='w-full p-3 rounded bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70' {...register('email')} />
                        {errors.email && <p className='text-amber-300 text-sm mt-1'>{errors.email.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="name" className='block text-sm mb-1 text-white/80'>Name</label>
                        <input id='name' type="text" placeholder='Your name' className='w-full p-3 rounded bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70' {...register('name')}/>
                        {errors.name && <p className='text-amber-300 text-sm mt-1'>{errors.name.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="password" className='block text-sm mb-1 text-white/80'>Password</label>
                        <input id='password' type="password" placeholder="••••••••" className='w-full p-3 rounded bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70' {...register('password')} />
                        {errors.password && <p className='text-amber-300 text-sm mt-1'>{errors.password.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className='block text-sm mb-1 text-white/80'>Confirm password</label>
                        <input id='confirmPassword' type="password" placeholder="••••••••" className='w-full p-3 rounded bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70' {...register('confirmPassword')} />
                        {errors.confirmPassword && <p className='text-amber-300 text-sm mt-1'>{errors.confirmPassword.message}</p>}
                    </div>

                    {serverError && <div className='text-amber-300 text-sm'>{serverError}</div>}

                    <button disabled={isSubmitting} type="submit" className='w-full py-2.5 rounded bg-amber-600/80 hover:bg-amber-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed'>{isSubmitting ? 'Registering…': 'Register'}</button>
                </form>

                <footer className='mt-5 text-sm text-white/70'>
                    Already have an account?{' '}
                    <Link to="/login" className='text-amber-300 hover:text-amber-200'>Sign in</Link>
                </footer>
            </div>
        </main>
    );
}