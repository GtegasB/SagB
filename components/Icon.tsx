
import React, { useState, useEffect } from 'react';

// Estilo Base: Stroke Width 1.5, Round Caps/Joins (Phosphor Style)
const BaseIcon = ({ d, className }: { d: string, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d={d} />
  </svg>
);

// Alterado para Seta Direita Preenchida (Filled)
export const SendIcon = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="currentColor" 
    className={className}
  >
    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
  </svg>
);

export const PaperclipIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" className={className} />
);

export const SearchIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607z" className={className} />
);

export const NewChatIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M12 4.5v15m7.5-7.5h-15" className={className} />
);

export const BotIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M12 2a2 2 0 0 1 2 2v2h-4V4a2 2 0 0 1 2-2zM6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2zM9 14h6" className={className} />
);

export const EyeIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" className={className} />
);

export const EyeOffIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22" className={className} />
);

export const ChevronRightIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M9 18l6-6-6-6" className={className} />
);

export const ChevronDownIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M6 9l6 6 6-6" className={className} />
);

export const BackIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M19 12H5M12 19l-7-7 7-7" className={className} />
);

export const XIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M18 6L6 18M6 6l12 12" className={className} />
);

// Novos Ícones para Governança V5.0
export const BookIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" className={className} />
);

export const CloudUploadIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M7 16a4 4 0 0 1-.88-7.903A5 5 0 1 1 15.9 6L16 6a5 5 0 0 1 1 9.9M12 13l0 9m0 0l-3-3m3 3l3-3" className={className} />
);

export const CloudDownloadIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M7 10v6l5 5 5-5v-6M12 21V3" className={className} />
);

export const LockIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" className={className} />
);

export const ScaleIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 0 0 6.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" className={className} />
);

// Ícones de Áudio (V5.0 - Voice Input)
export const MicIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" className={className} />
);

export const StopCircleIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M9 9h6v6H9z M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" className={className} />
);

export const FolderIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" className={className} />
);

export const FileTextIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" className={className} />
);

export const PlusIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M12 4v16m8-8H4" className={className} />
);

export const TrashIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className={className} />
);

// V6.0 - Edição de Mensagem
export const PencilIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" className={className} />
);

export const CheckIcon = ({ className }: { className?: string }) => (
  <BaseIcon d="M20 6L9 17l-5-5" className={className} />
);
