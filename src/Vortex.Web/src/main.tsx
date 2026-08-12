import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { completeSignIn, completeSilentSignIn } from "./auth";
import { App } from "./App";
import "./index.css";

async function bootstrap(): Promise<void> {
  if (window.location.pathname === "/auth/callback") {
    await completeSignIn();
    window.location.replace("/");
    return;
  }

  if (window.location.pathname === "/auth/silent") {
    await completeSilentSignIn();
    return;
  }

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

void bootstrap();

