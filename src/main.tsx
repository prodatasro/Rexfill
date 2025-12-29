import React from "react";
import ReactDOM from "react-dom/client";
import { initSatellite } from "@junobuild/core";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Initialize Juno Satellite
initSatellite();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
