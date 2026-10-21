#!/usr/bin/env node
/**
 * Teacher Service — Isolated Preview Cleanup Tool
 * Safely removes .tmp/dev-preview/ directory.
 */
import fs from "node:fs";
import path from "node:path";

const PREVIEW_ROOT = path.resolve(process.cwd(), ".tmp", "dev-preview");

if (fs.existsSync(PREVIEW_ROOT)) {
  fs.rmSync(PREVIEW_ROOT, { recursive: true, force: true });
  console.log("✅ Directory di anteprima locale ripulita con successo: " + PREVIEW_ROOT);
} else {
  console.log("ℹ️  Nessun dato di anteprima da ripulire (.tmp/dev-preview non esiste).");
}
