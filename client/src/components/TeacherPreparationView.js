/**
 * Teacher Service — T1 "Tomorrow is ready" Web Application
 * Full React + ESM Architecture.
 * ZERO innerHTML, complete XSS protection, verifiable step-by-step Lesson Pack generation,
 * immutable versioning, selective step retry, and version-bound preparation confirmation.
 */
import React, { createElement as h, useState, useEffect, useCallback, useRef } from 'react';


import { Header } from './Header.js';
import { ContextBar } from './ContextBar.js';
import { AvailabilityPanel, PreparationFlowNav } from './PreparationFlow.js';
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
  const [classesLoading, setClassesLoading] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [packLoading, setPackLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [classesError, setClassesError] = useState('');
  const [subjectsError, setSubjectsError] = useState('');
  const [lessonsError, setLessonsError] = useState('');
  const [packError, setPackError] = useState('');
  const [materialsError, setMaterialsError] = useState('');
  const [subjectRetryIndex, setSubjectRetryIndex] = useState(0);
  const [lessonRetryIndex, setLessonRetryIndex] = useState(0);
  const [savingArtifactDraft, setSavingArtifactDraft] = useState(false);

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
  const [artifactDraftDirty, setArtifactDraftDirty] = useState(false);
  const [discardDraftToken, setDiscardDraftToken] = useState(0);
  const [pendingTransition, setPendingTransition] = useState(null);
  const [isConfirmingPreparation, setIsConfirmingPreparation] = useState(false);

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
  const classRequestRef = useRef(0);
  const subjectRequestRef = useRef(0);
  const lessonRequestRef = useRef(0);
  const packRequestRef = useRef(0);
  const materialsRequestRef = useRef(0);
  const activeContextRef = useRef({ classId: null, subjectId: null, lessonId: null });
  const transitionTriggerRef = useRef(null);

  activeContextRef.current = {
    classId: selectedClassId,
    subjectId: selectedSubjectId,
    lessonId: selectedLessonId
  };

  const hasUnsavedPreparationInputs = Boolean(
    selectedSourceIds.length || additionalPrompt.trim() || sourceSelectionMode !== 'selected_only'
  );
  const hasUnsavedChanges = artifactDraftDirty || hasUnsavedPreparationInputs;

  const showNotice = useCallback((type, message) => {
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setNotice({ type, message });
    noticeTimerRef.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  const loadClasses = useCallback(async () => {
    const requestId = ++classRequestRef.current;
    setClassesLoading(true);
    setClassesError('');
    try {
      const response = await fetch('/api/classes');
      if (!response.ok) throw new Error(`Risposta non riuscita (${response.status})`);
      const data = await response.json();
      if (requestId !== classRequestRef.current) return;
      const list = data.classes || [];
      setClasses(list);
      setSelectedClassId(current => list.some(item => item.id === current) ? current : list[0]?.id || null);
    } catch (error) {
      if (requestId === classRequestRef.current) setClassesError(error.message || 'Errore durante il caricamento delle classi.');
    } finally {
      if (requestId === classRequestRef.current) setClassesLoading(false);
    }
  }, []);

  // Authentication and initial class discovery.
  useEffect(() => {
    let mounted = true;
    async function loadInitial() {
      try {
        const response = await fetch('/api/auth/me');
        if (!mounted) return;
        setUser(response.ok ? await response.json() : { authenticated: false, teacherAuthorized: false });
      } catch (error) {
        if (mounted) setUser({ authenticated: false, teacherAuthorized: false, error: error.message });
      }
      if (mounted) await loadClasses();
    }
    loadInitial();
    return () => { mounted = false; classRequestRef.current += 1; };
  }, [loadClasses]);

  useEffect(() => {
    const requestId = ++subjectRequestRef.current;
    ++lessonRequestRef.current;
    setSubjects([]);
    setLessons([]);
    setSubjectsError('');
    setLessonsError('');
    setSubjectsLoading(Boolean(selectedClassId));
    setLessonsLoading(false);
    if (!selectedClassId) {
      setSelectedSubjectId(null);
      setSelectedLessonId(null);
      setSubjectsLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/subjects?classId=${encodeURIComponent(selectedClassId)}`);
        if (!response.ok) throw new Error(`Risposta non riuscita (${response.status})`);
        const data = await response.json();
        if (cancelled || requestId !== subjectRequestRef.current) return;
        const list = data.subjects || [];
        setSubjects(list);
        setSelectedSubjectId(current => list.some(item => item.id === current) ? current : list[0]?.id || null);
      } catch (error) {
        if (!cancelled && requestId === subjectRequestRef.current) setSubjectsError(error.message || 'Errore durante il caricamento delle materie.');
      } finally {
        if (!cancelled && requestId === subjectRequestRef.current) setSubjectsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedClassId, subjectRetryIndex]);

  useEffect(() => {
    const requestId = ++lessonRequestRef.current;
    setLessons([]);
    setLessonsError('');
    setLessonsLoading(Boolean(selectedClassId && selectedSubjectId));
    if (!selectedClassId || !selectedSubjectId) {
      setSelectedLessonId(null);
      setLessonsLoading(false);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/lessons?classId=${encodeURIComponent(selectedClassId)}&subjectId=${encodeURIComponent(selectedSubjectId)}`);
        if (!response.ok) throw new Error(`Risposta non riuscita (${response.status})`);
        const data = await response.json();
        if (cancelled || requestId !== lessonRequestRef.current) return;
        const list = data.lessons || [];
        setLessons(list);
        setSelectedLessonId(current => list.some(item => item.id === current) ? current : list[0]?.id || null);
      } catch (error) {
        if (!cancelled && requestId === lessonRequestRef.current) setLessonsError(error.message || 'Errore durante il caricamento delle lezioni.');
      } finally {
        if (!cancelled && requestId === lessonRequestRef.current) setLessonsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedClassId, selectedSubjectId, lessonRetryIndex]);

  const reloadPack = useCallback(async (lessonId) => {
    const requestId = ++packRequestRef.current;
    if (!lessonId) {
      setLessonPack(null);
      setPackError('');
      setPackLoading(false);
      return;
    }
    setPackLoading(true);
    setPackError('');
    try {
      const response = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/pack`);
      if (!response.ok) throw new Error(`Risposta non riuscita (${response.status})`);
      const data = await response.json();
      const active = activeContextRef.current;
      if (requestId !== packRequestRef.current || active.lessonId !== lessonId) return;
      setLessonPack(data.pack);
      if (data.pack?.lesson?.duration_minutes) setDurationMinutes(data.pack.lesson.duration_minutes);
    } catch (error) {
      if (requestId === packRequestRef.current && activeContextRef.current.lessonId === lessonId) {
        setPackError(error.message || 'Errore durante il caricamento del pacchetto.');
      }
    } finally {
      if (requestId === packRequestRef.current && activeContextRef.current.lessonId === lessonId) setPackLoading(false);
    }
  }, []);

  const reloadMaterials = useCallback(async (classId, subjectId, lessonId) => {
    const requestId = ++materialsRequestRef.current;
    if (!classId) {
      setMaterials([]);
      setMaterialsLoading(false);
      setMaterialsError('');
      return;
    }
    setMaterialsLoading(true);
    setMaterialsError('');
    try {
      let url = `/api/materials?classId=${encodeURIComponent(classId)}`;
      if (subjectId) url += `&subjectId=${encodeURIComponent(subjectId)}`;
      if (lessonId) url += `&lessonId=${encodeURIComponent(lessonId)}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Risposta non riuscita (${response.status})`);
      const data = await response.json();
      const active = activeContextRef.current;
      if (requestId !== materialsRequestRef.current || active.classId !== classId || active.subjectId !== subjectId || active.lessonId !== lessonId) return;
      const allMaterials = data.materials || [];
      const packTypes = ['lesson_plan', 'teacher_script', 'exercise_sheet', 'student_material', 'student_note'];
      const candidateSources = allMaterials.filter(material => !(packTypes.includes(material.resource_type) && material.lesson_id === lessonId));
      setMaterials(candidateSources);
    } catch (error) {
      const active = activeContextRef.current;
      if (requestId === materialsRequestRef.current && active.classId === classId && active.subjectId === subjectId && active.lessonId === lessonId) {
        setMaterialsError(error.message || 'Errore durante il caricamento delle fonti.');
      }
    } finally {
      const active = activeContextRef.current;
      if (requestId === materialsRequestRef.current && active.classId === classId && active.subjectId === subjectId && active.lessonId === lessonId) setMaterialsLoading(false);
    }
  }, []);

  useEffect(() => {
    ++packRequestRef.current;
    ++materialsRequestRef.current;
    setLessonPack(null);
    setMaterials([]);
    setSelectedSourceIds([]);
    setAdditionalPrompt('');
    setSourceSelectionMode('selected_only');
    setPackError('');
    setMaterialsError('');
    if (selectedLessonId) {
      reloadPack(selectedLessonId);
      reloadMaterials(selectedClassId, selectedSubjectId, selectedLessonId);
    } else {
      setPackLoading(false);
      setMaterialsLoading(false);
    }
  }, [selectedLessonId, selectedClassId, selectedSubjectId, reloadPack, reloadMaterials]);

  function requestTransition(label, action, { contextChange = false } = {}) {
    const discardArtifactDraft = artifactDraftDirty;
    const discardPreparationInputs = contextChange && hasUnsavedPreparationInputs;
    if (discardArtifactDraft || discardPreparationInputs) {
      transitionTriggerRef.current = document.activeElement;
      setPendingTransition({ label, action, discardArtifactDraft, discardPreparationInputs });
      return;
    }
    action();
  }

  function cancelPendingTransition() {
    setPendingTransition(null);
    requestAnimationFrame(() => transitionTriggerRef.current?.focus?.());
  }

  function continuePendingTransition() {
    if (!pendingTransition) return;
    const transition = pendingTransition;
    setPendingTransition(null);
    if (transition.discardArtifactDraft) {
      setDiscardDraftToken(value => value + 1);
      setArtifactDraftDirty(false);
    }
    if (transition.discardPreparationInputs) {
      setSelectedSourceIds([]);
      setAdditionalPrompt('');
      setSourceSelectionMode('selected_only');
    }
    transition.action();
  }

  function resetLessonWorkspace() {
    setLessonPack(null);
    setMaterials([]);
    setSelectedSourceIds([]);
    setSourceSelectionMode('selected_only');
    setAdditionalPrompt('');
    setActiveTab('lessonPlan');
    setStepStates({ lessonPlan: 'idle', teacherScript: 'idle', exercises: 'idle', studentMaterial: 'idle' });
    setArtifactDraftDirty(false);
    setDiscardDraftToken(value => value + 1);
  }

  function selectClassNow(classId) {
    setSelectedClassId(classId);
    setSelectedSubjectId(null);
    setSelectedLessonId(null);
    setSubjects([]);
    setLessons([]);
    resetLessonWorkspace();
  }

  function selectSubjectNow(subjectId) {
    setSelectedSubjectId(subjectId);
    setSelectedLessonId(null);
    setLessons([]);
    resetLessonWorkspace();
  }

  function selectLessonNow(lessonId) {
    setSelectedLessonId(lessonId);
    resetLessonWorkspace();
  }

  const handleSelectClass = classId => requestTransition(
    `passare alla classe ${classes.find(item => item.id === classId)?.name || 'selezionata'}`,
    () => selectClassNow(classId),
    { contextChange: true }
  );
  const handleSelectSubject = subjectId => requestTransition(
    `passare alla materia ${subjects.find(item => item.id === subjectId)?.name || 'selezionata'}`,
    () => selectSubjectNow(subjectId),
    { contextChange: true }
  );
  const handleSelectLesson = lessonId => requestTransition(
    `passare alla lezione ${lessons.find(item => item.id === lessonId)?.title || 'selezionata'}`,
    () => selectLessonNow(lessonId),
    { contextChange: true }
  );

  function openContextModal(modalName, label) {
    requestTransition(label, () => setActiveModal(modalName), { contextChange: true });
  }

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
    selectClassNow(data.class.id);
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
    selectSubjectNow(data.subject.id);
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
    selectLessonNow(data.lesson.id);
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
    const lessonId = selectedLessonId;
    setIsConfirmingPreparation(true);
    try {
      const response = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/confirm-preparation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Errore conferma preparazione');
      }
      showNotice('success', 'Pacchetto della lezione confermato. La disponibilità agli studenti resta separata.');
      await reloadPack(lessonId);
    } catch (error) {
      showNotice('error', `La preparazione non è stata confermata: ${error.message}`);
      throw error;
    } finally {
      setIsConfirmingPreparation(false);
    }
  };

  const selectedClass = classes.find(item => item.id === selectedClassId);
  const selectedSubject = subjects.find(item => item.id === selectedSubjectId);
  const selectedLesson = lessons.find(item => item.id === selectedLessonId);
  const currentPreparationContext = [selectedClass?.name, selectedSubject?.name, selectedLesson?.title]
    .filter(Boolean)
    .join(' / ');
  const contextLoadingLabel = classesLoading
    ? 'Caricamento delle classi…'
    : subjectsLoading
      ? 'Caricamento delle materie…'
      : lessonsLoading
        ? 'Caricamento delle lezioni…'
        : '';
  const contextEmptyCopy = classesError || subjectsError || lessonsError
    ? 'Il contesto non è completo. Usa il comando “Riprova” accanto al campo che non è stato caricato.'
    : !selectedClassId
      ? 'Seleziona o crea una classe per iniziare.'
      : !selectedSubjectId
        ? 'Seleziona o crea una materia per questa classe.'
        : 'Seleziona o crea una lezione per questa materia.';

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
      onSelectClass: handleSelectClass,
      onSelectSubject: handleSelectSubject,
      onSelectLesson: handleSelectLesson,
      onOpenNewClass: () => openContextModal('newClass', 'creare una nuova classe'),
      onOpenNewSubject: () => openContextModal('newSubject', 'creare una nuova materia'),
      onOpenNewLesson: () => openContextModal('newLesson', 'creare una nuova lezione'),
      classLoading: classesLoading,
      subjectLoading: subjectsLoading,
      lessonLoading: lessonsLoading,
      classError: classesError,
      subjectError: subjectsError,
      lessonError: lessonsError,
      onRetryClasses: loadClasses,
      onRetrySubjects: () => setSubjectRetryIndex(value => value + 1),
      onRetryLessons: () => setLessonRetryIndex(value => value + 1),
      locked: isGenerating || isConfirmingPreparation || savingArtifactDraft || Boolean(activeModal || pendingTransition)
    }),

    selectedLesson ? h(PreparationFlowNav, { key: 'flow-nav', currentContext: currentPreparationContext }) : null,

    // Notice banner
    notice ? h('div', {
      key: 'notice',
      className: `notice notice-${notice.type}`,
      style: { margin: '1rem 1.5rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)' }
    }, notice.message) : null,

    // Main workspace container
    h('main', { key: 'main', className: 'main-container' }, [
      !selectedLesson
        ? h('section', { key: 'no-les', className: 'preparation-empty-state', role: contextLoadingLabel ? 'status' : undefined, 'aria-live': 'polite' }, [
            h('h2', { key: 'title' }, contextLoadingLabel || 'Preparazione lezione'),
            h('p', { key: 'description' }, contextEmptyCopy)
          ])
        : [
            // Lesson Header with Status and Duration configuration
            h(LessonHeader, {
              key: 'les-hdr',
              lesson: selectedLesson,
              pack: lessonPack,
              durationMinutes,
              onChangeDuration: handleChangeDuration
            }),
            packLoading ? h('p', { key: 'pack-loading', className: 'inline-status', role: 'status' }, 'Caricamento del pacchetto della lezione…') : null,
            packError ? h('div', { key: 'pack-error', className: 'inline-error', role: 'alert' }, [
              h('p', { key: 'message' }, `Il pacchetto non è disponibile. ${packError}`),
              h('button', { key: 'retry', type: 'button', className: 'btn btn-secondary btn-sm', onClick: () => reloadPack(selectedLessonId) }, 'Riprova caricamento')
            ]) : null,

            // Source Set Manager (Checkboxes and real multipart upload)
            h(SourceManager, {
              key: 'src-mgr',
              materials,
              selectedSourceIds,
              sourceSelectionMode,
              loading: materialsLoading,
              error: materialsError,
              onRetry: () => reloadMaterials(selectedClassId, selectedSubjectId, selectedLessonId),
              onChangeSelectionMode: setSourceSelectionMode,
              onToggleSource: handleToggleSource,
              onSelectAllSources: handleSelectAllSources,
              onClearSources: handleClearSources,
              onOpenUploadModal: () => openContextModal('upload', 'caricare una fonte')
            }),

            // Step Progress Card (Sequential 4 steps + selective retry)
            h(StepProgressCard, {
              key: 'step-prog',
              pack: lessonPack,
              stepStates,
              isGenerating,
              hasUnsavedChanges: artifactDraftDirty,
              additionalPrompt,
              onChangePrompt: setAdditionalPrompt,
              onStartFullGeneration: handleStartFullGeneration,
              onRetryStep: handleRetryStep
            }),

            // Artifact Workspace (Tabs, MarkdownViewer, In-place Edit, AI Revision, Multi-format Export)
            h(ArtifactWorkspace, {
              key: `art-ws-${selectedLessonId}`,
              pack: lessonPack,
              activeTab,
              onSelectTab: setActiveTab,
              onSaveEdit: handleSaveEdit,
              onDraftStateChange: setArtifactDraftDirty,
              onSavingStateChange: setSavingArtifactDraft,
              discardDraftToken,
              onRequestTransition: requestTransition,
              onOpenConfirmModal: () => requestTransition(
                'confermare il pacchetto della lezione',
                () => setActiveModal('confirm')
              ),
              onOpenRevisionModal: (art) => {
                setModalArtifact(art);
                setActiveModal('revision');
              },
              onOpenExportModal: (art) => {
                setModalArtifact(art);
                setActiveModal('export');
              }
            }),
            h(AvailabilityPanel, { key: 'availability', pack: lessonPack })
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
    }) : null,

    pendingTransition ? h('div', { key: 'unsaved-backdrop', className: 'unsaved-draft-backdrop' },
      h('section', {
        className: 'unsaved-draft-dialog',
        role: 'alertdialog',
        'aria-modal': 'true',
        'aria-labelledby': 'unsaved-draft-title',
        'aria-describedby': 'unsaved-draft-description',
        onKeyDown: event => {
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelPendingTransition();
            return;
          }
          if (event.key !== 'Tab') return;
          const controls = Array.from(event.currentTarget.querySelectorAll('button:not([disabled])'));
          if (!controls.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      }, [
        h('h2', { key: 'title', id: 'unsaved-draft-title' }, 'Modifiche non salvate'),
        h('p', { key: 'description', id: 'unsaved-draft-description' }, pendingTransition.discardPreparationInputs
          ? `Fonti, istruzioni o una modifica del materiale non sono state salvate. Se continui per ${pendingTransition.label}, queste modifiche locali verranno scartate.`
          : `La modifica corrente non è stata salvata. Se continui per ${pendingTransition.label}, la bozza nell’editor verrà scartata.`),
        h('div', { key: 'actions', className: 'unsaved-draft-actions' }, [
          h('button', { key: 'stay', type: 'button', className: 'btn btn-secondary', autoFocus: true, onClick: cancelPendingTransition }, 'Resta nella bozza'),
          h('button', { key: 'continue', type: 'button', className: 'btn btn-danger', onClick: continuePendingTransition }, 'Scarta e continua')
        ])
      ])
    ) : null
  ]);
}
