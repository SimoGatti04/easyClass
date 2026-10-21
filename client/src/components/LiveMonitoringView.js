import React, { createElement as h, useState, useEffect, useRef } from "react";

export function LiveMonitoringView({ initialAssessmentId }) {
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assessments, setAssessments] = useState([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState(initialAssessmentId || "");

  const [monitorData, setMonitorData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState(null);

  const pollTimerRef = useRef(null);

  // 1. Load classes
  useEffect(() => {
    fetch("/api/classes")
      .then(res => res.json())
      .then(data => {
        if (data.classes && data.classes.length > 0) {
          setClasses(data.classes);
          setSelectedClassId(data.classes[0].id);
        }
      })
      .catch(err => setError("Errore caricamento classi: " + err.message));
  }, []);

  // 2. Load assessments when class changes
  useEffect(() => {
    if (!selectedClassId) return;
    fetch(`/api/assessments?classId=${encodeURIComponent(selectedClassId)}`)
      .then(res => res.json())
      .then(data => {
        const asms = data.assessments || [];
        setAssessments(asms);
        if (initialAssessmentId && asms.some(a => a.id === initialAssessmentId)) {
          setSelectedAssessmentId(initialAssessmentId);
        } else if (asms.length > 0) {
          setSelectedAssessmentId(asms[0].id);
        } else {
          setSelectedAssessmentId("");
          setMonitorData(null);
        }
      })
      .catch(err => setError("Errore caricamento attività: " + err.message));
  }, [selectedClassId, initialAssessmentId]);

  // 3. Fetch live monitoring data
  const fetchLiveData = (asmId, isBackground = false) => {
    if (!asmId) return;
    if (!isBackground) setLoading(true);
    fetch(`/api/assessments/${encodeURIComponent(asmId)}/live-monitor`)
      .then(res => {
        if (!res.ok) throw new Error("Errore recupero dati monitoraggio (" + res.status + ")");
        return res.json();
      })
      .then(data => {
        setMonitorData(data);
        setLastUpdated(new Date());
        setError("");
        if (!isBackground) setLoading(false);
      })
      .catch(err => {
        setError("Errore monitoraggio: " + err.message);
        if (!isBackground) setLoading(false);
      });
  };

  useEffect(() => {
    if (selectedAssessmentId) {
      fetchLiveData(selectedAssessmentId, false);
    } else {
      setMonitorData(null);
    }
  }, [selectedAssessmentId]);

  // 4. Auto-refresh interval (5s)
  useEffect(() => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    if (autoRefresh && selectedAssessmentId) {
      pollTimerRef.current = setInterval(() => {
        fetchLiveData(selectedAssessmentId, true);
      }, 5000);
    }
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [autoRefresh, selectedAssessmentId]);

  const metrics = monitorData?.metrics || {
    totalStudents: 0,
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
    graded: 0,
    avgAnswered: 0
  };

  const students = monitorData?.students || [];

  // Group students by seatRow for the grid view
  const seatedStudents = students.filter(s => s.seatRow);
  const unseatedStudents = students.filter(s => !s.seatRow);

  const rowMap = new Map();
  // Standard rows 1 to 5 always present in classroom
  const standardRows = ["Fila 1", "Fila 2", "Fila 3", "Fila 4", "Fila 5"];
  standardRows.forEach(r => rowMap.set(r, []));

  seatedStudents.forEach(s => {
    const row = s.seatRow || "Altro";
    if (!rowMap.has(row)) rowMap.set(row, []);
    rowMap.get(row).push(s);
  });

  const getStatusBadge = (status, answeredCount, totalItems) => {
    switch (status) {
      case "not_started":
        return h("span", { className: "badge badge-neutral" }, "⚪ Non iniziato");
      case "in_progress":
        return h("span", { className: "badge badge-warning" }, `✏️ In corso (${answeredCount}/${totalItems})`);
      case "submitted":
        return h("span", { className: "badge badge-success" }, `🏁 Consegnato (${answeredCount}/${totalItems})`);
      case "graded":
        return h("span", { className: "badge badge-info" }, "🏆 Valutato");
      default:
        return h("span", { className: "badge badge-neutral" }, status);
    }
  };

  return h("div", { className: "live-monitoring-view" }, [
    // Top Controls Bar
    h("div", { key: "top-controls", className: "card view-controls-card" }, [
      h("div", { className: "view-controls-grid" }, [
        // Class Selector
        h("div", { className: "form-group" }, [
          h("label", { className: "field-label" }, "Classe"),
          h("select", {
            className: "select-input",
            value: selectedClassId,
            onChange: e => setSelectedClassId(e.target.value)
          }, classes.map(c => h("option", { key: c.id, value: c.id }, `${c.name} (${c.academic_year})`)))
        ]),

        // Assessment Selector
        h("div", { className: "form-group" }, [
          h("label", { className: "field-label" }, "Verifica / Esercitazione"),
          h("select", {
            className: "select-input",
            value: selectedAssessmentId,
            onChange: e => setSelectedAssessmentId(e.target.value),
            disabled: assessments.length === 0
          }, assessments.length === 0
            ? [h("option", { key: "none", value: "" }, "Nessuna attività trovata")]
            : assessments.map(a => h("option", { key: a.id, value: a.id }, `${a.title} (${a.activity_type === "exercise" ? "Esercitazione" : "Verifica"})`))
          )
        ]),

        // Actions & Options
        h("div", { className: "view-actions-group" }, [
          h("div", { className: "mode-switch-buttons" }, [
            h("button", {
              className: `btn btn-sm ${viewMode === "grid" ? "btn-primary" : "btn-secondary"}`,
              onClick: () => setViewMode("grid")
            }, "🪑 Mappa d'Aula"),
            h("button", {
              className: `btn btn-sm ${viewMode === "table" ? "btn-primary" : "btn-secondary"}`,
              onClick: () => setViewMode("table")
            }, "📋 Elenco Roster")
          ]),
          h("div", { className: "refresh-controls" }, [
            h("button", {
              className: "btn btn-sm btn-secondary",
              onClick: () => fetchLiveData(selectedAssessmentId, false),
              disabled: !selectedAssessmentId || loading
            }, loading ? "Aggiornamento..." : "🔄 Aggiorna Ora"),
            h("label", { className: "auto-refresh-label" }, [
              h("input", {
                type: "checkbox",
                checked: autoRefresh,
                onChange: e => setAutoRefresh(e.target.checked)
              }),
              h("span", null, "Auto-refresh (5s)")
            ])
          ])
        ])
      ]),

      lastUpdated && h("div", { className: "last-updated-hint" }, [
        h("span", { className: "pulsing-dot" }),
        `Ultimo aggiornamento: ${lastUpdated.toLocaleTimeString()} — Monitoraggio attivo in tempo reale`
      ])
    ]),

    error && h("div", { key: "error", className: "alert alert-error" }, error),

    // Ethical & Non-invasive Principle Banner
    h("div", { key: "privacy-banner", className: "alert alert-info" }, [
      h("div", { className: "alert-icon" }, "🛡️"),
      h("div", null, [
        h("strong", null, "Monitoraggio d'Aula Non Invasivo ed Etico: "),
        "Questo cruscotto mostra unicamente le risposte salvate dagli studenti e la postazione dichiarata. ",
        "Nessun tracciamento di tasti, telecamere, schede o proctoring invasivo."
      ])
    ]),

    // Metrics Cards Grid
    h("div", { key: "metrics-cards", className: "metrics-cards-grid" }, [
      h("div", { className: "metric-card" }, [
        h("div", { className: "metric-value" }, metrics.totalStudents),
        h("div", { className: "metric-label" }, "👥 Totale Studenti")
      ]),
      h("div", { className: "metric-card" }, [
        h("div", { className: "metric-value text-muted" }, metrics.notStarted),
        h("div", { className: "metric-label" }, "⚪ Non Iniziati")
      ]),
      h("div", { className: "metric-card" }, [
        h("div", { className: "metric-value text-warning" }, metrics.inProgress),
        h("div", { className: "metric-label" }, "✏️ In Corso")
      ]),
      h("div", { className: "metric-card" }, [
        h("div", { className: "metric-value text-success" }, metrics.submitted),
        h("div", { className: "metric-label" }, "🏁 Consegnati")
      ]),
      h("div", { className: "metric-card" }, [
        h("div", { className: "metric-value text-primary" }, metrics.graded),
        h("div", { className: "metric-label" }, "🏆 Valutati")
      ]),
      h("div", { className: "metric-card" }, [
        h("div", { className: "metric-value" }, `${metrics.avgAnswered} / ${monitorData?.assessment?.itemCount || 0}`),
        h("div", { className: "metric-label" }, "📊 Media Risposte")
      ])
    ]),

    // Main Content: Grid View or Table View
    viewMode === "grid" ? (
      h("div", { key: "seatmap-view", className: "classroom-seatmap-container" }, [
        // Blackboard / Teacher podium at front
        h("div", { className: "classroom-blackboard" }, [
          h("div", { className: "blackboard-text" }, "🏫 CATTEDRA / PROIETTORE DOCENTE (Fronte Aula)")
        ]),

        // Classroom rows
        h("div", { className: "classroom-rows-grid" }, Array.from(rowMap.entries()).map(([rowName, rowStudents]) => {
          return h("div", { key: rowName, className: "seatmap-row-card" }, [
            h("div", { className: "seatmap-row-header" }, [
              h("span", { className: "row-name-badge" }, rowName),
              h("span", { className: "row-count-badge" }, `${rowStudents.length} studenti assegnati`)
            ]),
            h("div", { className: "seatmap-desks-grid" }, [
              // Show desks in this row
              rowStudents.length === 0
                ? h("div", { className: "empty-row-hint" }, "Nessuno studente ha dichiarato questa fila.")
                : rowStudents
                    .sort((a, b) => (a.seatDesk || "").localeCompare(b.seatDesk || ""))
                    .map(student => {
                      return h("div", {
                        key: student.studentId,
                        className: `desk-card desk-status-${student.status}`,
                        onClick: () => setSelectedStudentDetail(student)
                      }, [
                        h("div", { className: "desk-header" }, [
                          h("span", { className: "desk-number" }, student.seatDesk || "Banco"),
                          getStatusBadge(student.status, student.answeredCount, student.totalItems)
                        ]),
                        h("div", { className: "desk-student-name" }, student.fullName),
                        h("div", { className: "desk-neighbors-info" }, [
                          h("div", null, [
                            h("span", { className: "neighbor-side" }, "SX: "),
                            h("span", { className: "neighbor-name" }, student.leftNeighborName || "Nessuno")
                          ]),
                          h("div", null, [
                            h("span", { className: "neighbor-side" }, "DX: "),
                            h("span", { className: "neighbor-name" }, student.rightNeighborName || "Nessuno")
                          ])
                        ]),
                        student.lastSavedAt && h("div", { className: "desk-last-saved" }, [
                          `Salvataggio: ${new Date(student.lastSavedAt).toLocaleTimeString()}`
                        ])
                      ]);
                    })
            ])
          ]);
        })),

        // Unseated Students Section
        unseatedStudents.length > 0 && h("div", { className: "unseated-students-section card" }, [
          h("h3", { className: "section-subtitle" }, [
            "⏳ Studenti non ancora posizionati nella Seat Map (",
            unseatedStudents.length,
            ")"
          ]),
          h("div", { className: "unseated-chips-list" }, unseatedStudents.map(s => {
            return h("div", {
              key: s.studentId,
              className: "unseated-student-chip",
              onClick: () => setSelectedStudentDetail(s)
            }, [
              h("span", null, s.fullName),
              getStatusBadge(s.status, s.answeredCount, s.totalItems)
            ]);
          }))
        ])
      ])
    ) : (
      // Table View
      h("div", { key: "table-view", className: "card roster-table-card" }, [
        h("div", { className: "table-responsive" }, [
          h("table", { className: "data-table" }, [
            h("thead", null, [
              h("tr", null, [
                h("th", null, "Studente"),
                h("th", null, "Stato"),
                h("th", null, "Postazione"),
                h("th", null, "Vicino SX"),
                h("th", null, "Vicino DX"),
                h("th", null, "Risposte"),
                h("th", null, "Ultimo Salvataggio"),
                h("th", null, "Azioni")
              ])
            ]),
            h("tbody", null, students.length === 0
              ? [h("tr", { key: "empty" }, [
                  h("td", { colSpan: 8, className: "text-center py-4 text-muted" },
                    "Nessuno studente trovato per questa classe."
                  )
                ])]
              : students.map(student => {
                  return h("tr", { key: student.studentId }, [
                    h("td", { className: "font-semibold" }, student.fullName),
                    h("td", null, getStatusBadge(student.status, student.answeredCount, student.totalItems)),
                    h("td", null, student.seatRow ? `${student.seatRow} - ${student.seatDesk}` : "Non assegnato"),
                    h("td", null, student.leftNeighborName || "—"),
                    h("td", null, student.rightNeighborName || "—"),
                    h("td", null, `${student.answeredCount} / ${student.totalItems}`),
                    h("td", null, student.lastSavedAt ? new Date(student.lastSavedAt).toLocaleTimeString() : "—"),
                    h("td", null, [
                      h("button", {
                        className: "btn btn-xs btn-secondary",
                        onClick: () => setSelectedStudentDetail(student)
                      }, "Dettagli")
                    ])
                  ]);
                })
            )
          ])
        ])
      ])
    ),

    // Student Detail Modal
    selectedStudentDetail && h("div", { className: "modal-overlay", onClick: () => setSelectedStudentDetail(null) }, [
      h("div", { className: "modal-card", onClick: e => e.stopPropagation() }, [
        h("div", { className: "modal-header" }, [
          h("h3", { className: "modal-title" }, `Dettaglio Studente: ${selectedStudentDetail.fullName}`),
          h("button", { className: "modal-close-btn", onClick: () => setSelectedStudentDetail(null) }, "✕")
        ]),
        h("div", { className: "modal-body" }, [
          h("div", { className: "detail-grid" }, [
            h("div", { className: "detail-item" }, [
              h("div", { className: "detail-label" }, "Stato Prova"),
              h("div", null, getStatusBadge(selectedStudentDetail.status, selectedStudentDetail.answeredCount, selectedStudentDetail.totalItems))
            ]),
            h("div", { className: "detail-item" }, [
              h("div", { className: "detail-label" }, "Postazione Seat Map"),
              h("div", { className: "detail-value" }, selectedStudentDetail.seatRow ? `${selectedStudentDetail.seatRow}, ${selectedStudentDetail.seatDesk}` : "Non dichiarata")
            ]),
            h("div", { className: "detail-item" }, [
              h("div", { className: "detail-label" }, "Vicino di Sinistra"),
              h("div", { className: "detail-value" }, selectedStudentDetail.leftNeighborName || "Nessuno")
            ]),
            h("div", { className: "detail-item" }, [
              h("div", { className: "detail-label" }, "Vicino di Destra"),
              h("div", { className: "detail-value" }, selectedStudentDetail.rightNeighborName || "Nessuno")
            ]),
            h("div", { className: "detail-item" }, [
              h("div", { className: "detail-label" }, "Risposte Salvate"),
              h("div", { className: "detail-value" }, `${selectedStudentDetail.answeredCount} su ${selectedStudentDetail.totalItems}`)
            ]),
            h("div", { className: "detail-item" }, [
              h("div", { className: "detail-label" }, "Ultimo Autosave Ricevuto"),
              h("div", { className: "detail-value" }, selectedStudentDetail.lastSavedAt ? new Date(selectedStudentDetail.lastSavedAt).toLocaleString() : "Nessun salvataggio")
            ])
          ]),
          selectedStudentDetail.finalGrade && h("div", { className: "alert alert-success mt-4" }, [
            h("strong", null, "Valutazione Finale Docente: "),
            selectedStudentDetail.finalGrade
          ])
        ]),
        h("div", { className: "modal-footer" }, [
          h("button", { className: "btn btn-secondary", onClick: () => setSelectedStudentDetail(null) }, "Chiudi")
        ])
      ])
    ])
  ]);
}
