import './App.css'
import {Routes, Route, Navigate} from 'react-router-dom'
import SignInPage from './pages/SignInPage'
import RegisterPage from './pages/RegisterPage'
import ProtectedRoute from './components/ProtectedRoute'
import ChatPage from './pages/ChatPage'
import SubscribePage from './pages/SubscribePage'


function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<SignInPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path='/' element={<Navigate to='/project/new' replace/>} />
          <Route path='/project/:projectId' element={<ChatPage />} />
          <Route path='/billing/subscribe' element={<SubscribePage />} />
        </Route>
        <Route path="*" element={<div>404 Not Found</div>}>
        </Route>
      </Routes>
    </>
  )
}

export default App
