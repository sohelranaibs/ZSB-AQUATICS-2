import React, { useState } from 'react';
import {
  ShortcutActionId,
  ShortcutCategory,
  ShortcutDefinition,
  filterShortcutsCatalog,
} from '../utils/keyboardShortcuts.ts';
import { ActiveTab } from '../types/index.ts';
import { Keyboard, Search, X, Play, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExecuteShortcut: (action: ShortcutActionId, targetTab?: ActiveTab) => void;
}

const CATEGORIES: (ShortcutCategory | 'ALL')[] = [
  'ALL',
  'File, Save & Print',
  'Data Entry & Forms',
  'Sheet Navigation',
  'System Modals & Tools',
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  onExecuteShortcut,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ShortcutCategory | 'ALL'>('ALL');

  if (!isOpen) return null;

  const filteredShortcuts = filterShortcutsCatalog(searchQuery, selectedCategory);

  const groupedByCategory = filteredShortcuts.reduce<
    Record<string, ShortcutDefinition[]>
  >((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {});

  const handleTrigger = (item: ShortcutDefinition) => {
    if (item.action === 'CLOSE_ACTIVE_MODAL' || item.action === 'OPEN_SHORTCUTS_MODAL') {
      onClose();
      return;
    }
    onClose();
    onExecuteShortcut(item.action, item.targetTab);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="keyboard-shortcuts-modal-title"
      data-testid="keyboard-shortcuts-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-6 print:hidden"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
        {/* Top Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 border-b border-amber-500/40 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400 shrink-0">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="keyboard-shortcuts-modal-title"
                className="text-base sm:text-lg font-black tracking-wide text-white flex items-center gap-2"
              >
                <span>Global Keyboard Shortcuts &amp; Command Reference</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/40">
                  Ctrl + /
                </span>
              </h2>
              <p className="text-xs text-slate-300 mt-0.5">
                Fast data entry, voucher saving, PDF printing, and instant sheet switching across all 13 ledgers.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Keyboard Shortcuts Modal"
            data-testid="close-shortcuts-modal-btn"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search & Category Filter Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search keyboard shortcuts"
              placeholder="Search shortcuts (e.g. Ctrl+S, Print, Add Row, Packing)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    active
                      ? 'bg-slate-900 text-amber-400 border border-slate-800 shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {category === 'ALL' ? 'All Shortcuts' : category}
                </button>
              );
            })}
          </div>
        </div>

        {/* Shortcut Highlight Banner */}
        <div className="px-5 py-2.5 bg-amber-50/90 border-b border-amber-200 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Pro Tip:</strong> Press{' '}
              <kbd className="px-1.5 py-0.5 bg-white border border-amber-300 rounded font-mono text-[11px] font-bold shadow-2xs">
                Ctrl + S
              </kbd>{' '}
              anywhere to save the active form or sync all ledgers, and{' '}
              <kbd className="px-1.5 py-0.5 bg-white border border-amber-300 rounded font-mono text-[11px] font-bold shadow-2xs">
                Ctrl + P
              </kbd>{' '}
              to open Print / PDF preview.
            </span>
          </div>
          <span className="font-mono text-[11px] text-amber-800 font-bold">
            Mac users: Use ⌘ Cmd in place of Ctrl
          </span>
        </div>

        {/* Shortcuts Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 bg-white">
          {Object.keys(groupedByCategory).length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-xs">
              No keyboard shortcuts match &ldquo;{searchQuery}&rdquo;.
            </div>
          ) : (
            Object.entries(groupedByCategory).map(([category, items]) => (
              <div key={category} className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5 flex items-center justify-between">
                  <span>{category}</span>
                  <span className="text-[11px] font-mono text-slate-400 font-semibold">
                    {items.length} {items.length === 1 ? 'shortcut' : 'shortcuts'}
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      data-testid={`shortcut-item-${item.id}`}
                      className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-amber-50/40 hover:border-amber-300 transition"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">
                          {item.label}
                        </div>
                        <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">
                          {item.description}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                          {item.keys.map((k, idx) => (
                            <React.Fragment key={`${item.id}-key-${idx}`}>
                              <kbd className="px-2 py-1 bg-white border-b-2 border border-slate-300 rounded-md font-mono text-[11px] font-black text-slate-800 shadow-2xs">
                                {k}
                              </kbd>
                              {idx < item.keys.length - 1 && (
                                <span className="text-[10px] font-bold text-slate-400">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleTrigger(item)}
                          title={`Execute "${item.label}" now`}
                          aria-label={`Run ${item.label}`}
                          className="p-1.5 rounded-lg bg-slate-900 hover:bg-amber-500 text-amber-400 hover:text-slate-950 transition cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Bottom Footer */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded font-mono text-[11px] font-bold text-slate-800">
              Esc
            </kbd>
            <span>at any time to close active modals or dialogs.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
