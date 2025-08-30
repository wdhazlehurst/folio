"use client";

import { Container, Box, Typography } from "@mui/material";
import RegisterForm from "./RegisterForm";

export default function RegisterPage() {
  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Typography component="h1" variant="h5" fontWeight="bold">
          Create an Account
        </Typography>
        <RegisterForm />
      </Box>
    </Container>
  );
}
