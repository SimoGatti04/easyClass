/**
 * Teacher Service — Root Application & Router (C3 UI/UX Foundation)
 * Complete React + ESM Client Router.
 * Supports public Homepage, zero-credential Student Area, and multi-tab Teacher Dashboard.
 */
import React, { createElement as h, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { Homepage } from "./src/components/Homepage.js";
import { StudentArea } from "./src/components/StudentArea.js";
import { TeacherArea } from "./src/components/TeacherArea.js";

export function App() {
  const getRouteFromHash = () => {
    const hash = window.location.hash || "#/";
    if (hash.startsWith("#/studente")) return "student";
    if (hash.startsWith("#/docente")) return "teacher";
    return "home";
  };

  const [route, setRoute] = useState(getRouteFromHash);

  useEffect(() => {
    const handleHashChange = () => {
      setRoute(getRouteFromHash());
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = (target) => {
    if (target.startsWith("#/")) {
      window.location.hash = target;
    } else if (target === "student") {
      window.location.hash = "#/studente";
    } else if (target === "teacher") {
      window.location.hash = "#/docente";
    } else {
      window.location.hash = "#/";
    }
  };

  return h("div", { className: "teacher-service-root" }, [
    route === "home" && h(Homepage, { key: "home", onNavigate: navigate }),
    route === "student" && h(StudentArea, { key: "student", onNavigate: navigate }),
    route === "teacher" && h(TeacherArea, { key: "teacher", onNavigate: navigate })
  ]);
}

// Mount React Root
if (typeof document !== "undefined") {
  const rootElement = document.getElementById("app");
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(h(App));
  }
}
