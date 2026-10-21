import React, { createElement as h, useState } from "react";

import { TeacherPreparationView } from "./TeacherPreparationView.js";
import { ActivitiesView } from "./ActivitiesView.js";
import { StudentsView } from "./StudentsView.js";
import { LiveMonitoringView } from "./LiveMonitoringView.js";
import { SubmissionsView } from "./SubmissionsView.js";
import { IntegrityPreviewView } from "./IntegrityPreviewView.js";

export function TeacherArea({ onNavigate }) {
  // Navigation tabs: "prep" | "activities" | "students" | "live" | "submissions" | "integrity"
  const [activeTab, setActiveTab] = useState("prep");
  const [selectedAssessmentId, setSelectedAssessmentId] = useState("");

  const handleSelectLiveMonitor = (assessmentId) => {
    setSelectedAssessmentId(assessmentId);
    setActiveTab("live");
  };

  const navItems = [
    { id: "prep", label: "📖 Preparazione Lezioni (T1)", icon: "📖" },
    { id: "activities", label: "📝 Attività & Verifiche", icon: "📝" },
    { id: "students", label: "👥 Registro Studenti", icon: "👥" },
    { id: "live", label: "🪑 Monitoraggio Live", icon: "🪑" },
    { id: "submissions", label: "📥 Consegne & Valutazioni", icon: "📥" },
    { id: "integrity", label: "🛡️ Integrità & Anticopiatura (C6)", icon: "🛡️" }
  ];

  return h("div", { className: "teacher-portal-layout" }, [
    // Top Teacher Bar
    h("header", { key: "teacher-header", className: "teacher-top-navbar" }, [
      h("div", { className: "navbar-left" }, [
        h("button", {
          className: "btn btn-sm btn-ghost back-to-home-btn",
          onClick: () => onNavigate ? onNavigate("home") : (window.location.hash = "#/")
        }, "← Home Portale"),
        h("div", { className: "portal-branding" }, [
          h("span", { className: "brand-logo" }, "🎓"),
          h("div", null, [
            h("h1", { className: "brand-title" }, "Teacher Service"),
            h("span", { className: "brand-tag" }, "Area Docente")
          ])
        ])
      ]),

      h("div", { className: "navbar-right" }, [
        h("div", { className: "user-badge-container" }, [
          h("span", { className: "user-role-pill" }, "Docente"),
          h("span", { className: "user-email-text" }, "teacher@school.example")
        ])
      ])
    ]),

    // Tab Navigation Bar
    h("nav", { key: "tabs-nav", className: "teacher-tabs-nav" }, [
      h("div", { className: "tabs-scroll-container" }, navItems.map(item => {
        const isActive = activeTab === item.id;
        return h("button", {
          key: item.id,
          className: `teacher-nav-tab ${isActive ? "tab-active" : ""}`,
          onClick: () => setActiveTab(item.id)
        }, [
          h("span", { className: "tab-icon" }, item.icon),
          h("span", { className: "tab-label" }, item.label)
        ]);
      }))
    ]),

    // Active View Container
    h("main", { key: "main-content", className: "teacher-main-workspace" }, [
      activeTab === "prep" && h(TeacherPreparationView, { key: "prep-view" }),
      activeTab === "activities" && h(ActivitiesView, {
        key: "activities-view",
        onSelectLiveMonitor: handleSelectLiveMonitor
      }),
      activeTab === "students" && h(StudentsView, { key: "students-view" }),
      activeTab === "live" && h(LiveMonitoringView, {
        key: "live-view",
        initialAssessmentId: selectedAssessmentId
      }),
      activeTab === "submissions" && h(SubmissionsView, {
        key: "submissions-view",
        initialAssessmentId: selectedAssessmentId
      }),
      activeTab === "integrity" && h(IntegrityPreviewView, {
        key: "integrity-view",
        initialAssessmentId: selectedAssessmentId
      })
    ])
  ]);
}
