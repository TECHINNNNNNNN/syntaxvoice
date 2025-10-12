import {useForm} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {z} from 'zod';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';


const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

const registerSchema = z.object({
    email: z.string().email({ message: "Invalid email address" }),
    username: z.string().min(3, { message: "Username must be at least 3 characters long" }),
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
            const {email, password, username} = data
            console.log("Form data submitted:", data)
            const response = await fetch(`${BASE_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify({email, password, username})
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
        <div>
            <h1>Register Page</h1>
            <form onSubmit={handleSubmit(onSubmit)}>
                <div>
                    <input type="text" placeholder="email" {...register('email')} />
                    {errors.email && <p className='text-red-400'>{errors.email.message}</p>}
                </div>
                <div>
                    <input type="text" placeholder='username' {...register('username')}/>
                    {errors.username && <p className='text-red-400'>{errors.username.message}</p>}
                </div>
                <div>
                    <input type="password" placeholder="password" {...register('password')} />
                    {errors.password && <p className='text-red-400'>{errors.password.message}</p>}
                </div>
                <div>
                    <input type="password" placeholder="confirm password" {...register('confirmPassword')} />
                    {errors.confirmPassword && <p className='text-red-400'>{errors.confirmPassword.message}</p>}
                </div>
                <div>
                    <button disabled={isSubmitting} type="submit">{isSubmitting ? 'Registering...': 'Register'}</button>
                </div>
            </form>
            {serverError && <p className='text-red-400'>{serverError}</p>}
        </div>
    );
}