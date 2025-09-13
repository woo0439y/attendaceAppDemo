import React from "react";
import { createRoot } from "react-dom/client";
import AttendanceApp from "./AttendanceApp.jsx";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AttendanceApp />
  </React.StrictMode>
);
