import {useForm} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod';
import {z} from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
        <div>
            <form onSubmit={handleSubmit(onSubmit)}>
                <h1>Sign In Page</h1>
                <div>
                    <input type="text" placeholder="email" {...register('email')}/>
                    {errors.email && <p className='text-red-400'>{errors.email.message}</p>}
                </div>
                <div>
                    <input type="password" placeholder="password" {...register('password')} />
                    {errors.password && <p className='text-red-400'>{errors.password.message}</p>}
                </div>
                <button disabled={isSubmitting} type='submit'>{isSubmitting ? 'Signing in': 'Sign in'}</button>
                {serverError && <p className='text-red-400'>{serverError}</p>}
            </form>
            
        </div>
    );
}