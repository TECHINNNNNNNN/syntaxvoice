import {Navigate, Outlet} from 'react-router-dom'

function isTokenExpired(token: string): boolean {
    try {
        const payloadBase64 = token.split('.')[1]
        if (!payloadBase64) return true
        const payloadJson = JSON.parse(atob(payloadBase64)) as { exp?: number }
        if (!payloadJson.exp) return false
        const nowInSeconds = Math.floor(Date.now() / 1000)
        return payloadJson.exp < nowInSeconds
    } catch {
        return true
    }
}

export default function ProtectedRoute() {
    const token = localStorage.getItem('token')
    if (!token || isTokenExpired(token)) {
        localStorage.removeItem('token')
        return <Navigate to="/login" />
    }
    return <Outlet />
}