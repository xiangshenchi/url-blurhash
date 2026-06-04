import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import logo from "./logo.png";
import "./styles.css";

const faviconId = "app-favicon";
const existingFavicon = document.getElementById(faviconId) as HTMLLinkElement | null;
const favicon = existingFavicon ?? document.createElement("link");
favicon.id = faviconId;
favicon.rel = "icon";
favicon.type = "image/png";
favicon.href = logo;
if (!existingFavicon) {
  document.head.appendChild(favicon);
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
