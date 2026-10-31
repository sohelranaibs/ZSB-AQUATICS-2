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

  // Computed search results
  const searchResults = useMemo(() => {
    return searchAllRecords(query, dataset, {
      filterModule: selectedModule,
      limit: 25,
    });
  }, [query, dataset, selectedModule]);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <div ref={containerRef} className={`relative flex-1 max-w-lg min-w-[200px] ${className}`}>
      {/* Search Input Box */}
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none text-slate-400 flex items-center">
          <Search className="w-4 h-4 text-amber-400/90" />
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
          className="w-full bg-slate-950/90 hover:bg-slate-950 text-slate-100 placeholder-slate-400 text-xs rounded-lg pl-9 pr-20 py-1.5 border border-slate-700 hover:border-amber-500/60 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 focus:outline-none transition-all shadow-inner font-sans"
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
              className="p-0.5 text-slate-400 hover:text-slate-100 rounded hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium text-amber-300/80 bg-slate-800/80 border border-slate-700/80 rounded">
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
          className="absolute right-0 mt-1.5 w-[94vw] sm:w-[540px] md:w-[620px] max-w-[calc(100vw-1.5rem)] bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[500px] flex flex-col backdrop-blur-md"
        >
          {/* Header Bar with Module Tabs */}
          <div className="bg-slate-950 px-3 py-2 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto text-xs shrink-0">
            <div className="flex items-center space-x-1 shrink-0">
              {moduleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedModule(tab.id)}
                  data-testid={`search-tab-${tab.id}`}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer flex items-center space-x-1 whitespace-nowrap ${
                    selectedModule === tab.id
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span
                      className={`text-[10px] px-1 rounded-full font-mono ${
                        selectedModule === tab.id
                          ? 'bg-slate-950/20 text-slate-950'
                          : 'bg-slate-800 text-slate-300'
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
          <div className="overflow-y-auto flex-1 p-2 space-y-1.5">
            {query.trim().length === 0 ? (
              // Empty State with Helpful Search Prompts
              <div className="p-4 text-center">
                <div className="inline-flex p-2.5 bg-amber-500/10 text-amber-400 rounded-full mb-2">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h4 className="text-xs font-bold text-slate-200">
                  Global Enterprise Trade Ledger Search
                </h4>
                <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                  Instantly locate any invoice number, supplier name, flight number, shipping mark, or contact number.
                </p>

                {/* Popular Quick-Search Suggestions */}
                <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold">Quick picks:</span>
                  {['PUR-', 'PKG-', 'PAY-', 'Abdullah', 'Uzzal', 'AAD', 'CZ392'].map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleApplyPresetQuery(tag)}
                      className="px-2 py-0.5 text-[11px] font-mono bg-slate-800 hover:bg-slate-700 text-amber-300 rounded border border-slate-700 cursor-pointer transition"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : searchResults.items.length === 0 ? (
              // No Results Found State
              <div className="p-6 text-center">
                <p className="text-xs font-semibold text-slate-300">
                  No records found matching "{query}"
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Try searching with an invoice prefix (e.g. <span className="font-mono text-amber-400">PUR-</span>, <span className="font-mono text-blue-400">PKG-</span>), supplier name, or flight ID.
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
                        ? 'bg-slate-800/90 border-amber-500/70 shadow-md'
                        : 'bg-slate-900/80 hover:bg-slate-800/50 border-slate-800/80'
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
                        <span className="font-mono text-xs font-black text-amber-300 whitespace-nowrap shrink-0">
                          {item.primaryTitle}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 truncate">
                          {item.secondaryTitle}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 text-right">
                        <span className="text-[11px] font-mono text-slate-400">
                          {item.date}
                        </span>
                        <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                          {item.amountFormatted}
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Subtitle + Metric Details */}
                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 gap-1">
                      <span className="truncate max-w-md text-slate-300">
                        {item.subtitle}
                      </span>

                      {item.details.length > 0 && (
                        <div className="flex items-center space-x-1.5 font-mono text-[10px] text-slate-400">
                          {item.details.map((detail, dIdx) => (
                            <span
                              key={dIdx}
                              className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-slate-300"
                            >
                              {detail}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Matched Fields Tags & Quick Actions */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[10px]">
                      <div className="flex items-center space-x-1 flex-wrap gap-y-1">
                        <span className="text-slate-500">Matched:</span>
                        {item.matchedFields.map((field, fIdx) => (
                          <span
                            key={fIdx}
                            className="bg-amber-400/10 text-amber-300 px-1.5 py-0.2 rounded border border-amber-500/20 font-medium"
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
                            className="text-slate-400 hover:text-amber-300 flex items-center space-x-0.5 px-1.5 py-0.5 rounded hover:bg-slate-800 cursor-pointer transition"
                          >
                            <Printer className="w-3 h-3" />
                            <span className="hidden sm:inline">Print Slip</span>
                          </button>
                        )}

                        <span className="text-amber-400/80 hover:text-amber-300 flex items-center space-x-0.5 font-semibold">
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
          <div className="bg-slate-950 px-3 py-1.5 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <span>
                <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-300">↑</kbd>{' '}
                <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-300">↓</kbd> to navigate
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-300">Enter</kbd> to jump
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-slate-800 rounded font-mono text-slate-300">Esc</kbd> to close
              </span>
            </div>
            <span className="text-amber-400/80 font-mono">Real-time Cross-DB Index</span>
          </div>
        </div>
      )}
    </div>
  );
};
