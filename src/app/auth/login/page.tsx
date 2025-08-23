'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Paper,
  InputAdornment,
  IconButton,
  Divider,
  Stack,
} from '@mui/material'
import { Visibility, VisibilityOff, Google, Microsoft } from '@mui/icons-material'

export default function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const res = await signIn('credentials', {
      redirect: false,
      email,
      password,
    })

    if (res?.error) {
      setError(res.error)
    } else {
      router.push('/')
    }
  }

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: (theme) => theme.palette.background.default,
        padding: 3,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          p: 6,
          width: '100%',
          maxWidth: 500,
          backgroundColor: (theme) => theme.palette.background.paper,
          borderRadius: 3,
        }}
      >
        <Typography variant="h4" component="h1" align="center" gutterBottom>
          Log In
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            type="email"
            fullWidth
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            size="medium"
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            size="medium"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={togglePasswordVisibility} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3, mb: 2, py: 1.5 }}
          >
            Log In
          </Button>
        </form>

        <Divider sx={{ my: 3 }}>or</Divider>

        <Stack spacing={2}>
          <Button
            variant="outlined"
            fullWidth
            startIcon={<Google />}
            disabled
            sx={{ textTransform: 'none' }}
          >
            Continue with Google (coming soon)
          </Button>

          <Button
            variant="outlined"
            fullWidth
            startIcon={<Microsoft />}
            disabled
            sx={{ textTransform: 'none' }}
          >
            Continue with Microsoft (coming soon)
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
