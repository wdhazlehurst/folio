"use client";

import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Alert,
  Paper,
  Typography,
  Stack,
  Divider,
} from "@mui/material";
import { Google, Microsoft } from "@mui/icons-material";
import { registerUser } from "./actions";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await registerUser(email, password);

      if (result.error) {
        setError(result.error);
      } else if (result.success) {
        setSuccess(result.success);
        setEmail("");
        setPassword("");
      }
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  };

  return (
    <Box
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight="65vh"
      sx={{ backgroundColor: "background.default" }}
    >
      <Paper
        elevation={4}
        sx={{
          p: 4,
          width: "100%",
          maxWidth: 400,
          borderRadius: 3,
        }}
      >
        <Box component="form" onSubmit={handleSubmit}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <TextField
            margin="normal"
            required
            fullWidth
            label="Email Address"
            name="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            variant="standard"
          />
          <TextField
            margin="normal"
            required
            fullWidth
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            variant="standard"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            sx={{ mt: 3, borderRadius: 2 }}
            disabled={loading}
          >
            {loading ? "Registering..." : "Register"}
          </Button>

          <Divider sx={{ my: 3 }}>or</Divider>

          <Stack spacing={2}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<Google />}
              disabled
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              Continue with Google (coming soon)
            </Button>

            <Button
              variant="outlined"
              fullWidth
              startIcon={<Microsoft />}
              disabled
              sx={{ textTransform: "none", borderRadius: 2 }}
            >
              Continue with Microsoft (coming soon)
            </Button>
          </Stack>
        </Box>
      </Paper>
    </Box>
  );
}
