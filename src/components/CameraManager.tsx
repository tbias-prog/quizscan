import { useState, useRef, useEffect } from 'react';
import { Camera, X, Check, RefreshCw, RotateCw, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '@/src/lib/utils';

interface CameraManagerProps {
  onCapture: (image: string) => void;
  onCancel: () => void;
  title?: string;
  confirmLabel?: string;
}

export default function CameraManager({ onCapture, onCancel, title = "Scanner View", confirmLabel = "Confirm Capture" }: CameraManagerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [facingMode]);

  const startCamera = async () => {
    stopCamera(); // Ensure previous stream is stopped
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsActive(true);
        setError(null);
      }
    } catch (err: any) {
      console.error("Camera access error:", err);
      setError("Unable to access camera. Please check permissions or upload a file directly.");
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
    }
    setIsActive(false);
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
      }
    }
  };

  const retake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const confirmCapture = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCapturedImage(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl"
      >
        <input 
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        <div className="flex items-center justify-between border-b border-slate-800 p-4">
          <h3 className="text-lg font-medium text-white flex items-center gap-2">
            <Camera className="w-5 h-5 text-blue-400" />
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {!capturedImage && (
              <>
                <button 
                  onClick={triggerFileSelect}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-1.5 px-3"
                  title="Upload Image File"
                >
                  <Upload className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold uppercase">Upload</span>
                </button>
                <button 
                  onClick={toggleCamera}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-1.5 px-3"
                  title="Switch Camera"
                >
                  <RotateCw className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">{facingMode === 'environment' ? 'Back' : 'Front'}</span>
                </button>
              </>
            )}
            <button 
              onClick={onCancel}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative aspect-[4/3] bg-black">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center text-slate-300 gap-4 bg-slate-950">
              <p className="text-sm font-bold text-rose-400">{error}</p>
              <button
                onClick={triggerFileSelect}
                className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 px-6 py-3 font-semibold text-white transition-all shadow-lg shadow-blue-900/20 active:scale-95"
              >
                <Upload className="w-4 h-4" />
                Upload Image File
              </button>
            </div>
          ) : capturedImage ? (
            <img src={capturedImage} alt="Captured" className="h-full w-full object-contain" />
          ) : (
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="h-full w-full object-cover"
            />
          )}
          
          <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-6 flex items-center justify-center gap-4 bg-slate-900">
          {!capturedImage ? (
            <button
              onClick={capture}
              disabled={!isActive}
              className="flex items-center gap-2 rounded-full bg-blue-600 px-8 py-3 font-bold text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500 active:scale-95 disabled:opacity-50 transition-all"
            >
              <div className="w-4 h-4 rounded-full bg-white animate-pulse" />
              Capture Document
            </button>
          ) : (
            <>
              <button
                onClick={retake}
                className="flex items-center gap-2 rounded-full bg-slate-800 px-6 py-2.5 font-semibold text-white hover:bg-slate-700 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
              <button
                onClick={confirmCapture}
                className="flex items-center gap-2 rounded-full bg-green-600 px-8 py-2.5 font-bold text-white hover:bg-green-500 transition-all"
              >
                <Check className="w-4 h-4" />
                {confirmLabel}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
