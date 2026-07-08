import { PrismaClient } from "@prisma/client";

// Instance unique partagée dans toute l'app
export const prisma = new PrismaClient();
