'use client'

import { ThemeProvider, CssBaseline } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { getTheme } from './theme'

export function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light')

  // Persist theme in localStorage
  useEffect(() => {
    const stored = localStorage.getItem('theme') as 'light' | 'dark'
    if (stored) setMode(stored)
  }, [])

  const toggleTheme = () => {
    const next = mode === 'light' ? 'dark' : 'light'
    setMode(next)
    localStorage.setItem('theme', next)
  }

  const theme = useMemo(() => getTheme(mode), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <button onClick={toggleTheme}>
          {mode === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </div>
      {children}
    </ThemeProvider>
  )
}
