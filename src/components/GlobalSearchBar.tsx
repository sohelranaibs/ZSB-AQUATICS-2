import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext.tsx';
import {
  searchAllRecords,
  SearchResultItem,
  SearchResultModule,
} from '../utils/globalSearch.ts';
import {
  Search,
  X,
  FileSpreadsheet,
  Printer,
  ChevronRight,
  ExternalLink,
  Package,
  ShoppingCart,
  CreditCard,
  Receipt,
  Tag,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { ActiveTab } from '../types/index.ts';

interface GlobalSearchBarProps {
  className?: string;
}

export const GlobalSearchBar: React.FC<GlobalSearchBarProps> = ({ className = '' }) => {
  const {
    purchases,
    packings,
    payments,
    otherCosts,
    supplierCredits,
    activeTab,
    setActiveTab,
    openPrintModal,
    showToast,
  } = useApp();

  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedModule, setSelectedModule] = useState<'all' | SearchResultModule>('all');
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search dataset
  const dataset = useMemo(
    () => ({
      purchases,
      packings,
      payments,
      otherCosts,
      supplierCredits,
    }),
    [purchases, packings, payments, otherCosts, supplierCredits]
  );

  // Computed search results (lazy-evaluated only when dropdown is open or query is non-empty)
  const searchResults = useMemo(() => {
    if (!isOpen && !query.trim()) {
      return {
        items: [],
        totalMatches: 0,
        countsByModule: {
          all: 0,
          purchase: 0,
          packing: 0,
          payment: 0,
          other_cost: 0,
          supplier_credit: 0,
        },
      };
    }
    return searchAllRecords(query, dataset, {
      filterModule: selectedModule,
      limit: 25,
    });
  }, [isOpen, query, dataset, selectedModule]);

  // Handle outside click and global Escape to close dropdown reliably
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  // Close search dropdown whenever the active sheet tab changes
  useEffect(() => {
    setIsOpen(false);
  }, [activeTab]);

  // Keyboard navigation inside search dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
      return;
    }

    if (!isOpen && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setIsOpen(true);
      return;
    }

    const itemCount = searchResults.items.length;
    if (itemCount === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % itemCount);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev <= 0 ? itemCount - 1 : prev - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < itemCount) {
      e.preventDefault();
      handleSelectItem(searchResults.items[selectedIndex]);
    }
  };

  // Action when a result item is clicked or activated
  const handleSelectItem = (item: SearchResultItem) => {
    setIsOpen(false);

    // Switch to corresponding sheet
    setActiveTab(item.targetTab);
    showToast(
      `Navigated to ${item.moduleLabel} sheet for ${item.primaryTitle} (${item.secondaryTitle}).`
    );
  };

  // Quick Print voucher action from search result
  const handleQuickPrint = (e: React.MouseEvent, item: SearchResultItem) => {
    e.stopPropagation();
    setIsOpen(false);

    if (item.module === 'purchase') {
      openPrintModal({
        type: 'purchase',
        title: `Purchase Challan · ${item.primaryTitle}`,
        data: item.rawRecord,
      });
      showToast(`Opened Print Preview for Purchase Challan ${item.primaryTitle}`);
    } else if (item.module === 'packing') {
      openPrintModal({
        type: 'packing',
        title: `Export Packing List · ${item.primaryTitle}`,
        data: item.rawRecord,
      });
      showToast(`Opened Print Preview for Packing List ${item.primaryTitle}`);
    } else if (item.module === 'payment') {
      openPrintModal({
        type: 'payment',
        title: `Payment Voucher · ${item.primaryTitle}`,
        data: item.rawRecord,
      });
      showToast(`Opened Print Preview for Payment Voucher ${item.primaryTitle}`);
    } else {
      setActiveTab(item.targetTab);
    }
  };

  const handleApplyPresetQuery = (presetText: string) => {
    setQuery(presetText);
    setSelectedModule('all');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const clearSearch = () => {
    setQuery('');
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  const getModuleIcon = (module: SearchResultModule) => {
    switch (module) {
      case 'purchase':
        return <ShoppingCart className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
      case 'packing':
        return <Package className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
      case 'payment':
        return <CreditCard className="w-3.5 h-3.5 text-purple-400 shrink-0" />;
      case 'other_cost':
        return <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
      case 'supplier_credit':
        return <Tag className="w-3.5 h-3.5 text-teal-400 shrink-0" />;
    }
  };

  const moduleTabs: { id: 'all' | SearchResultModule; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: searchResults.countsByModule.all },
    { id: 'purchase', label: 'Purchases', count: searchResults.countsByModule.purchase },
    { id: 'packing', label: 'Packings', count: searchResults.countsByModule.packing },
    { id: 'payment', label: 'Payments', count: searchResults.countsByModule.payment },
    { id: 'other_cost', label: 'Expenses', count: searchResults.countsByModule.other_cost },
  ];

  return (
    <div
      ref={containerRef}
      onBlur={(e) => {
        const nextFocusTarget = e.relatedTarget as Node | null;
        if (!nextFocusTarget || !containerRef.current?.contains(nextFocusTarget)) {
          setIsOpen(false);
        }
      }}
      className={`relative flex-1 w-full min-w-0 max-w-lg ${className}`}
    >
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-slate-400 flex items-center">
          <Search className="w-4 h-4 text-[#1D6CE0]" />
        </div>

        <input
          id="header-global-search-input"
          data-testid="header-global-search-input"
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="global-search-results-list"
          aria-label="Global cross-database search for invoices, suppliers, and tracking IDs"
          placeholder="Search invoices, suppliers, tracking IDs... (Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full bg-white text-slate-900 placeholder-slate-400 text-xs rounded-lg pl-9 pr-20 py-1.5 border border-[#CBD8E6] hover:border-sky-300 focus:bg-white focus:border-[#1D6CE0] focus:ring-1 focus:ring-[#1D6CE0] focus:outline-none transition-all font-sans shadow-2xs"
        />

        {/* Clear Button & Keyboard Shortcut Badge */}
        <div className="absolute right-2.5 flex items-center space-x-1.5">
          {query ? (
            <button
              type="button"
              onClick={clearSearch}
              title="Clear search query"
              aria-label="Clear search query"
              data-testid="clear-global-search-btn"
              className="zsb-clear-icon-btn p-0.5 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-slate-500 bg-white border border-slate-200 rounded">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* Floating Results Popover */}
      {isOpen && (
        <div
          ref={dropdownRef}
          id="global-search-results-list"
          data-testid="global-search-dropdown"
          className="absolute left-0 mt-1.5 w-[94vw] sm:w-[540px] md:w-[620px] max-w-[calc(100vw-1.5rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-[500px] flex flex-col"
        >
          {/* Header Bar with Module Tabs */}
          <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
            <div className="flex items-center space-x-1 shrink-0">
              {moduleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedModule(tab.id)}
                  data-testid={`search-tab-${tab.id}`}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer flex items-center space-x-1 whitespace-nowrap ${
                    selectedModule === tab.id
                      ? 'bg-[#00897b] text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1 rounded-full font-mono ${
                        selectedModule === tab.id
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="text-[10px] text-slate-500 font-mono hidden md:block">
              {searchResults.totalMatches} match{searchResults.totalMatches === 1 ? '' : 'es'}
            </div>
          </div>

          {/* Results List */}
          <div className="overflow-y-auto flex-1 p-2 space-y-1.5 bg-white">
            {query.trim().length === 0 ? (
              // Empty State with Helpful Search Prompts
              <div className="p-4 text-center">
                <div className="inline-flex p-2.5 bg-teal-50 text-[#00897b] rounded-full mb-2">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-900">
                  Global Enterprise Trade Ledger Search
                </h4>
                <p className="text-[11px] text-slate-500 mt-1 max-w-sm mx-auto">
                  Instantly locate any invoice number, supplier name, flight number, shipping mark, or contact number.
                </p>

                {/* Popular Quick-Search Suggestions */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Quick picks:</span>
                  {['PUR-', 'PKG-', 'PAY-', 'Abdullah', 'Uzzal', 'AAD', 'CZ392'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleApplyPresetQuery(tag)}
                      className="px-2 py-0.5 text-[11px] font-mono bg-slate-50 hover:bg-teal-50 text-[#00897b] rounded border border-slate-200 hover:border-[#00897b] cursor-pointer transition font-semibold"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : searchResults.items.length === 0 ? (
              // No Results Found State
              <div className="p-6 text-center">
                <p className="text-xs font-semibold text-slate-700">
                  No records found matching "{query}"
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Try searching with an invoice prefix (e.g. <span className="font-mono text-[#00897b] font-semibold">PUR-</span>, <span className="font-mono text-[#1877d2] font-semibold">PKG-</span>), supplier name, or flight ID.
                </p>
              </div>
            ) : (
              // List of Matches
              searchResults.items.map((item, idx) => {
                const isFocused = idx === selectedIndex;
                return (
                  <div
                    key={`${item.module}-${item.id}`}
                    role="option"
                    aria-selected={isFocused}
                    data-testid={`search-result-item-${item.primaryTitle}`}
                    onClick={() => handleSelectItem(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col gap-1.5 ${
                      isFocused
                        ? 'bg-teal-50/70 border-[#00897b] shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200'
                    }`}
                  >
                    {/* Top Row: Module Badge + Primary Title + Date + Amount */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0 flex-1">
                        {getModuleIcon(item.module)}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border whitespace-nowrap shrink-0 ${item.badgeColor}`}
                        >
                          {item.moduleLabel}
                        </span>
                        <span className="font-mono text-xs font-bold text-[#0f172a] whitespace-nowrap shrink-0">
                          {item.primaryTitle}
                        </span>
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          {item.secondaryTitle}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 text-right">
                        <span className="text-[11px] font-mono text-slate-500">
                          {item.date}
                        </span>
                        <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                          {item.amountFormatted}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Subtitle + Metric Details */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-1">
                      <span className="truncate max-w-md text-slate-600">
                        {item.subtitle}
                      </span>

                      {item.details.length > 0 && (
                        <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-600">
                          {item.details.map((detail, dIdx) => (
                            <span
                              key={dIdx}
                              className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-700"
                            >
                              {detail}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Matched Fields Tags & Quick Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[10px]">
                      <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                        <span className="text-slate-400">Matched:</span>
                        {item.matchedFields.map((field, fIdx) => (
                          <span
                            key={fIdx}
                            className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 font-medium"
                          >
                            {field}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center space-x-2 shrink-0">
                        {/* Quick Print Button */}
                        {(item.module === 'purchase' ||
                          item.module === 'packing' ||
                          item.module === 'payment') && (
                          <button
                            type="button"
                            onClick={(e) => handleQuickPrint(e, item)}
                            title="Print / PDF Voucher Preview"
                            data-testid={`quick-print-${item.primaryTitle}`}
                            className="text-slate-600 hover:text-[#00897b] flex items-center space-x-0.5 px-1.5 py-0.5 rounded hover:bg-slate-100 cursor-pointer transition"
                          >
                            <Printer className="w-3 h-3" />
                            <span className="hidden sm:inline">Print Slip</span>
                          </button>
                        )}

                        <span className="text-[#00897b] font-semibold flex items-center space-x-0.5">
                          <span>View Sheet</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Bar: Keyboard Hints */}
          <div className="bg-slate-50 px-3 py-1.5 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <span>
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700">↑</kbd>{' '}
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700">↓</kbd> to navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700">Enter</kbd> to jump
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded font-mono text-slate-700">Esc</kbd> to close
              </span>
            </div>
            <span className="text-[#00897b] font-mono font-semibold">Real-time Cross-DB Index</span>
          </div>
        </div>
      )}
    </div>
  );
};
