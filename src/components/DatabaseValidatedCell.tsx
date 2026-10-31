import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, RotateCcw, Edit3 } from 'lucide-react';
import { FieldValidationResult } from '../utils/databaseFieldValidation.ts';

interface DatabaseValidatedCellProps {
  recordId: string;
  fieldKey: string;
  rawValue: string | number | undefined;
  displayNode: React.ReactNode;
  validation: FieldValidationResult;
  hasDraftOverride: boolean;
  align?: 'left' | 'right' | 'center';
  className?: string;
  alwaysShowInput?: boolean;
  inputPlaceholder?: string;
  onDraftChange: (recordId: string, fieldKey: string, nextRawValue: string) => void;
  onCommitValid: (
    recordId: string,
    fieldKey: string,
    parsedValue: string | number | undefined
  ) => void;
  onClearDraft: (recordId: string, fieldKey: string) => void;
}

export const DatabaseValidatedCell: React.FC<DatabaseValidatedCellProps> = ({
  recordId,
  fieldKey,
  rawValue,
  displayNode,
  validation,
  hasDraftOverride,
  align = 'left',
  className = '',
  alwaysShowInput = false,
  inputPlaceholder = '',
  onDraftChange,
  onCommitValid,
  onClearDraft,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const isInvalid = !validation.isValid;
  const showInput = alwaysShowInput || isEditing || isInvalid;

  const stringValue =
    hasDraftOverride
      ? validation.rawValue
      : rawValue === undefined || rawValue === null
      ? ''
      : String(rawValue);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextVal = e.target.value;
    onDraftChange(recordId, fieldKey, nextVal);
  };

  const handleCommitOrBlur = () => {
    setIsEditing(false);
    if (validation.isValid && hasDraftOverride) {
      onCommitValid(recordId, fieldKey, validation.parsedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (validation.isValid) {
        setIsEditing(false);
        if (hasDraftOverride) {
          onCommitValid(recordId, fieldKey, validation.parsedValue);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      onClearDraft(recordId, fieldKey);
    }
  };

  const alignClass =
    align === 'right'
      ? 'text-right'
      : align === 'center'
      ? 'text-center'
      : 'text-left';

  return (
    <td
      data-testid={`db-cell-${recordId}-${fieldKey}`}
      data-validation-status={isInvalid ? 'invalid' : 'valid'}
      className={`px-1 py-1.5 align-middle transition-colors ${alignClass} ${
        isInvalid
          ? 'bg-rose-100/95 border-2 border-rose-600 text-rose-950 ring-2 ring-rose-500/30'
          : className
      }`}
    >
      {showInput ? (
        <div className="space-y-1">
          <div
            className={`flex items-center gap-1 ${
              align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'
            }`}
          >
            <input
              ref={inputRef}
              type="text"
              data-testid={`db-cell-input-${recordId}-${fieldKey}`}
              aria-label={`Edit ${validation.label} for ${recordId}`}
              aria-invalid={isInvalid}
              placeholder={inputPlaceholder || validation.expectedFormatLabel}
              value={stringValue}
              onChange={handleInputChange}
              onBlur={handleCommitOrBlur}
              onKeyDown={handleKeyDown}
              className={`px-1 py-0.5 text-[11px] font-mono font-bold rounded transition focus:outline-none ${
                alwaysShowInput
                  ? 'text-right w-14'
                  : align === 'right'
                  ? 'text-right w-20'
                  : 'text-left w-full min-w-[65px]'
              } ${
                isInvalid
                  ? 'bg-rose-50 border-2 border-rose-600 text-rose-950 placeholder-rose-400 focus:ring-2 focus:ring-rose-600'
                  : alwaysShowInput
                  ? 'bg-amber-50 border border-amber-300 text-amber-950 focus:ring-2 focus:ring-teal-500 focus:bg-white'
                  : 'bg-white border-2 border-blue-600 text-slate-900 focus:ring-2 focus:ring-blue-500'
              }`}
            />
            {isInvalid && hasDraftOverride && (
              <button
                type="button"
                data-testid={`db-cell-reset-${recordId}-${fieldKey}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsEditing(false);
                  onClearDraft(recordId, fieldKey);
                }}
                title="Revert invalid input to saved value"
                aria-label={`Revert invalid ${validation.label} input`}
                className="p-1 rounded bg-rose-700 hover:bg-rose-800 text-white shrink-0 cursor-pointer shadow-xs"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>

          {isInvalid && (
            <div
              data-testid={`db-cell-error-${recordId}-${fieldKey}`}
              role="alert"
              className={`flex items-start gap-1 text-[10px] font-bold text-rose-900 bg-rose-200/90 border border-rose-400 px-1 py-0.5 rounded leading-tight ${
                align === 'right' ? 'justify-end text-right' : 'justify-start text-left'
              }`}
            >
              <AlertTriangle className="w-3 h-3 text-rose-700 shrink-0 mt-0.5" />
              <span>{validation.errorMessage || `Expected ${validation.expectedFormatLabel}`}</span>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          data-testid={`db-cell-trigger-${recordId}-${fieldKey}`}
          onClick={() => {
            onDraftChange(
              recordId,
              fieldKey,
              rawValue === undefined || rawValue === null ? '' : String(rawValue)
            );
            setIsEditing(true);
          }}
          title={`Click to edit ${validation.label} (${validation.expectedFormatLabel})`}
          className={`group/cell relative w-full inline-flex items-center rounded px-0.5 py-0.5 hover:bg-blue-100/70 hover:ring-1 hover:ring-blue-300 transition cursor-text leading-tight ${
            align === 'right'
              ? 'justify-end text-right whitespace-nowrap'
              : align === 'center'
              ? 'justify-center text-center'
              : 'justify-start text-left'
          }`}
        >
          <span className={align === 'right' ? 'whitespace-nowrap' : 'break-words'}>
            {displayNode}
          </span>
          <Edit3 className="w-2.5 h-2.5 text-blue-600 hidden group-hover/cell:inline-block ml-0.5 shrink-0" />
        </button>
      )}
    </td>
  );
};
