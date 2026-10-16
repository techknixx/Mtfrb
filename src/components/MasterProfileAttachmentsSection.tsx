import React, { useState, useRef } from 'react';
import { 
  Upload, 
  FileText, 
  CheckCircle2, 
  Eye, 
  Download, 
  Trash2, 
  AlertCircle, 
  FileUp, 
  Image as ImageIcon,
  Paperclip,
  Check,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { 
  TricycleFranchiseRecord, 
  DocumentAttachment, 
  MASTER_PROFILE_ATTACHMENT_CONFIGS, 
  AttachmentFieldConfig 
} from '../types';
import { DocumentAttachmentViewerModal } from './DocumentAttachmentViewerModal';

interface MasterProfileAttachmentsSectionProps {
  record: Partial<TricycleFranchiseRecord>;
  isEditable?: boolean;
  onUpdateAttachment?: (field: keyof TricycleFranchiseRecord, attachment: DocumentAttachment | null) => void;
  accentTheme?: 'emerald' | 'amber' | 'teal' | 'blue';
}

export const MasterProfileAttachmentsSection: React.FC<MasterProfileAttachmentsSectionProps> = ({
  record,
  isEditable = false,
  onUpdateAttachment,
  accentTheme = 'teal',
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedViewerAttachment, setSelectedViewerAttachment] = useState<{
    attachment: DocumentAttachment;
    label: string;
    field: keyof TricycleFranchiseRecord;
  } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const categories = ['ALL', 'Clearances & Permits', 'LTO Motor Documents', 'Identification & Tax', 'Civil Registry & Legal'];

  const filteredConfigs = MASTER_PROFILE_ATTACHMENT_CONFIGS.filter(cfg => {
    if (activeCategory === 'ALL') return true;
    return cfg.category === activeCategory;
  });

  const getAttachment = (field: keyof TricycleFranchiseRecord): DocumentAttachment | null => {
    return (record[field] as DocumentAttachment) || null;
  };

  const totalUploadedCount = MASTER_PROFILE_ATTACHMENT_CONFIGS.filter(cfg => {
    return !!record[cfg.field];
  }).length;

  const handleFileUpload = (field: keyof TricycleFranchiseRecord, file: File) => {
    setUploadError(null);
    setUploadingField(field as string);

    // Validate size (limit 15MB)
    if (file.size > 15 * 1024 * 1024) {
      setUploadError(`File "${file.name}" exceeds 15MB limit.`);
      setUploadingField(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const attachment: DocumentAttachment = {
        name: file.name,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
        dataUrl,
        uploadedAt: Date.now(),
      };

      if (onUpdateAttachment) {
        onUpdateAttachment(field, attachment);
      }
      setUploadingField(null);
    };

    reader.onerror = () => {
      setUploadError(`Failed to read file "${file.name}".`);
      setUploadingField(null);
    };

    reader.readAsDataURL(file);
  };

  const handleFileChange = (field: keyof TricycleFranchiseRecord, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(field, file);
    }
    // reset input
    e.target.value = '';
  };

  const handleRemoveAttachment = (field: keyof TricycleFranchiseRecord) => {
    if (onUpdateAttachment) {
      onUpdateAttachment(field, null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes || isNaN(bytes)) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* Header Summary & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-teal-400">
              Master Profile Attachments
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">
              {totalUploadedCount} of {MASTER_PROFILE_ATTACHMENT_CONFIGS.length} Uploaded
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Official municipal compliance documents, clearances, LTO receipts, and certificates.
          </p>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {categories.map(cat => {
            const isCurrent = activeCategory === cat;
            const count = cat === 'ALL' 
              ? MASTER_PROFILE_ATTACHMENT_CONFIGS.filter(c => !!record[c.field]).length
              : MASTER_PROFILE_ATTACHMENT_CONFIGS.filter(c => c.category === cat && !!record[c.field]).length;
            const totalInCat = cat === 'ALL'
              ? MASTER_PROFILE_ATTACHMENT_CONFIGS.length
              : MASTER_PROFILE_ATTACHMENT_CONFIGS.filter(c => c.category === cat).length;

            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                  isCurrent
                    ? 'bg-teal-500 text-slate-950 shadow font-bold'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                }`}
              >
                <span>{cat === 'ALL' ? 'All (11)' : cat}</span>
                <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${
                  isCurrent ? 'bg-slate-900/30 text-slate-950 font-bold' : 'bg-slate-900 text-slate-400'
                }`}>
                  {count}/{totalInCat}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {uploadError && (
        <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{uploadError}</span>
          <button 
            type="button" 
            onClick={() => setUploadError(null)} 
            className="ml-auto text-rose-400 hover:underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Grid of 11 Attachment Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {filteredConfigs.map((cfg, idx) => {
          const attachment = getAttachment(cfg.field);
          const isUploaded = !!attachment;
          const isUploading = uploadingField === cfg.field;

          const isImage = attachment && (
            attachment.fileType?.startsWith('image/') ||
            attachment.dataUrl?.startsWith('data:image/') ||
            /\.(jpg|jpeg|png|webp|gif)$/i.test(attachment.name)
          );

          return (
            <div
              key={cfg.key}
              className={`rounded-xl border transition-all p-3.5 flex flex-col justify-between relative overflow-hidden ${
                isUploaded
                  ? 'bg-slate-900/90 border-teal-500/40 shadow-sm'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-slate-800 border border-slate-700 text-slate-300 text-[10px] font-mono flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <h4 className="text-xs font-bold text-white leading-tight">
                      {cfg.label}
                    </h4>
                  </div>

                  {isUploaded ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-full shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                      Uploaded
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full shrink-0">
                      Not Attached
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400 leading-snug mb-3">
                  {cfg.description}
                </p>
              </div>

              {/* Card Body: Attachment Preview or Empty Drop Zone */}
              <div className="mt-auto pt-2 border-t border-slate-800/80">
                {isUploaded && attachment ? (
                  <div className="flex items-center justify-between gap-2 bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isImage ? (
                        <div 
                          className="w-10 h-10 rounded-md overflow-hidden bg-slate-800 border border-slate-700 shrink-0 cursor-pointer group relative"
                          onClick={() => setSelectedViewerAttachment({ attachment, label: cfg.label, field: cfg.field })}
                        >
                          <img 
                            src={attachment.dataUrl} 
                            alt={cfg.label} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-md bg-teal-950/60 border border-teal-800/60 text-teal-400 flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200 truncate max-w-[130px]">
                          {attachment.name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {formatFileSize(attachment.fileSize)}
                        </p>
                      </div>
                    </div>

                    {/* Actions for Uploaded */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedViewerAttachment({ attachment, label: cfg.label, field: cfg.field })}
                        className="p-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 transition-colors cursor-pointer"
                        title="View attachment in full screen"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      <a
                        href={attachment.dataUrl}
                        download={attachment.name}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>

                      {isEditable && onUpdateAttachment && (
                        <button
                          type="button"
                          onClick={() => handleRemoveAttachment(cfg.field)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                          title="Remove this attachment"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {isEditable ? (
                      <div>
                        <input
                          type="file"
                          id={`file-input-${cfg.key}`}
                          ref={el => (fileInputRefs.current[cfg.key] = el)}
                          onChange={e => handleFileChange(cfg.field, e)}
                          accept="image/*,application/pdf"
                          className="hidden"
                        />

                        <label
                          htmlFor={`file-input-${cfg.key}`}
                          className={`flex items-center justify-center gap-2 py-2 px-3 border border-dashed rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            isUploading
                              ? 'bg-slate-800 border-teal-500 text-teal-300'
                              : 'bg-slate-950/40 border-slate-700 hover:border-teal-500/80 hover:bg-teal-500/5 text-slate-300 hover:text-teal-300'
                          }`}
                        >
                          {isUploading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-400" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5 text-teal-400" />
                              <span>Choose / Drop File</span>
                            </>
                          )}
                        </label>
                      </div>
                    ) : (
                      <div className="py-2 px-3 bg-slate-950/40 rounded-lg border border-slate-800 text-center">
                        <span className="text-[11px] text-slate-500 italic">
                          No document attached
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Attachment Viewer Modal */}
      {selectedViewerAttachment && (
        <DocumentAttachmentViewerModal
          attachment={selectedViewerAttachment.attachment}
          label={selectedViewerAttachment.label}
          isReadOnly={!isEditable}
          onClose={() => setSelectedViewerAttachment(null)}
          onDelete={
            isEditable && onUpdateAttachment
              ? () => {
                  handleRemoveAttachment(selectedViewerAttachment.field);
                  setSelectedViewerAttachment(null);
                }
              : undefined
          }
        />
      )}
    </div>
  );
};
