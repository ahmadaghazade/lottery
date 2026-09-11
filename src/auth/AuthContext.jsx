import { createContext, useCallback, useContext, useMemo, useState } from 'react'

const TOKEN_KEY = 'raffle_admin_token'
const EMAIL_KEY = 'raffle_admin_email'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [email, setEmail] = useState(() => localStorage.getItem(EMAIL_KEY))

  const login = useCallback((nextToken, nextEmail) => {
    localStorage.setItem(TOKEN_KEY, nextToken)
    localStorage.setItem(EMAIL_KEY, nextEmail)
    setToken(nextToken)
    setEmail(nextEmail)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    setToken(null)
    setEmail(null)
  }, [])

  const value = useMemo(
    () => ({ token, email, login, logout, isAuthenticated: Boolean(token) }),
    [token, email, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
