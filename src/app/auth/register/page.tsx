"use client";

import { Container, Box, Typography } from "@mui/material";
import { Text } from "@mantine/core";
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
        <RegisterForm />
      </Box>
    </Container>
  );
}
