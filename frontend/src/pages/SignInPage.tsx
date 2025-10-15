import {useForm} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod';
import {z} from 'zod';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

const signInSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    password: z.string().min(6, { message: "Password must be at least 6 characters long" }),
})

type SignInFormInputa = z.infer<typeof signInSchema>;




export default function SignInPage() {
    const navigate = useNavigate()
    const [serverError, setServerError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

    const {register, handleSubmit, formState: {errors}} = useForm<SignInFormInputa>({
        resolver: zodResolver(signInSchema)
    })

    const onSubmit = async (data: SignInFormInputa) => {
        setIsSubmitting(true)
        setServerError(null)
        try {
            console.log("Form data submitted:", data)
            const response = await fetch(`${BASE_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })

            const responseData = await response.json()

            if (response.ok){
                localStorage.setItem('token', responseData.token)
                navigate('/')
            } else {
                setServerError(responseData.error || 'Login failed')
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
                    <h1 className="text-2xl font-[var(--font-display)]">Welcome back</h1>
                    <p className="text-white/70 text-sm mt-1">Sign in to continue your session</p>
                </header>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm mb-1 text-white/80">Email</label>
                        <input
                            id="email"
                            type="email"
                            autoComplete="email"
                            placeholder="name@domain.com"
                            className="w-full p-3 rounded bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                            {...register('email')}
                        />
                        {errors.email && <p className='text-amber-300 text-sm mt-1'>{errors.email.message}</p>}
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm mb-1 text-white/80">Password</label>
                        <input
                            id="password"
                            type="password"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            className="w-full p-3 rounded bg-black/20 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
                            {...register('password')}
                        />
                        {errors.password && <p className='text-amber-300 text-sm mt-1'>{errors.password.message}</p>}
                    </div>

                    {serverError && (
                        <div className='text-amber-300 text-sm'>{serverError}</div>
                    )}

                    <button
                        disabled={isSubmitting}
                        type='submit'
                        className="w-full py-2.5 rounded bg-amber-600/80 hover:bg-amber-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Signing in…' : 'Sign in'}
                    </button>
                </form>

                <footer className="mt-5 text-sm text-white/70">
                    Don’t have an account?{' '}
                    <Link to="/register" className="text-amber-300 hover:text-amber-200">Create one</Link>
                </footer>
            </div>
        </main>
    );
}