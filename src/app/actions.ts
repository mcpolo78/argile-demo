"use server";

import { ZodError } from "zod";
import { createProject } from "@/lib/projects";

export type SaveResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveProject(input: unknown): Promise<SaveResult> {
  try {
    return { ok: true, id: await createProject(input) };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: "Paramètres invalides." };
    console.error(e);
    return { ok: false, error: "Enregistrement impossible, réessayez." };
  }
}
