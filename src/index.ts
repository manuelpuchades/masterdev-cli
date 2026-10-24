#!/usr/bin/env node
import { main } from "./cli.ts";

// node:sqlite (used by Browser import) still prints an ExperimentalWarning, which would
// pollute stderr for agents. Every other warning goes through.
const emitWarning = process.emitWarning.bind(process);
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === "string" ? warning : warning.message;
  if (text.includes("SQLite")) return;
  return (emitWarning as (...args: unknown[]) => void)(warning, ...rest);
}) as typeof process.emitWarning;

await main(process.argv);
