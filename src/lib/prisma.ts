import { PrismaClient } from "@prisma/client";

export const dbClient: PrismaClient = new PrismaClient();
