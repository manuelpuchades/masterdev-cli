import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function xdg(envVar: string, fallback: string): string {
  return process.env[envVar] || join(homedir(), fallback);
}

export const CONFIG_DIR = process.env.MASTERDEV_CONFIG_DIR || join(xdg("XDG_CONFIG_HOME", ".config"), "masterdev");
export const CACHE_DIR = process.env.MASTERDEV_CACHE_DIR || join(xdg("XDG_CACHE_HOME", ".cache"), "masterdev");
export const DATA_DIR = process.env.MASTERDEV_DATA_DIR || join(xdg("XDG_DATA_HOME", ".local/share"), "masterdev");

export const VERSION: string = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

export const SITE = "https://master.dev";
export const API = "https://api.master.dev/v2/kabuki";
export const USER_AGENT = `masterdev-cli/${VERSION}`;
