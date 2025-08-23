'use client'

import { ThemeProvider, CssBaseline, IconButton, Box, Tooltip } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { getTheme } from './theme'
import { Brightness4, Brightness7 } from '@mui/icons-material'

export function Providers({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light')

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
      <Box
        sx={{
          position: 'fixed',
          top: 16,
          right: 16,
          zIndex: 1300, // Make sure it stays above paper components
        }}
      >
        <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
          <IconButton onClick={toggleTheme} color="inherit">
            {mode === 'light' ? <Brightness4 /> : <Brightness7 />}
          </IconButton>
        </Tooltip>
      </Box>
      {children}
    </ThemeProvider>
  )
}
