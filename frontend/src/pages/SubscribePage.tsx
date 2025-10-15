import { useEffect, useState } from "react"
import { useNavigate, Link } from "react-router-dom"

const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:1234'

export default function SubscribePage(){
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState<boolean>(false)
    const navigate = useNavigate()

    useEffect(() => {
        const start = async () => {
            try {
                const token = localStorage.getItem('token')
                if (!token) {
                    navigate('/login')
                    return
                }

                const response = await fetch(`${BASE_URL}/billing/checkout`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({})
                })
                const data = await response.json().catch(() => ({}))
                if (!response.ok || !data.url) {
                    throw new Error(data.error || 'Failed to create checkout session')
                }
                window.location.href = data.url
            } catch (error: unknown) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error'
                setError(errorMessage || 'Failed to start checkout')
            } finally {
                setLoading(false)
            }
        }
        start()
    }, [navigate])

    if (loading && !error) {
        return (
          <main className="min-h-screen flex items-center justify-center p-6">
            <div className="glass card-rounded w-full max-w-md p-6 text-center">
              <h1 className="text-xl font-display mb-2">Preparing checkout…</h1>
              <p className="text-white/70 text-sm">You’ll be redirected to Stripe in a moment.</p>
            </div>
          </main>
        )
    }

    return (
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="glass card-rounded w-full max-w-md p-6 text-center">
            <h1 className="text-xl font-display mb-3">Checkout couldn’t start</h1>
            <p className="text-amber-300 text-sm mb-4">{error}</p>
            <div className="flex items-center justify-center gap-3">
              <button
                className="px-4 py-2 rounded bg-amber-600/80 hover:bg-amber-600 text-white"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
              <Link to="/project/new" className="px-4 py-2 rounded bg-white/10 hover:bg-white/15">
                Back
              </Link>
            </div>
          </div>
        </main>
    )

}