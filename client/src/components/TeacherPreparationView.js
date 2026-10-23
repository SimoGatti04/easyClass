/**
 * Teacher Service — T1 "Tomorrow is ready" Web Application
 * Full React + ESM Architecture.
 * ZERO innerHTML, complete XSS protection, verifiable step-by-step Lesson Pack generation,
 * immutable versioning, selective step retry, and version-bound preparation confirmation.
 */
import React, { createElement as h, useState, useEffect, useCallback, useRef } from 'react';


import { Header } from './Header.js';
import { ContextBar } from './ContextBar.js';
import { LessonHeader } from './LessonHeader.js';
import { SourceManager } from './SourceManager.js';
import { StepProgressCard } from './StepProgressCard.js';
import { ArtifactWorkspace } from './ArtifactWorkspace.js';
import {
  NewClassModal,
  NewSubjectModal,
  NewLessonModal,
  UploadModal,
  RevisionModal,
  ConfirmPrepModal,
  ExportModal
} from './Modals.js';

export function TeacherPreparationView() {
  const [user, setUser] = useState(null);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [lessons, setLessons] = useState([]);

  const [selectedClassId, setSelectedClassId] = useState(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);

  const [lessonPack, setLessonPack] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState([]);
  const [sourceSelectionMode, setSourceSelectionMode] = useState('selected_only');
  const [activeTab, setActiveTab] = useState('lessonPlan');

  const [durationMinutes, setDurationMinutes] = useState(60);
  const [additionalPrompt, setAdditionalPrompt] = useState('');

  // Step states: 'idle' | 'running' | 'completed' | 'failed'
  const [stepStates, setStepStates] = useState({
    lessonPlan: 'idle',
    teacherScript: 'idle',
    exercises: 'idle',
    studentMaterial: 'idle'
  });
  const [isGenerating, setIsGenerating] = useState(false);

  // Modals state
  const [activeModal, setActiveModal] = useState(null); // 'newClass' | 'newSubject' | 'newLesson' | 'upload' | 'revision' | 'confirm' | 'export'
  const [modalArtifact, setModalArtifact] = useState(null);

  // Notice toast
  const [notice, setNotice] = useState(null);
  const noticeTimerRef = useRef(null);

  const showNotice = useCallback((type, message) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ type, message });
    noticeTimerRef.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  // 1. Initial Authentication & Class Discovery
  useEffect(() => {
    async function loadInitial() {
      try {
        const authRes = await fetch('/api/auth/me');
        if (authRes.ok) {
          const authData = await authRes.json();
          setUser(authData);
        } else {
          setUser({ authenticated: false, teacherAuthorized: false });
        }
      } catch (err) {
        setUser({ authenticated: false, teacherAuthorized: false, error: err.message });
      }

      try {
        const clsRes = await fetch('/api/classes');
        if (clsRes.ok) {
          const clsData = await clsRes.json();
          const clsList = clsData.classes || [];
          setClasses(clsList);
          if (clsList.length > 0) {
            setSelectedClassId(clsList[0].id);
          }
        }
      } catch (err) {
        showNotice('error', `Errore caricamento classi: ${err.message}`);
      }
    }
    loadInitial();
  }, [showNotice]);

  // 2. Load Subjects when selectedClassId changes
  useEffect(() => {
    if (!selectedClassId) {
      setSubjects([]);
      setSelectedSubjectId(null);
      return;
    }
    async function fetchSubjects() {
      try {
        const res = await fetch(`/api/subjects?classId=${encodeURIComponent(selectedClassId)}`);
        if (res.ok) {
          const data = await res.json();
          const list = data.subjects || [];
          setSubjects(list);
          if (list.length > 0) {
            setSelectedSubjectId(list[0].id);
          } else {
            setSelectedSubjectId(null);
          }
        }
      } catch (err) {
        showNotice('error', `Errore materie: ${err.message}`);
      }
    }
    fetchSubjects();
  }, [selectedClassId, showNotice]);

  // 3. Load Lessons when selectedSubjectId changes
  useEffect(() => {
    if (!selectedClassId || !selectedSubjectId) {
      setLessons([]);
      setSelectedLessonId(null);
      return;
    }
    async function fetchLessons() {
      try {
        const res = await fetch(`/api/lessons?classId=${encodeURIComponent(selectedClassId)}&subjectId=${encodeURIComponent(selectedSubjectId)}`);
        if (res.ok) {
          const data = await res.json();
          const list = data.lessons || [];
          setLessons(list);
          if (list.length > 0) {
            setSelectedLessonId(list[0].id);
          } else {
            setSelectedLessonId(null);
          }
        }
      } catch (err) {
        showNotice('error', `Errore lezioni: ${err.message}`);
      }
    }
    fetchLessons();
  }, [selectedClassId, selectedSubjectId, showNotice]);

  // 4. Load Lesson Pack & Materials when selectedLessonId changes
  const reloadPack = useCallback(async (lessonId) => {
    if (!lessonId) {
      setLessonPack(null);
      return;
    }
    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/pack`);
      if (res.ok) {
        const data = await res.json();
        setLessonPack(data.pack);
        if (data.pack?.lesson?.duration_minutes) {
          setDurationMinutes(data.pack.lesson.duration_minutes);
        }
      }
    } catch (err) {
      showNotice('error', `Errore caricamento pack: ${err.message}`);
    }
  }, [showNotice]);

  const reloadMaterials = useCallback(async (classId, subjectId, lessonId) => {
    if (!classId) return;
    try {
      let url = `/api/materials?classId=${encodeURIComponent(classId)}`;
      if (subjectId) url += `&subjectId=${encodeURIComponent(subjectId)}`;
      if (lessonId) url += `&lessonId=${encodeURIComponent(lessonId)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const allMats = data.materials || [];
        // Requirement 2: Do NOT include generated lesson pack artifacts in candidate sources
        const packTypes = ['lesson_plan', 'teacher_script', 'exercise_sheet', 'student_material'];
        const candidateSources = allMats.filter(m => !(packTypes.includes(m.resource_type) && m.lesson_id === lessonId));
        setMaterials(candidateSources);
        // Requirement 2: No indiscriminate preselection of artifacts! Initialize empty
        setSelectedSourceIds([]);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (selectedLessonId) {
      reloadPack(selectedLessonId);
      reloadMaterials(selectedClassId, selectedSubjectId, selectedLessonId);
    } else {
      setLessonPack(null);
      setMaterials([]);
      setSelectedSourceIds([]);
    }
  }, [selectedLessonId, selectedClassId, selectedSubjectId, reloadPack, reloadMaterials]);

  // Context Actions
  const handleCreateClass = async (form) => { 
    const res = await fetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore creazione classe');
    }
    const data = await res.json();
    setClasses(prev => [...prev, data.class]);
    setSelectedClassId(data.class.id);
    showNotice('success', `Classe "${data.class.name}" creata con successo`);
  };

  const handleCreateSubject = async (form) => { 
    const res = await fetch('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore creazione materia');
    }
    const data = await res.json();
    setSubjects(prev => [...prev, data.subject]);
    setSelectedSubjectId(data.subject.id);
    showNotice('success', `Materia "${data.subject.name}" creata con successo`);
  };

  const handleCreateLesson = async (form) => {
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore creazione lezione');
    }
    const data = await res.json();
    setLessons(prev => [...prev, data.lesson]);
    setSelectedLessonId(data.lesson.id);
    setDurationMinutes(data.lesson.duration_minutes || 60);
    showNotice('success', `Lezione "${data.lesson.title}" programmata`);
  };

  // Duration change
  const handleChangeDuration = async (minutes) => {
    setDurationMinutes(minutes);
    if (!selectedLessonId) return;
    try {
      await fetch(`/api/lessons/${encodeURIComponent(selectedLessonId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes: minutes })
      });
      reloadPack(selectedLessonId);
    } catch {}
  };

  // Source selections
  const handleToggleSource = (id) => {
    setSelectedSourceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleSelectAllSources = () => {
    setSelectedSourceIds(materials.map(m => m.id));
  };

  const handleClearSources = () => {
    setSelectedSourceIds([]);
  };

  // Real multipart upload
  const handleUploadFile = async (file, title, pedagogicalRole) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('classId', selectedClassId || '');
    formData.append('subjectId', selectedSubjectId || '');
    formData.append('lessonId', selectedLessonId || '');
    formData.append('pedagogicalRole', pedagogicalRole);

    const res = await fetch('/api/materials/upload', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore durante il caricamento del file');
    }

    const data = await res.json();
    showNotice('success', `File "${data.material.title}" caricato con successo (SHA-256 verificato)`);
    await reloadMaterials(selectedClassId, selectedSubjectId, selectedLessonId);
    setSelectedSourceIds(prev => [...prev, data.material.id]);
  };

  // Sequential Step-by-Step AI Generation
  const handleStartFullGeneration = async () => {
    if (!selectedLessonId || isGenerating) return;
    setIsGenerating(true);

    const steps = ['lessonPlan', 'teacherScript', 'exercises', 'studentMaterial'];
    const currentStepStates = { ...stepStates };

    for (const stepKey of steps) {
      currentStepStates[stepKey] = 'running';
      setStepStates({ ...currentStepStates });

      try {
        const res = await fetch(`/api/lessons/${encodeURIComponent(selectedLessonId)}/generate-pack`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetArtifacts: [stepKey],
            additionalInstructions: additionalPrompt,
            selectedSourceIds,
            durationMinutes
          })
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.message || `Fallito step ${stepKey}`);
        }

        const data = await res.json();
        setLessonPack(data.pack);
        currentStepStates[stepKey] = 'completed';
        setStepStates({ ...currentStepStates });
      } catch (err) {
        currentStepStates[stepKey] = 'failed';
        setStepStates({ ...currentStepStates });
        showNotice('error', `Errore generazione ${stepKey}: ${err.message}. Gli step precedenti sono stati salvati.`);
        setIsGenerating(false);
        return; // Halt sequential pipeline on partial failure, allow selective retry
      }
    }

    setIsGenerating(false);
    showNotice('success', 'Lesson Pack completato e salvato su SQLite e FileStore!');
    await reloadPack(selectedLessonId);
  };

  // Selective Retry for a single step
  const handleRetryStep = async (stepKey) => {
    if (!selectedLessonId || isGenerating) return;
    setIsGenerating(true);

    setStepStates(prev => ({ ...prev, [stepKey]: 'running' }));

    try {
      const res = await fetch(`/api/lessons/${encodeURIComponent(selectedLessonId)}/generate-pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetArtifacts: [stepKey],
          additionalInstructions: additionalPrompt,
          selectedSourceIds,
          durationMinutes
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || `Errore rigenerazione ${stepKey}`);
      }

      const data = await res.json();
      setLessonPack(data.pack);
      setStepStates(prev => ({ ...prev, [stepKey]: 'completed' }));
      showNotice('success', `Artefatto ${stepKey} rigenerato con successo`);
    } catch (err) {
      setStepStates(prev => ({ ...prev, [stepKey]: 'failed' }));
      showNotice('error', `Errore rigenerazione ${stepKey}: ${err.message}`);
    } finally {
      setIsGenerating(false);
      await reloadPack(selectedLessonId);
    }
  };

  // Manual In-Place Edit (Creates immutable version)
  const handleSaveEdit = async (materialId, title, contentText) => {
    const res = await fetch(`/api/materials/${encodeURIComponent(materialId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        contentText,
        changeSummary: 'Modifica manuale del docente'
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore salvataggio modifica');
    }

    const data = await res.json();
    showNotice('success', `Nuova versione v${data.material.current_version} salvata con successo`);
    await reloadPack(selectedLessonId);
  };

  // Iterative Revision
  const handleSubmitRevision = async (materialId, instruction) => {
    const res = await fetch(`/api/materials/${encodeURIComponent(materialId)}/revise`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        searchWeb: false
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore durante la revisione');
    }

    const data = await res.json();
    showNotice('success', `Revisione applicata: creata nuova versione v${data.result.material.current_version}`);
    await reloadPack(selectedLessonId);
  };

  // Section Regeneration
  const handleSubmitRegenerateSection = async (materialId, sectionTitle, instructions) => {
    const res = await fetch(`/api/materials/${encodeURIComponent(materialId)}/regenerate-section`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sectionTitle,
        instructions
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore rigenerazione sezione');
    }

    const data = await res.json();
    showNotice('success', `Sezione "${sectionTitle}" rigenerata con successo`);
    await reloadPack(selectedLessonId);
  };

  // Preparation Confirmation
  const handleConfirmPrep = async (notes) => {
    const res = await fetch(`/api/lessons/${encodeURIComponent(selectedLessonId)}/confirm-preparation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Errore conferma preparazione');
    }

    showNotice('success', 'Preparazione congelata e confermata per la lezione di domani!');
    await reloadPack(selectedLessonId);
  };

  const selectedLesson = lessons.find(l => l.id === selectedLessonId);

  return h('div', { className: 'teacher-app' }, [
    // Header with User Auth State
    h(Header, { key: 'hdr', user }),

    // Context Selector Bar (Class, Subject, Lesson)
    h(ContextBar, {
      key: 'ctx',
      classes,
      subjects,
      lessons,
      selectedClassId,
      selectedSubjectId,
      selectedLessonId,
      onSelectClass: setSelectedClassId,
      onSelectSubject: setSelectedSubjectId,
      onSelectLesson: setSelectedLessonId,
      onOpenNewClass: () => setActiveModal('newClass'),
      onOpenNewSubject: () => setActiveModal('newSubject'),
      onOpenNewLesson: () => setActiveModal('newLesson')
    }),

    // Notice banner
    notice ? h('div', {
      key: 'notice',
      className: `notice notice-${notice.type}`,
      style: { margin: '1rem 1.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }
    }, notice.message) : null,

    // Main workspace container
    h('main', { key: 'main', className: 'main-container' }, [
      !selectedLesson
        ? h('div', { key: 'no-les', className: 'empty-state' }, [
            h('div', { key: 'i', style: { fontSize: '3rem', marginBottom: '1rem' } }, '📋'),
            h('h3', { key: 't' }, 'Nessuna lezione selezionata'),
            h('p', { key: 'd' }, 'Seleziona o crea una classe, una materia e una lezione per iniziare a preparare i materiali.')
          ])
        : [
            // Lesson Header with Status and Duration configuration
            h(LessonHeader, {
              key: 'les-hdr',
              lesson: selectedLesson,
              pack: lessonPack,
              durationMinutes,
              onChangeDuration: handleChangeDuration,
              onOpenConfirmModal: () => setActiveModal('confirm')
            }),

            // Source Set Manager (Checkboxes and real multipart upload)
            h(SourceManager, {
              key: 'src-mgr',
              materials,
              selectedSourceIds,
              sourceSelectionMode,
              onChangeSelectionMode: setSourceSelectionMode,
              onToggleSource: handleToggleSource,
              onSelectAllSources: handleSelectAllSources,
              onClearSources: handleClearSources,
              onOpenUploadModal: () => setActiveModal('upload')
            }),

            // Step Progress Card (Sequential 4 steps + selective retry)
            h(StepProgressCard, {
              key: 'step-prog',
              pack: lessonPack,
              stepStates,
              isGenerating,
              additionalPrompt,
              onChangePrompt: setAdditionalPrompt,
              onStartFullGeneration: handleStartFullGeneration,
              onRetryStep: handleRetryStep
            }),

            // Artifact Workspace (Tabs, MarkdownViewer, In-place Edit, AI Revision, Multi-format Export)
            h(ArtifactWorkspace, {
              key: 'art-ws',
              pack: lessonPack,
              activeTab,
              onSelectTab: setActiveTab,
              onSaveEdit: handleSaveEdit,
              onOpenRevisionModal: (art) => {
                setModalArtifact(art);
                setActiveModal('revision');
              },
              onOpenExportModal: (art) => {
                setModalArtifact(art);
                setActiveModal('export');
              }
            })
          ]
    ]),

    // Modals
    activeModal === 'newClass' ? h(NewClassModal, {
      key: 'm-cls',
      onClose: () => setActiveModal(null),
      onSubmit: handleCreateClass
    }) : null,

    activeModal === 'newSubject' ? h(NewSubjectModal, {
      key: 'm-sub',
      classId: selectedClassId,
      onClose: () => setActiveModal(null),
      onSubmit: handleCreateSubject
    }) : null,

    activeModal === 'newLesson' ? h(NewLessonModal, {
      key: 'm-les',
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      onClose: () => setActiveModal(null),
      onSubmit: handleCreateLesson
    }) : null,

    activeModal === 'upload' ? h(UploadModal, {
      key: 'm-up',
      classId: selectedClassId,
      subjectId: selectedSubjectId,
      lessonId: selectedLessonId,
      onClose: () => setActiveModal(null),
      onUpload: handleUploadFile
    }) : null,

    activeModal === 'revision' && modalArtifact ? h(RevisionModal, {
      key: 'm-rev',
      artifact: modalArtifact,
      onClose: () => {
        setActiveModal(null);
        setModalArtifact(null);
      },
      onSubmitRevision: handleSubmitRevision,
      onSubmitRegenerateSection: handleSubmitRegenerateSection
    }) : null,

    activeModal === 'confirm' && lessonPack ? h(ConfirmPrepModal, {
      key: 'm-conf',
      pack: lessonPack,
      onClose: () => setActiveModal(null),
      onConfirm: handleConfirmPrep
    }) : null,

    activeModal === 'export' && modalArtifact ? h(ExportModal, {
      key: 'm-exp',
      artifact: modalArtifact,
      onClose: () => {
        setActiveModal(null);
        setModalArtifact(null);
      }
    }) : null
  ]);
}
