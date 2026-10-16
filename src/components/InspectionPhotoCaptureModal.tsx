import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  RefreshCw, 
  Check, 
  X, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw,
  Zap,
  ChevronRight,
  Undo2,
  ExternalLink,
  Video,
  Shield,
  ShieldCheck
} from 'lucide-react';
import { 
  saveInspectionPhotosToServer,
  getCameraPermissionDecision,
  saveCameraPermissionDecision,
  clearCameraPermissionDecision,
  CameraPermissionDecision
} from '../utils/storage';

// Helper device check (kept for compatibility)
export const isMobileOrTabletDevice = (): boolean => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/.test(ua);
  const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const isMobileOrTabletScreen = typeof window.innerWidth === 'number' && window.innerWidth <= 1024;
  return isMobileUA || isIPadOS || (hasTouch && isMobileOrTabletScreen);
};

export type InspectionPhotoSlot = 'frontImage' | 'oppositeSideImage' | 'backImage' | 'motorSideImage';

export interface PhotoSlotConfig {
  id: InspectionPhotoSlot;
  index: number;
  label: string;
  shortName: string;
  guideText: string;
  tip: string;
}

export const INSPECTION_PHOTO_SLOTS: PhotoSlotConfig[] = [
  {
    id: 'frontImage',
    index: 1,
    label: 'Front Image',
    shortName: 'Front View',
    guideText: 'Capture front view of the tricycle showing headlight, windshield, and front body number stencil.',
    tip: 'Ensure headlight & front body number are clearly visible.',
  },
  {
    id: 'oppositeSideImage',
    index: 2,
    label: 'Opposite Side Image',
    shortName: 'Opposite Side',
    guideText: 'Capture sidecar passenger entrance, sidecar wheel cover, and municipal color code paint.',
    tip: 'Capture full sidecar body & wheel cover.',
  },
  {
    id: 'backImage',
    index: 3,
    label: 'Back Image',
    shortName: 'Rear & Plate',
    guideText: 'Capture rear view showing tail light, stop light, plate number, rear body number, and reflector.',
    tip: 'Ensure plate number, rear lights & rear body number are legible.',
  },
  {
    id: 'motorSideImage',
    index: 4,
    label: 'Motor Side Image',
    shortName: 'Motor Side',
    guideText: 'Capture driver motorcycle side showing engine stencil, standard muffler/silencer, and side mirror.',
    tip: 'Ensure muffler, engine profile & side mirrors are captured.',
  },
];

interface InspectionPhotoCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPhotos: {
    frontImage?: string;
    oppositeSideImage?: string;
    backImage?: string;
    motorSideImage?: string;
  };
  onSavePhotos: (photos: {
    frontImage?: string;
    oppositeSideImage?: string;
    backImage?: string;
    motorSideImage?: string;
  }) => void;
  initialSlot?: InspectionPhotoSlot;
  bodyNumber?: string;
  onCompleteAndTransferToPayment?: (photos: {
    frontImage?: string;
    oppositeSideImage?: string;
    backImage?: string;
    motorSideImage?: string;
  }) => void;
}

export const InspectionPhotoCaptureModal: React.FC<InspectionPhotoCaptureModalProps> = ({
  isOpen,
  onClose,
  currentPhotos,
  onSavePhotos,
  initialSlot = 'frontImage',
  bodyNumber = '',
  onCompleteAndTransferToPayment,
}) => {
  const [workingPhotos, setWorkingPhotos] = useState(currentPhotos);
  const [activeSlotId, setActiveSlotId] = useState<InspectionPhotoSlot>(initialSlot);
  const [previewSnapshot, setPreviewSnapshot] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [isVirtualStream, setIsVirtualStream] = useState<boolean>(false);
  const [completedAll, setCompletedAll] = useState<boolean>(false);

  // Camera permission decision: only prompts once, remembers answer permanently
  const [permissionDecision, setPermissionDecision] = useState<CameraPermissionDecision>(() => getCameraPermissionDecision());
  const [showPermissionPrompt, setShowPermissionPrompt] = useState<boolean>(false);

  // Continuous capture settings
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [shutterFlash, setShutterFlash] = useState<boolean>(false);
  const [lastCapturedSlot, setLastCapturedSlot] = useState<InspectionPhotoSlot | null>(null);
  const [hudMessage, setHudMessage] = useState<{
    title: string;
    subtitle: string;
    icon?: 'success' | 'info';
  } | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<{ url: string; title: string } | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hudTimeoutRef = useRef<any>(null);
  const virtualCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const virtualAnimRef = useRef<number | null>(null);

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  // Trigger quick shutter feedback (audio tone + haptic vibration)
  const triggerShutterFeedback = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(40);
      } catch {}
    }
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const now = ctx.currentTime;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.005, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch {}
  };

  // Helper to safely attach a MediaStream to the video element
  const attachStream = async (stream: MediaStream) => {
    streamRef.current = stream;
    setIsCameraActive(true);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute('playsinline', 'true');
      videoRef.current.setAttribute('autoplay', 'true');
      videoRef.current.muted = true;
      try {
        await videoRef.current.play();
      } catch (err) {
        console.warn('Video play attempt notice:', err);
      }
    }
  };

  // Stop video stream & animation
  const stopCamera = () => {
    if (virtualAnimRef.current) {
      cancelAnimationFrame(virtualAnimRef.current);
      virtualAnimRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setIsVirtualStream(false);
  };

  // Start calibrated Virtual Inspection Camera Stream (instant seamless fallback if hardware/iframe unavailable)
  const startVirtualInspectionStream = () => {
    stopCamera();

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    virtualCanvasRef.current = canvas;

    let frame = 0;
    const renderVirtualFeed = () => {
      frame++;
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
      const dateStr = now.toLocaleDateString('en-US');

      // Background simulated outdoor inspection bay
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Subtle inspection lane grid lines
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Center vehicle inspection calibration box
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 3;
      ctx.strokeRect(240, 100, 800, 500);

      // Corner targets
      const corners = [
        [240, 100],
        [1040, 100],
        [240, 600],
        [1040, 600],
      ];
      ctx.fillStyle = '#f59e0b';
      corners.forEach(([cx, cy]) => {
        ctx.fillRect(cx - 10, cy - 10, 20, 20);
      });

      // Center Crosshair
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(640 - 40, 350);
      ctx.lineTo(640 + 40, 350);
      ctx.moveTo(640, 350 - 40);
      ctx.lineTo(640, 350 + 40);
      ctx.stroke();

      // Telemetry Overlay
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(20, 20, 480, 70);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(20, 20, 480, 70);

      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('MTFRB INSPECTION FEED [SIMULATED]', 35, 48);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px monospace';
      ctx.fillText(`${dateStr} ${timeStr} • BODY #${bodyNumber || '000'}`, 35, 74);

      // Target Label
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      const slot = INSPECTION_PHOTO_SLOTS.find((s) => s.id === activeSlotId);
      ctx.fillText(`TARGET: ${(slot?.shortName || 'ANGLE').toUpperCase()}`, 640, 385);
      ctx.textAlign = 'start';

      virtualAnimRef.current = requestAnimationFrame(renderVirtualFeed);
    };

    renderVirtualFeed();

    try {
      const stream = (canvas as any).captureStream(25);
      attachStream(stream);
      setIsVirtualStream(true);
      setIsCameraActive(true);
    } catch (e) {
      console.error('Virtual capture stream error:', e);
    }
  };

  // Camera access handlers
  const handleAllowPermission = () => {
    saveCameraPermissionDecision('granted');
    setPermissionDecision('granted');
    setShowPermissionPrompt(false);
    forceCameraAccess('environment');
  };

  const handleDenyPermission = () => {
    saveCameraPermissionDecision('denied');
    setPermissionDecision('denied');
    setShowPermissionPrompt(false);
    startVirtualInspectionStream();
  };

  const handleResetPermission = () => {
    clearCameraPermissionDecision();
    setPermissionDecision(null);
    setShowPermissionPrompt(true);
    startVirtualInspectionStream();
  };

  // FORCE ACCESS CAMERA
  // Checks stored permission first: if denied, immediately uses virtual stream.
  // If granted, acquires physical camera with multiple fallbacks.
  const forceCameraAccess = async (mode: 'environment' | 'user' = facingMode) => {
    stopCamera();

    if (getCameraPermissionDecision() === 'denied') {
      startVirtualInspectionStream();
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      startVirtualInspectionStream();
      return;
    }

    try {
      // 1. Primary: Preferred facing mode with high resolution
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      await attachStream(stream);
      setIsVirtualStream(false);
    } catch (err1: any) {
      try {
        // 2. Fallback 1: Facing mode without resolution constraints
        const stream2 = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode },
          audio: false,
        });
        await attachStream(stream2);
        setIsVirtualStream(false);
      } catch (err2: any) {
        try {
          // 3. Fallback 2: Any video input device
          const stream3 = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          await attachStream(stream3);
          setIsVirtualStream(false);
        } catch (err3: any) {
          // Silent fallback: activate virtual camera stream so station is immediately functional
          startVirtualInspectionStream();
        }
      }
    }
  };

  // Sync photos and slot when opened: Check camera permission decision first
  useEffect(() => {
    if (isOpen) {
      setWorkingPhotos(currentPhotos);
      setActiveSlotId(initialSlot);
      setPreviewSnapshot(null);
      setCompletedAll(false);
      setLastCapturedSlot(null);
      setHudMessage(null);

      // Check stored permission decision: Only prompt once, and remember the answer
      const decision = getCameraPermissionDecision();
      setPermissionDecision(decision);

      if (decision === 'granted') {
        setShowPermissionPrompt(false);
        forceCameraAccess('environment');
      } else if (decision === 'denied') {
        setShowPermissionPrompt(false);
        startVirtualInspectionStream();
      } else {
        // Check browser permissions query if supported
        if (typeof navigator !== 'undefined' && (navigator as any).permissions?.query) {
          (navigator as any).permissions.query({ name: 'camera' as any }).then((status: any) => {
            if (status.state === 'granted') {
              saveCameraPermissionDecision('granted');
              setPermissionDecision('granted');
              setShowPermissionPrompt(false);
              forceCameraAccess('environment');
            } else if (status.state === 'denied') {
              saveCameraPermissionDecision('denied');
              setPermissionDecision('denied');
              setShowPermissionPrompt(false);
              startVirtualInspectionStream();
            } else {
              // Not determined yet: show MTFRB permission prompt once
              setShowPermissionPrompt(true);
              startVirtualInspectionStream();
            }
          }).catch(() => {
            setShowPermissionPrompt(true);
            startVirtualInspectionStream();
          });
        } else {
          // Show MTFRB permission prompt once
          setShowPermissionPrompt(true);
          startVirtualInspectionStream();
        }
      }
    } else {
      stopCamera();
      setShowPermissionPrompt(false);
    }
    return () => {
      stopCamera();
      if (hudTimeoutRef.current) {
        clearTimeout(hudTimeoutRef.current);
      }
      if (virtualAnimRef.current) {
        cancelAnimationFrame(virtualAnimRef.current);
      }
    };
  }, [isOpen, initialSlot]);

  // Listen to external permission updates
  useEffect(() => {
    const handlePermChange = (e: any) => {
      if (e && e.detail !== undefined) {
        setPermissionDecision(e.detail);
      }
    };
    window.addEventListener('mtfrb_camera_permission_changed', handlePermChange);
    return () => window.removeEventListener('mtfrb_camera_permission_changed', handlePermChange);
  }, []);

  // Current slot config
  const currentConfig = INSPECTION_PHOTO_SLOTS.find((s) => s.id === activeSlotId) || INSPECTION_PHOTO_SLOTS[0];
  const currentIndex = INSPECTION_PHOTO_SLOTS.findIndex((s) => s.id === activeSlotId);

  // Ensure video element always binds to active stream if mounted
  useEffect(() => {
    if (isOpen && !previewSnapshot && !completedAll && videoRef.current && streamRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.play().catch(() => {});
        setIsCameraActive(true);
      }
    }
  });

  // Toggle front/back camera
  const handleToggleFacingMode = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    if (permissionDecision === 'granted') {
      forceCameraAccess(newMode);
    }
  };

  // Compress & resize image to safe size (max 840px, JPEG quality 0.78)
  const compressImage = (sourceCanvas: HTMLCanvasElement | HTMLImageElement): string => {
    const maxDim = 840;
    let width = 'width' in sourceCanvas ? sourceCanvas.width : 800;
    let height = 'height' in sourceCanvas ? sourceCanvas.height : 600;

    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(sourceCanvas, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.78);
    }
    return '';
  };

  // Snap photo with immediate persistence
  const handleSnapPhoto = () => {
    if (!videoRef.current) return;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || (virtualCanvasRef.current ? virtualCanvasRef.current.width : 1280);
      canvas.height = video.videoHeight || (virtualCanvasRef.current ? virtualCanvasRef.current.height : 720);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      if (isVirtualStream && virtualCanvasRef.current) {
        ctx.drawImage(virtualCanvasRef.current, 0, 0, canvas.width, canvas.height);
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      const dataUrl = compressImage(canvas);
      if (!dataUrl) return;

      triggerShutterFeedback();
      setShutterFlash(true);
      setTimeout(() => setShutterFlash(false), 160);

      const updated = {
        ...workingPhotos,
        [activeSlotId]: dataUrl,
      };
      setWorkingPhotos(updated);
      setLastCapturedSlot(activeSlotId);
      onSavePhotos(updated);
      if (bodyNumber) {
        saveInspectionPhotosToServer(bodyNumber, updated);
      }

      if (autoAdvance) {
        const nextIndex = currentIndex + 1;
        if (nextIndex < INSPECTION_PHOTO_SLOTS.length) {
          const nextSlot = INSPECTION_PHOTO_SLOTS[nextIndex];
          setActiveSlotId(nextSlot.id);

          if (hudTimeoutRef.current) clearTimeout(hudTimeoutRef.current);
          setHudMessage({
            title: `✓ ${currentConfig.shortName} Captured!`,
            subtitle: `Next Angle (${nextIndex + 1}/4): ${nextSlot.shortName}`,
            icon: 'success',
          });
          hudTimeoutRef.current = setTimeout(() => {
            setHudMessage(null);
          }, 2200);
        } else {
          setCompletedAll(true);
          setHudMessage({
            title: '✓ All 4 Inspection Angles Complete!',
            subtitle: 'All vehicle photographs have been securely stored.',
            icon: 'success',
          });
        }
      } else {
        setPreviewSnapshot(dataUrl);
      }
    } catch (e) {
      console.error('Snapshot error:', e);
    }
  };

  // Retake previous angle with one tap
  const handleRetakeLast = () => {
    if (!lastCapturedSlot) return;
    setActiveSlotId(lastCapturedSlot);
    setCompletedAll(false);
    setPreviewSnapshot(null);
    const target = INSPECTION_PHOTO_SLOTS.find((s) => s.id === lastCapturedSlot);
    setHudMessage({
      title: `Retaking ${target?.shortName || 'Angle'}`,
      subtitle: 'Align vehicle in frame and tap capture.',
      icon: 'info',
    });
    setTimeout(() => setHudMessage(null), 2000);
  };

  // Handle manual file upload fallback
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const compressed = compressImage(img);
        if (compressed) {
          const updated = {
            ...workingPhotos,
            [activeSlotId]: compressed,
          };
          setWorkingPhotos(updated);
          setLastCapturedSlot(activeSlotId);
          onSavePhotos(updated);
          if (bodyNumber) {
            saveInspectionPhotosToServer(bodyNumber, updated);
          }

          if (autoAdvance) {
            const nextIndex = currentIndex + 1;
            if (nextIndex < INSPECTION_PHOTO_SLOTS.length) {
              const nextSlot = INSPECTION_PHOTO_SLOTS[nextIndex];
              setActiveSlotId(nextSlot.id);
              setHudMessage({
                title: `✓ ${currentConfig.shortName} Uploaded!`,
                subtitle: `Next Angle (${nextIndex + 1}/4): ${nextSlot.shortName}`,
                icon: 'success',
              });
              setTimeout(() => setHudMessage(null), 2200);
            } else {
              setCompletedAll(true);
            }
          } else {
            setPreviewSnapshot(compressed);
          }
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Switch to specific angle slot seamlessly
  const handleSelectSlot = (slotId: InspectionPhotoSlot) => {
    setActiveSlotId(slotId);
    setPreviewSnapshot(null);
    setCompletedAll(false);
    if (!isCameraActive) {
      forceCameraAccess(facingMode);
    }
  };

  // Manual Review: Reject & Retake
  const handleRejectSnapshot = () => {
    setPreviewSnapshot(null);
    if (!isCameraActive) {
      forceCameraAccess(facingMode);
    }
  };

  // Manual Review: Accept & Continue
  const handleAcceptSnapshot = () => {
    if (!previewSnapshot) return;

    const updated = {
      ...workingPhotos,
      [activeSlotId]: previewSnapshot,
    };
    setWorkingPhotos(updated);
    setPreviewSnapshot(null);
    setLastCapturedSlot(activeSlotId);
    onSavePhotos(updated);
    if (bodyNumber) {
      saveInspectionPhotosToServer(bodyNumber, updated);
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex < INSPECTION_PHOTO_SLOTS.length) {
      const nextSlot = INSPECTION_PHOTO_SLOTS[nextIndex];
      setActiveSlotId(nextSlot.id);
      if (!isCameraActive) {
        forceCameraAccess(facingMode);
      }
    } else {
      setCompletedAll(true);
    }
  };

  // Spacebar key shortcut to capture photo
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !previewSnapshot && !completedAll && isCameraActive) {
        e.preventDefault();
        handleSnapPhoto();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, previewSnapshot, completedAll, isCameraActive, activeSlotId, workingPhotos, autoAdvance]);

  // Count captured photos
  const capturedCount = Object.values(workingPhotos).filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* FIXED SIZE MODAL CARD: w-full max-w-xl - never enters fullscreen or resizes abruptly */}
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col relative">
        {/* ONE-TIME CAMERA PERMISSION PROMPT OVERLAY */}
        {showPermissionPrompt && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-sm w-full p-5 text-center space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-400/20">
                <Camera className="w-6 h-6" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                  Inspection Station Camera
                </span>
                <h3 className="text-base font-bold text-white mt-2">
                  Allow Camera Access?
                </h3>
                <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                  The MTFRB Inspection Station uses your camera to capture and certify the 4 required tricycle angles.
                </p>
                <div className="mt-3 p-2 bg-slate-800/80 rounded-xl border border-slate-700 text-[11px] text-teal-300 font-medium flex items-center justify-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                  <span>Your answer will be remembered permanently. You will not be prompted again.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleDenyPermission}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                >
                  Deny / Use Virtual
                </button>
                <button
                  type="button"
                  onClick={handleAllowPermission}
                  className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Allow Camera</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header Bar */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-teal-500/20 text-teal-400 rounded-lg">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <span>Vehicle Inspection Camera</span>
                {bodyNumber && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-400 text-slate-950 font-extrabold">
                    Body #{bodyNumber}
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Fixed-Size Continuous 4-Angle Capture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto-Advance Toggle */}
            <button
              type="button"
              onClick={() => setAutoAdvance(!autoAdvance)}
              className={`px-2 py-1 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer border ${
                autoAdvance
                  ? 'bg-amber-400/15 border-amber-400/50 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Toggle automatic progression to next angle"
            >
              <Zap className={`w-3 h-3 ${autoAdvance ? 'text-amber-400' : 'text-slate-500'}`} />
              <span className="hidden sm:inline">Auto-Next:</span>
              <span>{autoAdvance ? 'ON' : 'OFF'}</span>
            </button>

            <span className="text-xs font-bold px-2 py-1 rounded-full bg-slate-800 text-teal-300 border border-teal-500/30">
              {capturedCount}/4 Captured
            </span>

            <button
              type="button"
              onClick={() => {
                onSavePhotos(workingPhotos);
                if (bodyNumber) {
                  saveInspectionPhotosToServer(bodyNumber, workingPhotos);
                }
                onClose();
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close and save photos"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4 Angle Step Navigation Tabs */}
        <div className="grid grid-cols-4 bg-slate-950/80 border-b border-slate-800 text-xs shrink-0">
          {INSPECTION_PHOTO_SLOTS.map((slot, idx) => {
            const isCurrent = slot.id === activeSlotId && !completedAll;
            const isCaptured = Boolean(workingPhotos[slot.id]);

            return (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleSelectSlot(slot.id)}
                className={`py-2 px-1 text-center transition-all border-b-2 flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  isCurrent
                    ? 'border-amber-400 bg-amber-400/10 text-amber-300 font-bold'
                    : isCaptured
                    ? 'border-teal-500 text-teal-300 bg-teal-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="text-[10px] uppercase font-mono font-bold">{idx + 1}.</span>
                  <span className="truncate text-[11px] font-medium hidden sm:inline">{slot.shortName}</span>
                  {isCaptured ? (
                    <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : isCurrent ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {/* Current Angle Guide & Camera Tools Bar */}
        <div className="px-3.5 py-1.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-xs shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-mono text-amber-400 font-bold text-[11px]">
              ANGLE {currentIndex + 1}/4:
            </span>
            <span className="font-bold text-slate-100 truncate">{currentConfig.label}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Live stream status badge & permission status */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-[11px] font-bold border border-slate-700">
              <span className={`w-2 h-2 rounded-full ${isVirtualStream ? 'bg-sky-400' : 'bg-emerald-400 animate-pulse'}`} />
              <span className="text-slate-300">
                {isVirtualStream 
                  ? (permissionDecision === 'denied' ? 'Virtual (Denied)' : 'Virtual Sim') 
                  : 'Live Camera'}
              </span>
              {permissionDecision && (
                <button
                  type="button"
                  onClick={handleResetPermission}
                  className="text-[10px] text-amber-400/90 hover:text-amber-300 hover:underline ml-1 cursor-pointer font-normal"
                  title="Reset remembered camera permission to prompt again"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Flip camera */}
            <button
              type="button"
              onClick={handleToggleFacingMode}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              title="Flip camera (Front / Rear)"
            >
              <RefreshCw className="w-3 h-3" />
              <span className="hidden sm:inline">Flip</span>
            </button>

            {/* In-iframe direct tab opener */}
            {isInIframe && (
              <button
                type="button"
                onClick={() => window.open(window.location.href, '_blank')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                title="Open app in direct tab"
              >
                <ExternalLink className="w-3 h-3" />
                <span className="hidden sm:inline">New Tab</span>
              </button>
            )}
          </div>
        </div>

        {/* Viewfinder Area: STRICT FIXED SIZE - does NOT resize or enter fullscreen */}
        <div className="p-3 sm:p-4 flex flex-col items-center justify-center bg-slate-950 shrink-0">
          {/* Optical Shutter Flash effect */}
          {shutterFlash && (
            <div className="fixed inset-0 bg-white/85 z-40 pointer-events-none animate-out fade-out duration-150" />
          )}

          {/* Floating HUD feedback */}
          {hudMessage && (
            <div className="absolute top-16 z-30 px-3.5 py-1.5 bg-slate-900/95 backdrop-blur-md border border-amber-400/60 rounded-full shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <div>
                <span className="text-xs font-black text-amber-300 block">{hudMessage.title}</span>
                <span className="text-[10px] text-slate-200 block">{hudMessage.subtitle}</span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* RIGID FIXED SIZE CONTAINER: exactly w-full max-w-[500px] h-[320px] sm:h-[340px] */}
          {/* ========================================================================= */}
          <div className="relative w-full max-w-[500px] h-[320px] sm:h-[340px] mx-auto rounded-xl overflow-hidden bg-black border border-slate-800 flex items-center justify-center shrink-0">
            {previewSnapshot ? (
              /* Manual Review Snapshot */
              <div className="w-full h-full relative flex items-center justify-center bg-black">
                <img
                  src={previewSnapshot}
                  alt={currentConfig.label}
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-slate-900/80 text-[10px] font-bold text-amber-300 border border-amber-400/40">
                  {currentConfig.label} Review
                </div>
              </div>
            ) : completedAll ? (
              /* All 4 Photos Completed View */
              <div className="w-full h-full p-3 flex flex-col items-center justify-center text-center bg-slate-900">
                <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mb-1.5 border border-emerald-500/40">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-white">All 4 Photos Captured!</h4>
                <p className="text-[11px] text-slate-400 mb-2">
                  Tricycle Body #{bodyNumber} roadworthiness angles are stored.
                </p>
                <div className="grid grid-cols-4 gap-1.5 w-full max-w-sm mb-3">
                  {INSPECTION_PHOTO_SLOTS.map((s) => (
                    <div key={s.id} className="relative rounded overflow-hidden border border-slate-700 aspect-4/3 bg-slate-800">
                      {workingPhotos[s.id] ? (
                        <img src={workingPhotos[s.id]} alt={s.shortName} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-500">Empty</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSavePhotos(workingPhotos);
                      if (bodyNumber) {
                        saveInspectionPhotosToServer(bodyNumber, workingPhotos);
                      }
                      onClose();
                    }}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-colors"
                  >
                    <Check className="w-4 h-4 text-white" />
                    <span>Done & Return to Checklist</span>
                  </button>
                </div>
              </div>
            ) : (
              /* Continuous Live Camera Stream */
              <>
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className="w-full h-full object-cover"
                />

                {/* Tactical HUD Guides */}
                <div className="absolute inset-3 pointer-events-none border border-white/20 rounded-lg flex flex-col justify-between p-2">
                  <div className="flex justify-between items-start">
                    <div className="w-5 h-5 border-t-2 border-l-2 border-amber-400" />
                    <div className="w-5 h-5 border-t-2 border-r-2 border-amber-400" />
                  </div>

                  <div className="text-center pointer-events-none">
                    <div className="inline-block px-2.5 py-1 bg-slate-950/80 backdrop-blur-xs text-amber-300 font-bold text-[11px] rounded-lg border border-amber-400/40">
                      Target: {currentConfig.shortName}
                    </div>
                    <span className="block text-[10px] text-slate-300 mt-1 drop-shadow-sm">
                      {currentConfig.tip}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <div className="w-5 h-5 border-b-2 border-l-2 border-amber-400" />
                    <div className="w-5 h-5 border-b-2 border-r-2 border-amber-400" />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Controls Bar */}
          <div className="w-full max-w-[500px] mt-2.5 flex items-center justify-between gap-2">
            {/* File Upload Alternative */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              title="Upload photo from disk or gallery"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Center Action: Snap Photo or Review Buttons */}
            {previewSnapshot ? (
              <div className="flex items-center gap-2 flex-1 justify-center">
                <button
                  type="button"
                  onClick={handleRejectSnapshot}
                  className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={handleAcceptSnapshot}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center gap-1 shadow-md cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Accept & Continue</span>
                </button>
              </div>
            ) : completedAll ? (
              <button
                type="button"
                onClick={() => handleSelectSlot('frontImage')}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Retake Specific Angle</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSnapPhoto}
                className="flex-1 max-w-xs flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-400 to-amber-300 hover:from-amber-300 hover:to-amber-200 text-slate-950 font-black text-xs sm:text-sm rounded-full shadow-lg transition-all active:scale-95 cursor-pointer ring-2 ring-amber-400/30"
              >
                <Camera className="w-4 h-4" />
                <span className="truncate">
                  Snap Angle {currentIndex + 1}/4: {currentConfig.shortName}
                </span>
              </button>
            )}

            {/* Retake Last / Skip */}
            {lastCapturedSlot && !completedAll ? (
              <button
                type="button"
                onClick={handleRetakeLast}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-300 rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Retake the previous angle"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Retake</span>
              </button>
            ) : !completedAll ? (
              <button
                type="button"
                onClick={() => {
                  const nextIndex = (currentIndex + 1) % INSPECTION_PHOTO_SLOTS.length;
                  handleSelectSlot(INSPECTION_PHOTO_SLOTS[nextIndex].id);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                title="Skip to next angle"
              >
                <span className="hidden sm:inline">Skip</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        {/* Bottom Interactive Thumbnail Strip */}
        <div className="p-2.5 bg-slate-950 border-t border-slate-800 shrink-0">
          <div className="flex items-center justify-between pb-1.5 text-[11px] text-slate-400 px-1">
            <span>Tap angle to inspect or retake:</span>
            <span className="text-amber-400 font-bold">
              {capturedCount === 4 ? 'All 4 angles ready' : `${4 - capturedCount} angle(s) remaining`}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {INSPECTION_PHOTO_SLOTS.map((slot) => {
              const photoData = workingPhotos[slot.id];
              const isSelected = slot.id === activeSlotId && !completedAll;

              return (
                <div
                  key={slot.id}
                  onClick={() => handleSelectSlot(slot.id)}
                  className={`p-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-400/15 border-amber-400 shadow-sm ring-1 ring-amber-400/40'
                      : photoData
                      ? 'bg-slate-900 border-teal-500/40 hover:border-teal-400'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="w-8 h-8 rounded bg-slate-800 shrink-0 overflow-hidden flex items-center justify-center border border-slate-700 relative">
                    {photoData ? (
                      <>
                        <img src={photoData} alt={slot.shortName} className="w-full h-full object-cover" />
                        <span className="absolute bottom-0 right-0 bg-emerald-600 text-white rounded-full p-0.5">
                          <Check className="w-2 h-2" />
                        </span>
                      </>
                    ) : (
                      <Camera className="w-3 h-3 text-slate-500" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-bold text-slate-200 block truncate">
                      {slot.shortName}
                    </span>
                    <span
                      className={`text-[9px] block font-semibold ${
                        photoData ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {photoData ? 'Saved' : 'Pending'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
