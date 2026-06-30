import { useState, useEffect } from 'react'
import { authApi } from '../services/api'

export interface User {
  id: number
  username: string
  email: string | null
  avatar_url: string | null
  github_id: number
  app_installed: boolean
  installation_id: number | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setLoading(false); return }
    authApi.getMe()
      .then((res) => setUser(res.data))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false))
  }, [])

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    window.location.href = '/login'
  }

  return { user, loading, logout }
}
