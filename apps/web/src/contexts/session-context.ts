"use client";
import { createContext } from "react";

export const SessionExpiredContext = createContext<(() => void) | null>(null);
