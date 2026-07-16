import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SessionProvider } from "@/session/SessionContext";
import { App } from "@/App";
import "@/styles/global.css";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

createRoot(root).render(
  <StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </StrictMode>,
);
