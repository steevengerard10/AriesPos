import React from 'react';
import { createPortal } from 'react-dom';
import { X, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-7xl',
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn('modal-content w-full max-h-[80vh] flex flex-col overflow-hidden', sizeClasses[size])}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="btn-ghost btn p-1.5 rounded-lg">
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-slate-700 flex items-center justify-end gap-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

interface ConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  type = 'danger',
}) => {
  if (!isOpen) return null;

  const icons = {
    danger: <AlertCircle size={24} className="text-red-400" />,
    warning: <AlertTriangle size={24} className="text-amber-400" />,
    info: <Info size={24} className="text-blue-400" />,
  };

  const btnClass = {
    danger: 'btn-danger',
    warning: 'btn-warning',
    info: 'btn-primary',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div className="modal-content max-w-sm shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            {icons[type]}
            <div className="flex-1">
              <h3 className="text-base font-semibold text-white mb-1">{title}</h3>
              <p className="text-sm text-slate-400">{message}</p>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button className="btn-secondary btn btn-sm" onClick={onCancel}>
              Cancelar
            </button>
            <button className={cn('btn btn-sm', btnClass[type])} onClick={onConfirm}>
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
