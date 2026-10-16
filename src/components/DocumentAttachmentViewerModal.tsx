import React, { useState } from 'react';
import { 
  X, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Image as ImageIcon, 
  Trash2, 
  ExternalLink,
  Calendar,
  HardDrive
} from 'lucide-react';
import { DocumentAttachment } from '../types';

interface DocumentAttachmentViewerModalProps {
  attachment: DocumentAttachment | null;
  label: string;
  onClose: () => void;
  onDelete?: () => void;
  isReadOnly?: boolean;
}

export const DocumentAttachmentViewerModal: React.FC<DocumentAttachmentViewerModalProps> = ({
  attachment,
  label,
  onClose,
  onDelete,
  isReadOnly = false,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);

  if (!attachment) return null;

  const isImage = attachment.fileType?.startsWith('image/') || 
    attachment.dataUrl?.startsWith('data:image/') ||
    /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(attachment.name);

  const isPdf = attachment.fileType?.includes('pdf') || 
    attachment.dataUrl?.startsWith('data:application/pdf') ||
    /\.pdf$/i.test(attachment.name);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || isNaN(bytes)) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = attachment.dataUrl;
      link.download = attachment.name || `${label.toLowerCase().replace(/\s+/g, '_')}_attachment`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      window.open(attachment.dataUrl, '_blank');
    }
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-white">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center shrink-0">
              {isImage ? <ImageIcon className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  Document Attachment
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  {formatFileSize(attachment.fileSize)}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white truncate max-w-md">
                {label}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-md">
                {attachment.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Download attachment file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </button>

            {!isReadOnly && onDelete && !confirmDelete && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/40 text-rose-300 border border-rose-600/40 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Remove attachment"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}

            {!isReadOnly && onDelete && confirmDelete && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    onDelete();
                    onClose();
                  }}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar for image manipulation */}
        {isImage && (
          <div className="flex items-center justify-between px-6 py-2 bg-slate-950/60 border-b border-slate-800 text-xs text-slate-300">
            <span className="text-[11px] text-slate-400">
              Zoom: {Math.round(zoom * 100)}% | Rotation: {rotation}°
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRotate}
                className="p-1.5 rounded hover:bg-slate-800 cursor-pointer"
                title="Rotate 90° Clockwise"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              {(zoom !== 1 || rotation !== 0) && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2 py-1 text-[11px] text-teal-400 hover:underline cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Viewer Content Area */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center min-h-[300px] max-h-[65vh] bg-slate-950/50">
          {isImage ? (
            <div className="flex items-center justify-center w-full h-full overflow-hidden">
              <img
                src={attachment.dataUrl}
                alt={label}
                referrerPolicy="no-referrer"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.15s ease-out',
                }}
                className="max-h-[58vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-800 select-none"
              />
            </div>
          ) : isPdf ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 py-8 text-center">
              <iframe
                src={attachment.dataUrl}
                title={label}
                className="w-full h-[55vh] rounded-lg border border-slate-700 bg-white"
              />
              <a
                href={attachment.dataUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs text-teal-400 hover:underline font-semibold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open PDF in separate browser tab
              </a>
            </div>
          ) : (
            <div className="text-center py-12 space-y-4">
              <div className="w-20 h-20 rounded-2xl bg-slate-800 border border-slate-700 text-teal-400 flex items-center justify-center mx-auto">
                <FileText className="w-10 h-10" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">{attachment.name}</h3>
                <p className="text-xs text-slate-400 mt-1">{attachment.fileType || 'Document file'}</p>
                <p className="text-xs text-slate-400">{formatFileSize(attachment.fileSize)}</p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shadow-lg"
              >
                <Download className="w-4 h-4" />
                Download and Open File
              </button>
            </div>
          )}
        </div>

        {/* Footer Meta */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              Uploaded:{' '}
              {attachment.uploadedAt
                ? new Date(attachment.uploadedAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : 'Recorded'}
            </span>
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-500" />
              {formatFileSize(attachment.fileSize)}
            </span>
          </div>

          <span className="text-[11px] text-slate-500 font-mono">
            {attachment.fileType || 'application/octet-stream'}
          </span>
        </div>
      </div>
    </div>
  );
};
