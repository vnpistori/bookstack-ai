import { useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpDown,
  Pencil,
  Trash2,
  Search,
  X,
  Edit3,
  Trash,
  ChevronDown,
  ChevronUp,
  ListFilter,
} from "lucide-react";
import { api } from "../../services/api";
import BulkEditModal from "../BulkEditModal";
import MobileBookItem from "./MobileBookItem";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmationContext";
import { getCoverUrl } from "../../utils/imageUtils";

export default function BooksTable({
  books,
  onUpdate,
  onDelete,
  onEdit,
  tableState,
  setTableState,
}) {
  // Destructure state from parent (or use defaults if not provided - though App.jsx provides them)
  const {
    sortConfig = { key: "order", direction: "asc" },
    searchTerm = "",
    selectedClasses = [],
    selectedCategories = [],
    selectedStatuses = [],
    selectedPriorities = [],
    selectedAvailabilities = [],
    yearRange,
  } = tableState || {};

  const [selectedBooks, setSelectedBooks] = useState([]);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  // Clear selection when filters change (to avoid operating on hidden items? or keep them? better clear to be safe)
  useEffect(() => {
    setSelectedBooks([]);
  }, [
    searchTerm,
    selectedClasses,
    selectedCategories,
    selectedStatuses,
    selectedPriorities,
    selectedAvailabilities,
    yearRange,
  ]);

  // Calculate year bounds first
  const yearBounds = useMemo(() => {
    const years = books.map((b) => b.year).filter((y) => y && y > 0);
    if (years.length === 0) return [1800, 2030];
    return [Math.min(...years), Math.max(...years)];
  }, [books]);

  // Initialize yearRange if null (on first load)
  useEffect(() => {
    if (!yearRange) {
      setTableState((prev) => ({ ...prev, yearRange: yearBounds }));
    }
  }, [yearBounds, yearRange, setTableState]);

  const safeYearRange = yearRange || yearBounds;

  // Get unique values for filters
  const uniqueClasses = useMemo(() => {
    return [...new Set(books.map((b) => b.book_class).filter(Boolean))].sort();
  }, [books]);

  const uniqueCategories = useMemo(() => {
    // Dynamic: If classes are selected, only show categories from those classes
    let source = books;
    if (selectedClasses.length > 0) {
      source = books.filter((b) => selectedClasses.includes(b.book_class));
    }
    return [...new Set(source.map((b) => b.category).filter(Boolean))].sort();
  }, [books, selectedClasses]);

  const uniqueStatuses = useMemo(() => {
    return [...new Set(books.map((b) => b.status).filter(Boolean))].sort();
  }, [books]);

  const uniquePriorities = useMemo(() => {
    return [...new Set(books.map((b) => b.priority).filter(Boolean))].sort();
  }, [books]);

  const uniqueAvailabilities = useMemo(() => {
    return [
      ...new Set(books.map((b) => b.availability).filter(Boolean)),
    ].sort();
  }, [books]);

  // Apply filters
  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchTitle = book.title?.toLowerCase().includes(search);
        const matchAuthor = book.author?.toLowerCase().includes(search);
        if (!matchTitle && !matchAuthor) return false;
      }

      // Class filter
      if (
        selectedClasses.length > 0 &&
        !selectedClasses.includes(book.book_class)
      ) {
        return false;
      }

      // Category filter
      if (
        selectedCategories.length > 0 &&
        !selectedCategories.includes(book.category)
      ) {
        return false;
      }

      // Status filter
      if (
        selectedStatuses.length > 0 &&
        !selectedStatuses.includes(book.status)
      ) {
        return false;
      }

      // Priority filter
      if (
        selectedPriorities.length > 0 &&
        !selectedPriorities.includes(book.priority)
      ) {
        return false;
      }

      // Availability filter
      if (
        selectedAvailabilities.length > 0 &&
        !selectedAvailabilities.includes(book.availability)
      ) {
        return false;
      }

      // Year range filter
      if (
        book.year &&
        (book.year < safeYearRange[0] || book.year > safeYearRange[1])
      ) {
        return false;
      }

      return true;
    });
  }, [
    books,
    searchTerm,
    selectedClasses,
    selectedCategories,
    selectedStatuses,
    selectedPriorities,
    selectedAvailabilities,
    safeYearRange,
  ]);

  const sortedBooks = useMemo(() => {
    return [...filteredBooks].sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // For 'order' column, treat 0, null, undefined, and empty string as "no order"
      if (sortConfig.key === "order") {
        const isAEmpty =
          aVal == null || aVal === 0 || aVal === "" || aVal === "-";
        const isBEmpty =
          bVal == null || bVal === 0 || bVal === "" || bVal === "-";

        if (isAEmpty && isBEmpty) return 0;
        if (isAEmpty) return 1; // a goes to end
        if (isBEmpty) return -1; // b goes to end
      } else {
        // For other columns, only check null/undefined
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return 1;
        if (bVal == null) return -1;
      }

      // Normal comparison for non-null values
      if (aVal < bVal) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  }, [filteredBooks, sortConfig]);

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setTableState((prev) => ({ ...prev, sortConfig: { key, direction } }));
  };

  const handleDelete = (id) => {
    confirm({
      title: "Excluir Livro",
      description: "Tem certeza que deseja apagar este livro?",
      confirmText: "Excluir",
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.delete(`/books/${id}`);
          onDelete(id);
          addToast({ type: "success", message: "Livro deletado com sucesso!" });
        } catch (err) {
          addToast({ type: "error", message: "Erro ao deletar livro." });
          console.error(err);
        }
      },
    });
  };

  // --- Bulk Actions Handlers ---

  const toggleSelectBook = (id) => {
    setSelectedBooks((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id],
    );
  };

  const toggleSelectAll = () => {
    if (selectedBooks.length === sortedBooks.length) {
      setSelectedBooks([]);
    } else {
      setSelectedBooks(sortedBooks.map((b) => b.id));
    }
  };

  const handleBulkDelete = () => {
    confirm({
      title: "Exclusão em Massa",
      description: `Tem certeza que deseja apagar ${selectedBooks.length} livros? Esta ação não pode ser desfeita.`,
      confirmText: "Sim, Excluir",
      isDanger: true,
      onConfirm: async () => {
        setIsBulkProcessing(true);
        try {
          // Process sequentially
          for (const id of selectedBooks) {
            await api.delete(`/books/${id}`);
            onDelete(id); // Update parent list locally
          }
          setSelectedBooks([]);
          addToast({
            type: "success",
            message: "Livros apagados com sucesso!",
          });
        } catch (err) {
          console.error(err);
          addToast({
            type: "error",
            message: "Houve um erro ao apagar alguns livros.",
          });
        } finally {
          setIsBulkProcessing(false);
        }
      },
    });
  };

  const handleBulkSave = async (updates) => {
    setShowBulkEdit(false);
    setIsBulkProcessing(true);
    try {
      // Identify books to update
      const booksToUpdate = books.filter((b) => selectedBooks.includes(b.id));

      for (const book of booksToUpdate) {
        const updatedBook = { ...book, ...updates };
        await api.put(`/books/${book.id}`, updatedBook);
      }

      // Trigger a refresh from parent to get updated data
      if (onUpdate) onUpdate();
      else window.location.reload(); // Fallback if no refresh handler

      setSelectedBooks([]);
      addToast({ type: "success", message: "Atualização em massa concluída!" });
    } catch (err) {
      console.error(err);
      addToast({ type: "error", message: "Erro ao atualizar livros." });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const toggleFilter = (value, listName) => {
    // Generic toggler based on list name in state
    const currentList = tableState[listName] || [];
    let newList;
    if (currentList.includes(value)) {
      newList = currentList.filter((v) => v !== value);
    } else {
      newList = [...currentList, value];
    }
    setTableState((prev) => ({ ...prev, [listName]: newList }));
  };

  const clearAllFilters = () => {
    setTableState((prev) => ({
      ...prev,
      searchTerm: "",
      selectedClasses: [],
      selectedCategories: [],
      selectedStatuses: [],
      selectedPriorities: [],
      selectedAvailabilities: [],
      yearRange: yearBounds,
    }));
  };

  const hasActiveFilters =
    searchTerm ||
    selectedClasses.length > 0 ||
    selectedCategories.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedPriorities.length > 0 ||
    selectedAvailabilities.length > 0 ||
    safeYearRange[0] !== yearBounds[0] ||
    safeYearRange[1] !== yearBounds[1];

  const columns = [
    { key: "select", label: "", width: "w-[40px]" }, // Selection Column
    { key: "order", label: "#", width: "w-[3%]" },
    { key: "cover", label: "Capa", width: "w-[5%]" },
    { key: "title", label: "Título", width: "w-[18%]" },
    { key: "author", label: "Autor", width: "w-[10%]" },
    { key: "year", label: "Ano", width: "w-[4%]" },
    { key: "type", label: "Tipo", width: "w-[5%]" },
    { key: "priority", label: "Prior.", width: "w-[5%]" },
    { key: "score", label: "Score", width: "w-[4%]" },
    { key: "status", label: "Status", width: "w-[6%]" },
    { key: "book_class", label: "Classe", width: "w-[10%]" },
    { key: "category", label: "Categoria", width: "w-[8%]" },
    { key: "availability", label: "Disp.", width: "w-[5%]" },
    { key: "google_rating", label: "★ Google", width: "w-[6%]" },
    { key: "rating", label: "★", width: "w-[4%]" },
    { key: "date_read", label: "Lido", width: "w-[8%]" },
  ];

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden transition-all">
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/50"
          onClick={() => setShowFilters(!showFilters)}
        >
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <ListFilter
                size={16}
                className="text-purple-600 dark:text-purple-400"
              />
              Filtros
            </h3>
            {hasActiveFilters && (
              <span className="bg-purple-100 text-purple-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                Ativos
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllFilters();
                }}
                className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-500 hover:underline z-10"
              >
                Limpar
              </button>
            )}
            {showFilters ? (
              <ChevronUp size={16} className="text-slate-400" />
            ) : (
              <ChevronDown size={16} className="text-slate-400" />
            )}
          </div>
        </div>

        {/* Collapsible Content */}
        {showFilters && (
          <div className="p-4 pt-0 space-y-3 border-t border-slate-100 dark:border-neutral-800 animate-slide-down">
            {/* Search - Full Width */}
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-400 dark:text-neutral-500 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar por Título ou Autor..."
                  aria-label="Buscar livros por título ou autor"
                  value={searchTerm}
                  onChange={(e) =>
                    setTableState((prev) => ({
                      ...prev,
                      searchTerm: e.target.value,
                    }))
                  }
                  className="w-full pl-10 pr-10 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-neutral-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                />
                {searchTerm && (
                  <button
                    aria-label="Limpar busca"
                    onClick={() =>
                      setTableState((prev) => ({ ...prev, searchTerm: "" }))
                    }
                    className="absolute right-3 top-2.5 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>

            {/* Classes - Full Width Row */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-neutral-400 mb-1.5">
                Classes
              </label>
              <div className="flex flex-wrap gap-1.5 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded p-2">
                {uniqueClasses.map((cls) => (
                  <button
                    key={cls}
                    onClick={() => toggleFilter(cls, "selectedClasses")}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      selectedClasses.includes(cls)
                        ? "bg-purple-600 text-white"
                        : "bg-white dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-600 border border-slate-200 dark:border-transparent"
                    }`}
                  >
                    {cls}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories - Full Width Row */}
            <div>
              <label className="block text-xs text-slate-500 dark:text-neutral-400 mb-1.5">
                Categorias
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded p-2 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-neutral-600">
                {uniqueCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleFilter(cat, "selectedCategories")}
                    className={`text-xs px-2 py-1 rounded transition-colors ${
                      selectedCategories.includes(cat)
                        ? "bg-purple-600 text-white"
                        : "bg-white dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-600 border border-slate-200 dark:border-transparent"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Status, Priority, Availability, Year - Single Row */}
            <div className="grid gap-2 grid-cols-1 md:grid-cols-4 lg:grid-cols-[0.65fr_1.5fr_1.5fr_1fr]">
              {/* Status */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-neutral-400 mb-1.5">
                  Status
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {uniqueStatuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => toggleFilter(status, "selectedStatuses")}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        selectedStatuses.includes(status)
                          ? "bg-purple-600 text-white"
                          : "bg-slate-50 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-600 border border-slate-200 dark:border-transparent"
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-neutral-400 mb-1.5">
                  Prioridade
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {uniquePriorities.map((prio) => (
                    <button
                      key={prio}
                      onClick={() => toggleFilter(prio, "selectedPriorities")}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        selectedPriorities.includes(prio)
                          ? "bg-purple-600 text-white"
                          : "bg-slate-50 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-600 border border-slate-200 dark:border-transparent"
                      }`}
                    >
                      {prio}
                    </button>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-neutral-400 mb-1.5">
                  Disponibilidade
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {uniqueAvailabilities.map((avail) => (
                    <button
                      key={avail}
                      onClick={() =>
                        toggleFilter(avail, "selectedAvailabilities")
                      }
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        selectedAvailabilities.includes(avail)
                          ? "bg-purple-600 text-white"
                          : "bg-slate-50 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-600 border border-slate-200 dark:border-transparent"
                      }`}
                    >
                      {avail}
                    </button>
                  ))}
                </div>
              </div>

              {/* Year Range - Dual Thumb Slider */}
              <div>
                <label className="block text-xs text-slate-500 dark:text-neutral-400 mb-1.5">
                  Ano de lançamento: {safeYearRange[0]} - {safeYearRange[1]}
                </label>
                <div className="relative pt-2 pb-1 px-1">
                  {/* Track background */}
                  <div className="absolute top-1/2 left-0 right-0 h-1 bg-slate-200 dark:bg-neutral-700 rounded-full -translate-y-1/2"></div>

                  {/* Active range */}
                  <div
                    className="absolute top-1/2 h-1 bg-purple-600 rounded-full -translate-y-1/2"
                    style={{
                      left: `${
                        ((safeYearRange[0] - yearBounds[0]) /
                          (yearBounds[1] - yearBounds[0] || 1)) *
                        100
                      }%`,
                      right: `${
                        100 -
                        ((safeYearRange[1] - yearBounds[0]) /
                          (yearBounds[1] - yearBounds[0] || 1)) *
                          100
                      }%`,
                    }}
                  ></div>

                  {/* Min slider */}
                  <input
                    aria-label="Ano mínimo"
                    type="range"
                    min={yearBounds[0]}
                    max={yearBounds[1]}
                    value={safeYearRange[0]}
                    onChange={(e) => {
                      const newMin = parseInt(e.target.value);
                      if (newMin <= safeYearRange[1]) {
                        setTableState((prev) => ({
                          ...prev,
                          yearRange: [newMin, safeYearRange[1]],
                        }));
                      }
                    }}
                    className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                    style={{
                      zIndex:
                        safeYearRange[0] >
                        yearBounds[0] + (yearBounds[1] - yearBounds[0]) * 0.5
                          ? 5
                          : 3,
                      left: 0,
                    }}
                  />

                  {/* Max slider */}
                  <input
                    aria-label="Ano máximo"
                    type="range"
                    min={yearBounds[0]}
                    max={yearBounds[1]}
                    value={safeYearRange[1]}
                    onChange={(e) => {
                      const newMax = parseInt(e.target.value);
                      if (newMax >= safeYearRange[0]) {
                        setTableState((prev) => ({
                          ...prev,
                          yearRange: [safeYearRange[0], newMax],
                        }));
                      }
                    }}
                    className="absolute w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-600 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-600 [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white"
                    style={{
                      zIndex:
                        safeYearRange[1] <
                        yearBounds[0] + (yearBounds[1] - yearBounds[0]) * 0.5
                          ? 5
                          : 4,
                      left: 0,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {showFilters && (
          <div className="bg-slate-50 dark:bg-neutral-800/50 p-2 text-center border-t border-slate-100 dark:border-neutral-800">
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 uppercase tracking-wider font-semibold">
              Mostrando {sortedBooks.length} de {books.length} livros
            </span>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-white dark:bg-neutral-900 rounded-lg shadow-sm border border-slate-200 dark:border-neutral-800 w-full">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed divide-y divide-slate-200 dark:divide-neutral-800">
            <thead className="bg-slate-50 dark:bg-neutral-950">
              <tr>
                {columns.map(({ key, label, width }) => (
                  <th
                    key={key}
                    onClick={() => key !== "select" && requestSort(key)}
                    className={`${width} px-3 py-2.5 text-left text-[10px] font-bold text-slate-500 dark:text-neutral-400 uppercase tracking-wider ${
                      key !== "select"
                        ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-neutral-800"
                        : ""
                    } transition-colors whitespace-nowrap overflow-hidden text-ellipsis`}
                  >
                    {key === "select" ? (
                      <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        checked={
                          sortedBooks.length > 0 &&
                          selectedBooks.length === sortedBooks.length
                        }
                        onChange={toggleSelectAll}
                        title="Selecionar todos os filtrados"
                        aria-label="Selecionar todos os livros filtrados"
                      />
                    ) : (
                      <div className="flex items-center gap-1">
                        {label}
                        <ArrowUpDown size={10} />
                      </div>
                    )}
                  </th>
                ))}
                <th className="w-[4%] px-3 py-2.5 text-right text-[10px] font-medium text-slate-500 dark:text-neutral-400 uppercase tracking-wider whitespace-nowrap overflow-hidden">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-900 divide-y divide-slate-100 dark:divide-neutral-800">
              {sortedBooks.map((book) => (
                <tr
                  key={book.id}
                  className={`hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors ${
                    selectedBooks.includes(book.id)
                      ? "bg-purple-50 dark:bg-purple-900/10"
                      : ""
                  }`}
                >
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-purple-600 focus:ring-purple-500 cursor-pointer"
                      checked={selectedBooks.includes(book.id)}
                      onChange={() => toggleSelectBook(book.id)}
                      aria-label={`Selecionar livro ${book.title}`}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-slate-500 dark:text-neutral-400">
                    {book.order || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {(() => {
                      const coverUrl = getCoverUrl(book.cover_image);

                      const bgColor = "f1f5f9"; // slate-100 default
                      const textColor = "475569"; // slate-600 default

                      return coverUrl ? (
                        <div className="w-8 h-12 bg-slate-100 dark:bg-neutral-800 rounded overflow-hidden border border-slate-200 dark:border-neutral-700 relative">
                          <img
                            src={coverUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = `https://placehold.co/300x450/${bgColor}/${textColor}?text=${encodeURIComponent(
                                book.title,
                              )}`;
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-12 bg-slate-50 dark:bg-neutral-800 rounded flex items-center justify-center border border-slate-100 dark:border-transparent">
                          <span className="text-[8px] text-slate-300">N/A</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td
                    className="px-3 py-2 text-xs font-medium text-slate-800 dark:text-white max-w-[256px] truncate"
                    title={book.title}
                  >
                    {book.title}
                  </td>
                  <td
                    className="px-3 py-2 text-xs text-slate-600 dark:text-neutral-300 max-w-[160px] truncate"
                    title={book.author}
                  >
                    {book.author}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-neutral-400">
                    {book.year || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        book.type === "Técnico"
                          ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300"
                          : "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      {book.type === "Técnico" ? "Téc" : "N-Téc"}
                    </span>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-neutral-400">
                    {book.priority?.split(" - ")[0] || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-purple-600 dark:text-purple-400 text-center">
                    {book.score ? book.score.toFixed(0) : "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">
                    <span
                      className={`px-1.5 inline-flex text-[10px] leading-4 font-semibold rounded-full 
                        ${
                          book.status === "Lendo"
                            ? "bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30"
                            : book.status === "Lido"
                              ? "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30"
                              : "bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/30"
                        }`}
                    >
                      {book.status}
                    </span>
                  </td>
                  <td
                    className="px-3 py-2 text-xs text-slate-500 dark:text-neutral-400 max-w-[160px] truncate"
                    title={book.book_class}
                  >
                    {book.book_class || "-"}
                  </td>
                  <td
                    className="px-3 py-2 text-xs text-slate-500 dark:text-neutral-400 max-w-[128px] truncate"
                    title={book.category}
                  >
                    {book.category}
                  </td>
                  <td
                    className="px-3 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-neutral-400 truncate max-w-[80px]"
                    title={book.availability}
                  >
                    {book.availability || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-amber-500 dark:text-amber-400 text-center">
                    {book.google_rating ? book.google_rating.toFixed(1) : "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-amber-600 dark:text-amber-400 font-bold text-center">
                    {book.rating || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500 dark:text-neutral-400">
                    {book.date_read || "-"}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right text-right text-xs font-medium">
                    <div className="flex justify-end gap-1.5">
                      <button
                        onClick={() => onEdit(book)}
                        className="text-purple-500 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors p-1"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(book.id)}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors p-1"
                        title="Excluir"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3 pb-20">
        {sortedBooks.map((book) => (
          <MobileBookItem
            key={book.id}
            book={book}
            onEdit={onEdit}
            onDelete={handleDelete}
            isSelected={selectedBooks.includes(book.id)}
            onSelect={toggleSelectBook}
          />
        ))}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedBooks.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 z-50 animate-bounce-in">
          <span className="text-white font-bold text-sm bg-purple-600 px-2 py-0.5 rounded-full">
            {selectedBooks.length} selecionados
          </span>

          <div className="h-4 w-px bg-slate-200 dark:bg-neutral-700"></div>

          <button
            onClick={() => setShowBulkEdit(true)}
            className="flex items-center gap-2 text-slate-600 dark:text-neutral-300 hover:text-purple-600 dark:hover:text-white dark:hover:text-purple-400 transition-colors text-sm font-medium"
          >
            <Edit3 size={16} />
            Editar em Massa
          </button>

          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 text-slate-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 transition-colors text-sm font-medium"
          >
            <Trash size={16} />
            Excluir
          </button>

          <button
            onClick={() => setSelectedBooks([])}
            className="ml-2 text-slate-400 dark:text-neutral-500 hover:text-slate-800 dark:hover:text-white transition-colors"
            title="Cancelar Seleção"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit &&
        createPortal(
          <BulkEditModal
            count={selectedBooks.length}
            onClose={() => setShowBulkEdit(false)}
            onSave={handleBulkSave}
          />,
          document.body,
        )}
      {/* Confirmation Modal - REMOVED (Global) */}
    </div>
  );
}
