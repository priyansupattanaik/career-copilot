import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Link } from "@/shared/ui/router-link";
import { apiRequest } from "@/shared/api/client";
import { Button, Select, Textarea } from "@/shared/ui/primitives";
import { CopilotIcon, type CopilotIconName } from "@/components/ui/copilot-icons";
import { createLiveInterview, saveLiveInterview } from "@/features/interview/live-store";
import {
  FLUID_SPRING_TRANSITION,
  FAST_SPRING_TRANSITION,
} from "@/components/ui/motion-system";
import "@/features/interview/interview.css";

interface FocusOption {
  value: "mixed" | "behavioural" | "technical" | "hr";
  label: string;
  hint: string;
  icon: CopilotIconName;
}

const FOCUS_TRACKS: readonly FocusOption[] = [
  {
    value: "mixed",
    label: "Mixed Round",
    hint: "Stories, design, and skills mirroring a comprehensive real-world screen",
    icon: "interview",
  },
  {
    value: "behavioural",
    label: "Behavioural",
    hint: "STAR method, cross-functional conflict, leadership, and collaboration",
    icon: "community",
  },
  {
    value: "technical",
    label: "Technical Depth",
    hint: "System thinking, architecture trade-offs, and verbal problem breakdown",
    icon: "skills",
  },
  {
    value: "hr",
    label: "Screening & Culture",
    hint: "Elevator pitch, motivations, salary alignment, and career narrative",
    icon: "account",
  },
];

const QUESTION_COUNTS = [3, 5, 8] as const;

const DIFFICULTY_LEVELS = [
  { value: "easy", label: "Foundational", hint: "Standard entry & mid-level expectations" },
  { value: "balanced", label: "Balanced Standard", hint: "Industry baseline with targeted follow-ups" },
  { value: "challenging", label: "Challenging / Staff", hint: "Rigorous drill-down on edge cases & ambiguity" },
] as const;

type SetupResumeOption = {
  id: string;
  title: string;
  is_active?: boolean;
  latest_version?: {
    id: string;
    original_filename?: string;
    extraction_status?: string;
  } | null;
};

export function InterviewSetupView() {
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Query parameter contracts
  const linkedResumeVersionId = searchParams.get("resume_version_id") || "";
  const jobDescriptionId = searchParams.get("job_description_id") || "";
  const initialTargetRole = searchParams.get("target_role") || "";

  // Right column configuration state
  const [mode, setMode] = useState<FocusOption["value"]>("mixed");
  const [targetRole, setTargetRole] = useState(initialTargetRole);
  const [questionCount, setQuestionCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<string>("balanced");
  const [resumeVersionId, setResumeVersionId] = useState(linkedResumeVersionId);
  const [storedResumes, setStoredResumes] = useState<SetupResumeOption[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);
  const [jobDescriptionText, setJobDescriptionText] = useState("");
  const [error, setError] = useState("");

  // Hardware / AV test lab state
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100
  const [cameraStatus, setCameraStatus] = useState<"idle" | "requesting" | "ready" | "denied" | "unsupported">("idle");
  const [micStatus, setMicStatus] = useState<"idle" | "requesting" | "ready" | "denied" | "unsupported">("idle");
  const [cameraError, setCameraError] = useState("");
  const [micError, setMicError] = useState("");

  // Available devices
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  // Refs for WebRTC & Audio Context
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Load saved resumes on mount with preferred auto-selection
  useEffect(() => {
    let active = true;
    setResumesLoading(true);
    apiRequest<SetupResumeOption[]>("/resumes")
      .then((rows) => {
        if (!active) return;
        const list = rows || [];
        setStoredResumes(list);
        setResumeVersionId((current) => {
          if (current) return current;
          const preferred =
            list.find((row) => row.is_active && row.latest_version?.id)?.latest_version?.id ||
            list.find((row) => row.latest_version?.extraction_status === "confirmed")?.latest_version?.id ||
            list.find((row) => row.latest_version?.id)?.latest_version?.id ||
            "";
          return preferred;
        });
      })
      .catch(() => {
        if (active) setStoredResumes([]);
      })
      .finally(() => {
        if (active) setResumesLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Enumerate input devices
  const updateDeviceList = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const vIns = devices.filter((d) => d.kind === "videoinput");
      const aIns = devices.filter((d) => d.kind === "audioinput");
      setVideoDevices(vIns);
      setAudioDevices(aIns);

      if (vIns.length > 0) {
        setSelectedCameraId((cur) => (vIns.some((d) => d.deviceId === cur) ? cur : vIns[0].deviceId));
      }
      if (aIns.length > 0) {
        setSelectedMicId((cur) => (aIns.some((d) => d.deviceId === cur) ? cur : aIns[0].deviceId));
      }
    } catch {
      // Ignore device enumeration issues
    }
  }, []);

  // Listen to device change events (e.g. plugging/unplugging headphones/webcams)
  useEffect(() => {
    if (!navigator.mediaDevices) return;
    const handleDeviceChange = () => {
      void updateDeviceList();
    };
    navigator.mediaDevices.addEventListener?.("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", handleDeviceChange);
    };
  }, [updateDeviceList]);

  // Stop video stream cleanly
  const stopVideoStream = useCallback(() => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Stop audio stream & VU analyser cleanly
  const stopAudioStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Start Camera Stream
  const startCamera = useCallback(async (deviceId?: string) => {
    stopVideoStream();
    if (!cameraEnabled) {
      setCameraStatus("idle");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("unsupported");
      setCameraError("Camera is not supported by your browser");
      return;
    }

    setCameraStatus("requesting");
    setCameraError("");

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId } }
          : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      videoStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        void videoRef.current.play().catch(() => {});
      }
      setCameraStatus("ready");
      void updateDeviceList();
    } catch (err) {
      const e = err as Error;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setCameraStatus("denied");
        setCameraError("Camera permission was denied. Click to retry or proceed with camera disabled.");
      } else {
        setCameraStatus("denied");
        setCameraError(e.message || "Failed to access camera device.");
      }
    }
  }, [cameraEnabled, stopVideoStream, updateDeviceList]);

  // Start Microphone Stream & VU Analyser
  const startMicrophone = useCallback(async (deviceId?: string) => {
    stopAudioStream();
    if (!microphoneEnabled) {
      setMicStatus("idle");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicStatus("unsupported");
      setMicError("Microphone is not supported by your browser");
      return;
    }

    setMicStatus("requesting");
    setMicError("");

    try {
      const constraints: MediaStreamConstraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        video: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;

      // AudioContext & AnalyserNode
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const audioCtx = new AudioContextClass();
        audioContextRef.current = audioCtx;
        if (audioCtx.state === "suspended") {
          void audioCtx.resume();
        }
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateVU = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          // Normalize to percentage 0..100 with boosted responsiveness
          const normalized = Math.min(100, Math.round((average / 128) * 100));
          setAudioLevel(normalized);
          animFrameRef.current = requestAnimationFrame(updateVU);
        };
        updateVU();
      }

      setMicStatus("ready");
      void updateDeviceList();
    } catch (err) {
      const e = err as Error;
      if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
        setMicStatus("denied");
        setMicError("Microphone permission was denied. You can still use text typing.");
      } else {
        setMicStatus("denied");
        setMicError(e.message || "Failed to access microphone.");
      }
    }
  }, [microphoneEnabled, stopAudioStream, updateDeviceList]);

  // Manage camera lifecycle
  useEffect(() => {
    if (cameraEnabled) {
      void startCamera(selectedCameraId || undefined);
    } else {
      stopVideoStream();
      setCameraStatus("idle");
      setCameraError("");
    }
    return () => {
      stopVideoStream();
    };
  }, [cameraEnabled, selectedCameraId, startCamera, stopVideoStream]);

  // Manage microphone lifecycle
  useEffect(() => {
    if (microphoneEnabled) {
      void startMicrophone(selectedMicId || undefined);
    } else {
      stopAudioStream();
      setMicStatus("idle");
      setMicError("");
    }
    return () => {
      stopAudioStream();
    };
  }, [microphoneEnabled, selectedMicId, startMicrophone, stopAudioStream]);

  // Overall unmount cleanup guarantee
  useEffect(() => {
    return () => {
      stopVideoStream();
      stopAudioStream();
    };
  }, [stopVideoStream, stopAudioStream]);

  // Submission handler
  function handleEnterInterviewRoom() {
    setError("");
    try {
      const live = createLiveInterview({
        mode,
        target_role: targetRole.trim() || null,
        difficulty: difficulty || "balanced",
        question_count: questionCount,
        camera_enabled: cameraEnabled && cameraStatus === "ready",
        microphone_enabled: microphoneEnabled && micStatus === "ready",
        job_description_text: jobDescriptionText.trim() || null,
        resume_version_id: resumeVersionId || null,
        job_description_id: jobDescriptionId || null,
      });
      saveLiveInterview(live);
      // Guarantee all media tracks are cleanly relinquished before transition
      stopVideoStream();
      stopAudioStream();
      navigate(`/mock-interview/session/${live.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to launch interview session");
    }
  }

  const resumesWithVersion = storedResumes.filter((row) => row.latest_version?.id);

  // Pre-flight status calculation
  const isCameraOk = !cameraEnabled || cameraStatus === "ready";
  const isMicOk = !microphoneEnabled || micStatus === "ready";

  return (
    <div className="feature-page interview-hub interview-setup-page">
      {/* Breadcrumb Navigation Bar */}
      <nav className="interview-setup-nav" aria-label="Breadcrumb">
        <Link href="/mock-interview" className="interview-back-link">
          <CopilotIcon name="back" size={16} />
          <span>Back to Mock Interview Hub</span>
        </Link>
        <span className="interview-nav-divider">/</span>
        <span className="interview-nav-current">Setup &amp; Flight Check</span>
      </nav>

      {/* Hero Header */}
      <header className="interview-setup-header">
        <div className="interview-setup-header-copy">
          <p className="interview-kicker">Interactive Setup &amp; A/V Command Center</p>
          <h1 className="interview-setup-title">Prepare Your Practice Round</h1>
          <p className="interview-setup-subtitle">
            Calibrate your camera, test your microphone audio levels, and tailor your interview focus track before entering the room.
          </p>
        </div>
      </header>

      {/* Split-Screen Command Layout */}
      <div className="interview-setup-layout">
        {/* LEFT COLUMN: Interactive Hardware / A/V Test Lab */}
        <section className="interview-av-lab" aria-label="A/V Test Lab">
          <div className="interview-lab-header">
            <div className="interview-lab-title-row">
              <div className="interview-lab-icon-box">
                <CopilotIcon name="lesson" size={18} />
              </div>
              <div>
                <h2 className="interview-lab-title">A/V Hardware Test Lab</h2>
                <p className="interview-lab-desc">Live camera mirror &amp; audio calibration</p>
              </div>
            </div>
            <span
              className="status-chip"
              data-tone={
                cameraStatus === "ready" && micStatus === "ready"
                  ? "success"
                  : cameraStatus === "denied" || micStatus === "denied"
                    ? "danger"
                    : "info"
              }
            >
              {cameraStatus === "ready" && micStatus === "ready"
                ? "Lab Calibrated"
                : cameraStatus === "denied" || micStatus === "denied"
                  ? "Permission Required"
                  : "Checking Devices"}
            </span>
          </div>

          {/* Live Video Mirror Viewport */}
          <div className="interview-preview-container">
            {cameraEnabled ? (
              cameraStatus === "ready" ? (
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="interview-preview-video"
                  aria-label="Live webcam mirror preview"
                />
              ) : cameraStatus === "requesting" ? (
                <div className="interview-preview-placeholder requesting">
                  <div className="interview-spinner" aria-hidden="true" />
                  <p>Requesting camera access…</p>
                  <span>Grant permission in your browser prompt</span>
                </div>
              ) : cameraStatus === "denied" ? (
                <div className="interview-preview-placeholder error">
                  <CopilotIcon name="alert" size={32} />
                  <p>Camera Permission Denied</p>
                  <span>{cameraError}</span>
                  <Button
                    type="button"
                    variant="secondary"
                    className="interview-retry-btn"
                    onClick={() => void startCamera(selectedCameraId || undefined)}
                  >
                    <CopilotIcon name="refresh" size={14} />
                    Retry Camera Access
                  </Button>
                </div>
              ) : (
                <div className="interview-preview-placeholder">
                  <CopilotIcon name="alert" size={32} />
                  <p>Camera Unavailable</p>
                  <span>{cameraError || "Camera hardware not detected"}</span>
                </div>
              )
            ) : (
              <div className="interview-preview-placeholder disabled">
                <CopilotIcon name="hide" size={36} />
                <p>Camera Disabled</p>
                <span>You will participate with voice and text only</span>
              </div>
            )}

            {/* Quick Overlays */}
            <div className="interview-preview-badges">
              <span className="interview-video-feed-tag">
                <span className={`interview-status-dot ${cameraStatus === "ready" ? "is-live" : ""}`} />
                {cameraEnabled ? (cameraStatus === "ready" ? "Live Feed" : "Camera Initializing") : "Camera Off"}
              </span>
              {selectedCameraId && videoDevices.length > 1 && (
                <span className="interview-device-count-tag">
                  {videoDevices.length} Cameras Available
                </span>
              )}
            </div>
          </div>

          {/* Dynamic Audio VU Meter */}
          <div className="interview-vu-section">
            <div className="interview-vu-header">
              <div className="interview-vu-label-group">
                <CopilotIcon name="skills" size={16} />
                <span className="interview-vu-title">Microphone Audio Meter</span>
              </div>
              <span className="interview-vu-numeric">
                {microphoneEnabled
                  ? micStatus === "ready"
                    ? `${audioLevel}%`
                    : micStatus === "requesting"
                      ? "Calibrating…"
                      : micStatus === "denied"
                        ? "Muted / Denied"
                        : "Off"
                  : "Disabled"}
              </span>
            </div>

            <div
              className="interview-vu-track"
              role="progressbar"
              aria-valuenow={microphoneEnabled && micStatus === "ready" ? audioLevel : 0}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Microphone audio input level"
            >
              <div
                className={`interview-vu-fill ${audioLevel > 75 ? "is-loud" : audioLevel > 20 ? "is-active" : "is-low"}`}
                style={{ width: `${microphoneEnabled && micStatus === "ready" ? audioLevel : 0}%` }}
              />
            </div>

            {microphoneEnabled && micStatus === "ready" && (
              <p className="interview-vu-caption">
                {audioLevel > 20
                  ? "✓ Voice detected cleanly. Great speaking volume!"
                  : "Speak into your microphone to verify detection levels."}
              </p>
            )}

            {microphoneEnabled && micStatus === "denied" && (
              <div className="interview-lab-warning">
                <CopilotIcon name="alert" size={14} />
                <span>{micError}</span>
                <Button
                  type="button"
                  variant="secondary"
                  className="interview-retry-btn"
                  onClick={() => void startMicrophone(selectedMicId || undefined)}
                >
                  <CopilotIcon name="refresh" size={12} />
                  Retry Mic
                </Button>
              </div>
            )}
          </div>

          {/* Quick Hardware Toggles & Selectors */}
          <div className="interview-lab-controls">
            <div className="interview-device-picker-grid">
              {/* Camera device selector */}
              <div className="interview-device-control-card">
                <div className="interview-control-head">
                  <label className="interview-toggle-switch">
                    <input
                      type="checkbox"
                      checked={cameraEnabled}
                      onChange={(e) => setCameraEnabled(e.target.checked)}
                    />
                    <span className="interview-switch-slider" />
                  </label>
                  <span className="interview-control-title">Webcam Presence</span>
                </div>

                {cameraEnabled && videoDevices.length > 0 && (
                  <Select
                    value={selectedCameraId}
                    onChange={(e) => setSelectedCameraId(e.target.value)}
                    aria-label="Select Webcam Device"
                    className="interview-device-dropdown"
                  >
                    {videoDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Camera ${idx + 1}`}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              {/* Microphone device selector */}
              <div className="interview-device-control-card">
                <div className="interview-control-head">
                  <label className="interview-toggle-switch">
                    <input
                      type="checkbox"
                      checked={microphoneEnabled}
                      onChange={(e) => setMicrophoneEnabled(e.target.checked)}
                    />
                    <span className="interview-switch-slider" />
                  </label>
                  <span className="interview-control-title">Microphone Audio</span>
                </div>

                {microphoneEnabled && audioDevices.length > 0 && (
                  <Select
                    value={selectedMicId}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                    aria-label="Select Microphone Device"
                    className="interview-device-dropdown"
                  >
                    {audioDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Microphone ${idx + 1}`}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Structured Setup Configuration */}
        <section className="interview-config-card" aria-label="Session Configuration">
          <div className="interview-config-header">
            <div className="interview-lab-icon-box config">
              <CopilotIcon name="settings" size={18} />
            </div>
            <div>
              <h2 className="interview-config-title">Round Configuration</h2>
              <p className="interview-config-desc">Target domain, question depth, and tailored context</p>
            </div>
          </div>

          <form
            className="interview-config-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleEnterInterviewRoom();
            }}
          >
            {/* Focus Track Selector */}
            <fieldset className="interview-config-group">
              <legend className="interview-field-label">Interview Focus Track</legend>
              <div className="interview-tracks-grid">
                {FOCUS_TRACKS.map((track) => {
                  const selected = mode === track.value;
                  return (
                    <motion.label
                      key={track.value}
                      className={`interview-track-tile ${selected ? "is-selected" : ""}`}
                      whileHover={shouldReduceMotion ? undefined : { y: -2 }}
                      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
                      transition={FLUID_SPRING_TRANSITION}
                    >
                      <input
                        type="radio"
                        name="focus-track"
                        value={track.value}
                        checked={selected}
                        onChange={() => setMode(track.value)}
                        className="visually-hidden"
                      />
                      <div className="interview-track-icon-wrapper">
                        <CopilotIcon name={track.icon} size={20} />
                      </div>
                      <div className="interview-track-text">
                        <span className="interview-track-name">{track.label}</span>
                        <span className="interview-track-hint">{track.hint}</span>
                      </div>
                      {selected && (
                        <motion.span
                          layoutId="interview-track-active-border"
                          className="interview-track-active-indicator"
                          transition={shouldReduceMotion ? { duration: 0 } : FLUID_SPRING_TRANSITION}
                        />
                      )}
                    </motion.label>
                  );
                })}
              </div>
            </fieldset>

            {/* Target Role & Question Count */}
            <div className="interview-config-row">
              <label className="interview-field flex-1">
                <span className="interview-field-label">
                  Target Role <span className="interview-field-optional">(e.g. Senior Frontend, Staff SRE)</span>
                </span>
                <input
                  className="field interview-input"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  placeholder="e.g. Full-Stack Engineer, Product Manager"
                  maxLength={150}
                  autoComplete="off"
                />
              </label>

              <fieldset className="interview-field">
                <legend className="interview-field-label">Question Count</legend>
                <div className="interview-pills-row">
                  {QUESTION_COUNTS.map((count) => {
                    const selected = questionCount === count;
                    return (
                      <motion.label
                        key={count}
                        className={`interview-pill-chip ${selected ? "is-selected" : ""}`}
                        whileHover={shouldReduceMotion ? undefined : { scale: 1.04 }}
                        whileTap={shouldReduceMotion ? undefined : { scale: 0.96 }}
                        transition={FAST_SPRING_TRANSITION}
                      >
                        <input
                          type="radio"
                          name="question-count"
                          value={count}
                          checked={selected}
                          onChange={() => setQuestionCount(count)}
                          className="visually-hidden"
                        />
                        <span>{count} Questions</span>
                      </motion.label>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {/* Difficulty Level */}
            <fieldset className="interview-config-group">
              <legend className="interview-field-label">Simulation Rigor &amp; Difficulty</legend>
              <div className="interview-difficulty-grid">
                {DIFFICULTY_LEVELS.map((item) => {
                  const selected = difficulty === item.value;
                  return (
                    <label
                      key={item.value}
                      className={`interview-diff-chip ${selected ? "is-selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="difficulty"
                        value={item.value}
                        checked={selected}
                        onChange={() => setDifficulty(item.value)}
                        className="visually-hidden"
                      />
                      <span className="interview-diff-label">{item.label}</span>
                      <span className="interview-diff-hint">{item.hint}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Resume Auto-Selector */}
            <div className="interview-field">
              <span className="interview-field-label">
                Grounding Resume <span className="interview-field-optional">(recommended for evidence-backed questions)</span>
              </span>
              {resumesLoading ? (
                <div className="interview-loading-notice">
                  <div className="interview-spinner-sm" />
                  <span>Scanning your saved resumes…</span>
                </div>
              ) : resumesWithVersion.length > 0 || resumeVersionId ? (
                <Select
                  value={resumeVersionId}
                  onChange={(e) => setResumeVersionId(e.target.value)}
                  className="interview-resume-select"
                >
                  <option value="">General Practice (No resume attached)</option>
                  {resumeVersionId && !resumesWithVersion.some((r) => r.latest_version?.id === resumeVersionId) && (
                    <option value={resumeVersionId}>Linked Resume ({resumeVersionId.slice(0, 8)}…)</option>
                  )}
                  {resumesWithVersion.map((res) => (
                    <option key={res.latest_version!.id} value={res.latest_version!.id}>
                      {res.title} {res.is_active ? "• (Active Profile)" : ""}
                    </option>
                  ))}
                </Select>
              ) : (
                <div className="interview-empty-notice">
                  <span>No uploaded resumes found. The session will use industry standard archetypes.</span>
                </div>
              )}
            </div>

            {/* Job Description Textarea */}
            <div className="interview-field">
              <label htmlFor="target-jd" className="interview-field-label">
                Target Job Description <span className="interview-field-optional">(optional)</span>
              </label>
              <Textarea
                id="target-jd"
                value={jobDescriptionText}
                onChange={(e: { target: { value: string } }) => setJobDescriptionText(e.target.value)}
                placeholder="Paste the job description or bullet points of key requirements here to simulate specific company screening questions…"
                className="interview-jd-textarea"
                rows={3}
              />
            </div>

            {error && (
              <div className="interview-form-error" role="alert">
                <CopilotIcon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}
          </form>
        </section>
      </div>

      {/* BOTTOM FLIGHT CHECK & HIGH-VISIBILITY ACTION */}
      <footer className="interview-flight-check-bar">
        <div className="interview-flight-status-wrapper">
          <div className="interview-flight-title-group">
            <span className="interview-flight-kicker">Pre-Flight Readiness</span>
            <div className="interview-flight-checklist">
              <div className={`interview-check-badge ${isCameraOk ? "is-ok" : "is-warn"}`}>
                <CopilotIcon name={isCameraOk ? "check" : "alert"} size={14} />
                <span>{cameraEnabled ? (cameraStatus === "ready" ? "Camera Ready" : "Camera Check") : "Camera Bypassed"}</span>
              </div>
              <div className={`interview-check-badge ${isMicOk ? "is-ok" : "is-warn"}`}>
                <CopilotIcon name={isMicOk ? "check" : "alert"} size={14} />
                <span>{microphoneEnabled ? (micStatus === "ready" ? "Audio Calibrated" : "Audio Check") : "Audio Bypassed"}</span>
              </div>
              <div className="interview-check-badge is-ok">
                <CopilotIcon name="check" size={14} />
                <span>Track: {FOCUS_TRACKS.find((t) => t.value === mode)?.label} ({questionCount} Qs)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="interview-flight-cta-wrapper">
          <Button
            type="button"
            className="interview-launch-btn"
            onClick={handleEnterInterviewRoom}
          >
            <span>Enter Interview Room</span>
            <CopilotIcon name="go" size={18} />
          </Button>
        </div>
      </footer>
    </div>
  );
}
