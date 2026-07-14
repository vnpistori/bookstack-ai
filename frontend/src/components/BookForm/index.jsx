import { useState, useEffect } from "react";
import {
  Upload,
  Save,
  X,
  Sparkles,
  Download,
  BookOpen,
  Layers,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import { api } from "../../services/api";
import {
  DEFAULT_CLASS_CATEGORIES,
  DEFAULT_AVAILABILITY_OPTIONS,
} from "../../utils/constants";
import { getCoverUrl } from "../../utils/imageUtils";

const ScoreStats = ({ stats, currentScore, loading }) => {
  if (loading) {
    return (
      <div className="mt-4 p-3 bg-slate-50 dark:bg-neutral-800 rounded-lg border border-slate-200 dark:border-neutral-700 animate-pulse flex flex-col items-center justify-center text-slate-400 gap-2 h-24">
        <Sparkles className="animate-spin text-purple-400" size={16} />
        <span className="text-[10px]">Calculando...</span>
      </div>
    );
  }

  if (!stats || stats.total === 0) return null;

  // Replicate backend quadrant logic (`int()` truncation)
  const qSize = stats.total / 4;
  const getRange = (qIndex) => {
    const startIdx = Math.floor(qSize * qIndex);
    const endIdx = Math.floor(qSize * (qIndex + 1));
    const start = startIdx + 1;
    const end = endIdx;
    if (start > end) return `${start}º`;
    return `${start}º-${end}º`;
  };

  const quadrants = [
    {
      range: getRange(0),
      key: "q1",
      color: "bg-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      range: getRange(1),
      key: "q2",
      color: "bg-emerald-400",
      text: "text-emerald-500 dark:text-emerald-400",
      bg: "bg-emerald-400/10",
    },
    {
      range: getRange(2),
      key: "q3",
      color: "bg-emerald-300",
      text: "text-emerald-500 dark:text-emerald-300",
      bg: "bg-emerald-300/10",
    },
    {
      range: getRange(3),
      key: "q4",
      color: "bg-emerald-200",
      text: "text-emerald-400 dark:text-emerald-200",
      bg: "bg-emerald-200/10",
    },
  ];

  return (
    <div className="mt-4 w-full">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
          Análise de Score
        </h4>
        <span className="text-[9px] bg-slate-200 dark:bg-neutral-700 px-1.5 py-0.5 rounded-full text-slate-600 dark:text-neutral-300 font-mono">
          Total: {stats.total}
        </span>
      </div>

      <div className="flex gap-3">
        {/* Left: Main Score */}
        <div className="flex flex-col justify-center items-center bg-white dark:bg-neutral-900 p-2 rounded border border-slate-100 dark:border-neutral-800 shadow-sm w-16 flex-shrink-0">
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mb-0.5 text-center">
            Score
          </span>
          <div className="text-xl font-black text-purple-600 dark:text-purple-400 leading-none mb-1">
            {currentScore ? currentScore.toFixed(1) : "-"}
          </div>
        </div>

        {/* Right: Quadrants Grid */}
        <div className="flex-1 grid grid-cols-1 gap-1.5 content-center">
          {quadrants.map((q) => {
            const stat = stats[q.key] || { mean: 0, median: 0, mode: 0 };
            return (
              <div
                key={q.key}
                className="relative flex items-center justify-between px-2 py-1 rounded bg-white dark:bg-neutral-900 border border-slate-100 dark:border-neutral-800/50 overflow-hidden h-7"
              >
                <div
                  className={`absolute left-0 top-0 bottom-0 opacity-20 ${q.color} transition-all duration-500`}
                  style={{ width: `${Math.min((stat.mean / 10) * 100, 100)}%` }}
                />

                <div className="flex items-center gap-2 z-10 w-full justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400">
                      Pos. {q.range}
                    </span>
                  </div>

                  <span
                    className={`text-[9px] font-bold font-mono ${q.text} tabular-nums whitespace-nowrap`}
                  >
                    {stat.mean.toFixed(1)} | {stat.median.toFixed(1)} |{" "}
                    {stat.mode.toFixed(1)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default function BookForm({
  bookToEdit,
  onSuccess,
  onCancel,
  onLoadingChange,
}) {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    title: "",
    original_title: "",
    author: "",
    status: "A Ler",
    book_class: "Tecnologia & IA",
    category: "Análise de Dados",
    priority: "1 - Baixa",
    availability: "N/A",
    type: "Técnico",
    year: new Date().getFullYear(),
    rating: 0,
    order: null,
    google_rating: null,
    motivation: "",
    cover_image: null,
    date_read: "",
  });
  const [coverFile, setCoverFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [scoreStats, setScoreStats] = useState(null);
  const [previewScore, setPreviewScore] = useState(null);
  const [suggestedCoverUrl, setSuggestedCoverUrl] = useState(null);
  const [googleRating, setGoogleRating] = useState(null);
  const [classCategories, setClassCategories] = useState(
    DEFAULT_CLASS_CATEGORIES,
  );
  const [availabilityOptions, setAvailabilityOptions] = useState(
    DEFAULT_AVAILABILITY_OPTIONS,
  );

  useEffect(() => {
    fetchPreferences();
    if (bookToEdit) {
      setFormData((prev) => ({
        ...bookToEdit,
        cover_image: coverFile ? prev.cover_image : bookToEdit.cover_image, // Preserve local preview if file selected
        date_read: bookToEdit.date_read || "",
        order: bookToEdit.order || null,
        rating: bookToEdit.rating || 0,
      }));
    }
  }, [bookToEdit]);

  // Cleanup object URLs to avoid memory leaks
  useEffect(() => {
    return () => {
      if (formData.cover_image && formData.cover_image.startsWith("blob:")) {
        URL.revokeObjectURL(formData.cover_image);
      }
    };
  }, []);

  const fetchPreferences = async () => {
    try {
      const res = await api.get("/preferences/");
      if (res.data) {
        if (
          res.data.class_categories &&
          Object.keys(res.data.class_categories).length > 0
        ) {
          setClassCategories(res.data.class_categories);
        }

        if (
          res.data.availability_options &&
          res.data.availability_options.length > 0
        ) {
          setAvailabilityOptions(res.data.availability_options);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar listas no BookForm:", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => {
      const newData = { ...prev, [name]: value };

      if (name === "status") {
        if (value === "Lido") {
          newData.priority = "Concluído";
        } else if (value === "Lendo" && prev.status !== "Lendo") {
          // We need to fetch books to calculate order, but we can't await here.
          // We'll set a placeholder or fire an effect, but simplest is to fire promise side-effect
          api
            .get("/books/")
            .then((res) => {
              const allBooks = res.data;
              const readingBooks = allBooks.filter((b) => b.status === "Lendo");
              const maxOrder = readingBooks.reduce(
                (max, b) => (b.order > max ? b.order : max),
                0,
              );

              setFormData((curr) => ({
                ...curr,
                order: maxOrder + 1,
              }));
            })
            .catch((err) =>
              console.error("Error auto-calculating order:", err),
            );
        } else if (value === "Lido") {
          newData.priority = "Concluído";
          newData.order = 0; // Force Lido to 0
        } else if (value === "A Ler") {
          newData.order = null; // Let backend append
        } else if (prev.status === "Lido") {
          if (prev.priority === "Concluído") {
            newData.priority = "1 - Baixa";
          }
        }
      }

      if (name === "date_read") {
        // Remove non-digit characters
        let raw = value.replace(/\D/g, "");

        // Limit to 6 digits (YYYYMM)
        if (raw.length > 6) raw = raw.slice(0, 6);

        // Apply masking YYYY/MM
        if (raw.length > 4) {
          newData[name] = raw.substring(0, 4) + "/" + raw.substring(4);
        } else {
          newData[name] = raw;
        }
      }

      // Trigger Score Preview if relevant fields change and status is "A Ler"
      // Side effect for score preview removed from here. Handled by useEffect.

      return newData;
    });
  };

  // Fetch Stats when Status becomes "A Ler"
  useEffect(() => {
    if (formData.status === "A Ler") {
      setStatsLoading(true);
      api
        .get("/books/stats/toread")
        .then((res) => setScoreStats(res.data))
        .catch((err) => {
          console.error("Error fetching stats:", err);
          // Fallback to zeros if error, so UI still shows up provided we have preview
          setScoreStats({ q1: 0, q2: 0, q3: 0, q4: 0, total: 0 });
        })
        .finally(() => setStatsLoading(false));
    } else {
      setScoreStats(null);
    }
  }, [formData.status]);

  // Effect to update preview score when form data changes
  useEffect(() => {
    if (formData.status === "A Ler") {
      // Debounce could be added here if frequent updates cause lag
      const timeoutId = setTimeout(() => {
        fetchPreviewScore(formData);
      }, 300); // 300ms debounce
      return () => clearTimeout(timeoutId);
    } else {
      setPreviewScore(null);
    }
  }, [
    formData.status,
    formData.priority,
    formData.year,
    formData.book_class,
    formData.category,
    formData.availability,
    formData.type,
  ]);

  const fetchPreviewScore = async (data) => {
    // Basic debounce could be added here if needed, but for now direct call on change
    try {
      const payload = { ...data, year: parseInt(data.year) || 0 };
      const res = await api.post("/books/preview-score", payload);
      setPreviewScore(res.data.score);
    } catch (err) {
      console.error("Error previewing score:", err);
    }
  };

  const handleClassChange = (e) => {
    const newClass = e.target.value;
    const firstCategory =
      (classCategories[newClass] && classCategories[newClass][0]) || "";
    setFormData((prev) => ({
      ...prev,
      book_class: newClass,
      category: firstCategory,
    }));
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      const file = e.target.files[0];
      setCoverFile(file);

      // Create local preview immediately
      setFormData((prev) => ({
        ...prev,
        cover_image: URL.createObjectURL(file),
      }));
    }
  };

  const handleAiSuggest = async () => {
    if (!formData.title) {
      addToast({ type: "warning", message: "Digite um título primeiro!" });
      return;
    }

    setAiLoading(true);
    setSuggestedCoverUrl(null);
    try {
      const res = await api.post("/books/suggest", {
        title: formData.title,
        author: formData.author || null,
      });
      const suggestion = res.data;

      if (suggestion) {
        if (suggestion.error) {
          console.warn("AI partial result:", suggestion.partial_result);
          if (suggestion.partial_result) {
            setFormData((prev) => ({
              ...prev,
              author: suggestion.partial_result.author || prev.author,
              year: suggestion.partial_result.year || prev.year,
              book_class:
                suggestion.partial_result.book_class || prev.book_class,
              type: suggestion.partial_result.type || prev.type,
              category: suggestion.partial_result.category || prev.category,
              motivation:
                suggestion.partial_result.motivation || prev.motivation,
              original_title:
                suggestion.partial_result.original_title ?? prev.original_title,
              google_rating:
                suggestion.partial_result.google_rating || prev.google_rating,
              cover_image:
                suggestion.partial_result.cover_image || prev.cover_image,
            }));

            addToast({
              type: "warning",
              message: `Autocomplete parcial: ${suggestion.error}`,
            });
          } else {
            console.error("AI Error Log:", suggestion.error);
            addToast({
              type: "error",
              message: `Falha na IA: ${suggestion.error}`,
            });
          }
          return;
        }

        setFormData((prev) => ({
          ...prev,
          author: suggestion.author || prev.author,
          year: suggestion.year || prev.year,
          book_class: suggestion.book_class || prev.book_class,
          type: suggestion.type || prev.type,
          category: suggestion.category || prev.category,
          motivation: suggestion.motivation || prev.motivation,
          original_title: suggestion.original_title ?? prev.original_title,
          google_rating: suggestion.google_rating || prev.google_rating,
          cover_image: suggestion.cover_image || prev.cover_image,
        }));

        if (!suggestion.motivation) {
          addToast({
            type: "warning",
            message: "A IA não preencheu tudo. Verifique os campos.",
          });
        }

        if (suggestion.cover_image) {
          setSuggestedCoverUrl(null);
        }

        // Armazena nota do Google Books
        if (suggestion.google_rating) {
          setGoogleRating({
            rating: suggestion.google_rating,
            count: suggestion.google_ratings_count || 0,
          });
        }

        if (!suggestion.cover_image) {
          addToast({
            type: "info",
            message: "Imagem de capa indisponível no Google Books",
          });
        }
      }
    } catch (err) {
      console.error(err);
      addToast({
        type: "error",
        message: "Erro de conexão com o servidor.",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const handleUseSuggestedCover = () => {
    if (suggestedCoverUrl) {
      setFormData((prev) => ({ ...prev, cover_image: suggestedCoverUrl }));
      setSuggestedCoverUrl(null);
      addToast({
        type: "success",
        message: "Capa da IA aplicada!",
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (!formData.title || !formData.title.trim()) {
      addToast({ type: "error", message: "O Título é obrigatório!" });
      return;
    }
    if (!formData.author || !formData.author.trim()) {
      addToast({ type: "error", message: "O Autor é obrigatório!" });
      return;
    }
    if (formData.status === "Lido" && !formData.date_read) {
      addToast({ type: "error", message: "Data de leitura obrigatória!" });
      return;
    }

    setLoading(true);
    if (onLoadingChange) onLoadingChange(true);

    try {
      // Ensure numeric types
      const payload = {
        ...formData,
        year: formData.year ? parseInt(formData.year) : null,
        order: formData.order ? parseInt(formData.order) : null,
      };

      // CRITICAL FIX: Never send a blob:URL to the backend.
      // If the user selected a local file, cover_image is a temporary blob:URL
      // that is only valid in the browser session. The actual upload to Supabase
      // happens via the separate /cover endpoint below.
      // If no local file was chosen, keep whatever URL is already in cover_image (e.g. from Google Books).
      if (payload.cover_image && payload.cover_image.startsWith("blob:")) {
        // Remove blob URL — the /cover upload will set the real URL
        payload.cover_image = bookToEdit?.cover_image || null;
      }

      let savedBook;
      if (bookToEdit) {
        const res = await api.put(`/books/${bookToEdit.id}`, payload);
        savedBook = res.data;
      } else {
        const res = await api.post("/books/", payload);
        savedBook = res.data;
      }

      // Only upload file if user selected a local file
      let coverUploadError = null;
      if (coverFile && savedBook.id) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", coverFile);

        try {
          const coverResponse = await api.post(
            `/books/${savedBook.id}/cover`,
            formDataUpload,
          );

          if (coverResponse?.data?.ok === false) {
            coverUploadError =
              coverResponse.data.detail || "Erro ao enviar capa";
          }
        } catch (coverErr) {
          console.error("Erro ao enviar capa:", coverErr);
          coverUploadError =
            coverErr.response?.data?.detail || "Erro ao enviar capa";
        }
      }

      addToast({ type: "success", message: "Livro salvo com sucesso!" });
      if (coverUploadError) {
        addToast({
          type: "warning",
          message: `Livro salvo, mas a capa não foi enviada: ${coverUploadError}`,
        });
      }
      onSuccess();
    } catch (err) {
      console.error("Erro ao salvar livro:", err);
      if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Data:", err.response.data);
        addToast({
          type: "error",
          message:
            err.response.status === 405
              ? "Erro 405: Rota incorreta."
              : `Erro: ${err.response.data?.detail || "Ao salvar livro"}`,
        });
      } else {
        addToast({ type: "error", message: "Erro de conexão ao salvar." });
      }
    } finally {
      setLoading(false);
      if (onLoadingChange) onLoadingChange(false);
    }
  };

  return (
    <form
      id="book-form-main"
      onSubmit={handleSubmit}
      className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg border border-slate-200 dark:border-neutral-800 w-full animate-fade-in text-slate-900 dark:text-white"
    >
      {/* Actions moved to parent header */}

      <div className="p-3 grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* LEFT COLUMN: BOOK DATA (AI & METADATA) - 7 cols */}
        <div className="md:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} /> Dados da Obra
            </h3>
            {/* AI Button Contextual */}
            <button
              type="button"
              onClick={handleAiSuggest}
              disabled={aiLoading || !formData.title}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 text-white border border-purple-400/30 px-3 py-1.5 rounded-md text-xs font-semibold shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
              title="Preencher restante do formulário com IA"
            >
              <Sparkles size={12} />{" "}
              {aiLoading ? "Buscando..." : "Auto-Completar"}
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-black/20 p-3 rounded-lg border border-slate-200 dark:border-neutral-800/50 space-y-3">
            {/* Title & Original Title */}
            <div className="space-y-3">
              <div>
                <label
                  className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                  htmlFor="title"
                >
                  Título Principal
                </label>
                <input
                  id="title"
                  required
                  name="title"
                  value={formData.title || ""}
                  onChange={handleChange}
                  className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-sm p-2 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-bold placeholder-slate-400 dark:placeholder-neutral-700"
                  placeholder="Ex: Hábitos Atômicos"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="original_title"
                  >
                    Título Original
                  </label>
                  <input
                    id="original_title"
                    name="original_title"
                    value={formData.original_title || ""}
                    onChange={handleChange}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-xs p-2 focus:border-purple-500 italic placeholder-slate-400 dark:placeholder-neutral-700"
                    placeholder="..."
                  />
                </div>
                <div>
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="author"
                  >
                    Autor
                  </label>
                  <input
                    id="author"
                    name="author"
                    value={formData.author || ""}
                    onChange={handleChange}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-purple-500 placeholder-slate-400 dark:placeholder-neutral-700"
                  />
                </div>
              </div>
            </div>

            {/* Visual & Core Meta */}
            <div className="flex gap-3">
              {/* Cover */}
              <div className="w-20 flex-shrink-0 space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider text-center">
                  Capa
                </label>
                <div className="w-20 h-28 bg-slate-100 dark:bg-neutral-900 rounded border border-slate-200 dark:border-neutral-700 overflow-hidden relative group shadow-sm dark:shadow-lg">
                  {formData.cover_image ? (
                    <>
                      <img
                        src={getCoverUrl(formData.cover_image)}
                        alt="Capa"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFormData((prev) => ({
                            ...prev,
                            cover_image: null,
                          }));
                          setCoverFile(null);
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-sm z-10"
                        title="Remover capa"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-neutral-700 gap-1">
                      <Upload size={16} />
                    </div>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="cover-upload"
                    type="file"
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <label
                    htmlFor="cover-upload"
                    className="block w-full text-center bg-slate-200 dark:bg-neutral-800 hover:bg-slate-300 dark:hover:bg-neutral-700 text-[9px] py-1 rounded text-slate-600 dark:text-neutral-400 hover:text-slate-900 dark:hover:text-white transition-colors border border-slate-300 dark:border-neutral-700 cursor-pointer"
                  >
                    Upload
                  </label>
                </div>
                {suggestedCoverUrl && (
                  <button
                    type="button"
                    onClick={handleUseSuggestedCover}
                    className="w-full flex items-center justify-center gap-1 px-1 py-0.5 bg-emerald-900/40 text-emerald-400 border border-emerald-800/50 rounded text-[9px] hover:bg-emerald-900/60 transition-colors"
                  >
                    <Download size={8} /> Usar IA
                  </button>
                )}
              </div>

              {/* Classification Grid */}
              <div className="flex-1 grid grid-cols-2 gap-3 content-start">
                <div>
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="year"
                  >
                    Ano
                  </label>
                  <input
                    id="year"
                    type="number"
                    name="year"
                    value={formData.year || ""}
                    onChange={handleChange}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-purple-500"
                  />
                </div>
                <div>
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="type"
                  >
                    Tipo
                  </label>
                  <select
                    id="type"
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-purple-500"
                  >
                    <option>Não Técnico</option>
                    <option>Técnico</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="book_class"
                  >
                    Classe Macro
                  </label>
                  <select
                    id="book_class"
                    name="book_class"
                    value={formData.book_class}
                    onChange={handleClassChange}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-purple-500"
                  >
                    {Object.keys(classCategories).map((cls) => (
                      <option key={cls} value={cls}>
                        {cls}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="category"
                  >
                    Categoria Específica
                  </label>
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-purple-500"
                  >
                    {(classCategories[formData.book_class] || [])
                      .filter((cat) => cat !== formData.book_class)
                      .map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Motivation */}
            <div>
              <label
                className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                htmlFor="motivation"
              >
                Resumo / Motivação
              </label>
              <textarea
                id="motivation"
                name="motivation"
                value={formData.motivation || ""}
                onChange={handleChange}
                rows={6}
                className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 text-xs p-2 focus:border-purple-500 placeholder-slate-400 dark:placeholder-neutral-700 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-neutral-700"
                placeholder="Sobre o que é este livro?"
              />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: USER MANAGEMENT (STATUS & CONTROL) - 5 cols */}
        <div className="md:col-span-5 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
            <Layers size={14} /> Meu Gerenciamento
          </h3>

          <div className="bg-slate-50 dark:bg-neutral-800/30 p-4 rounded-lg border border-slate-200 dark:border-neutral-700/50 flex flex-col gap-4 flex-1">
            {/* Status Highlight */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 dark:text-white mb-1.5 uppercase">
                Status Atual
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {["A Ler", "Lendo", "Lido"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      // Trigger same logic as handleChange manually or just simulate event
                      handleChange({ target: { name: "status", value: s } });
                    }}
                    className={`py-1.5 rounded text-xs font-bold border transition-all ${
                      formData.status === s
                        ? s === "Lido"
                          ? "bg-emerald-600 border-emerald-500 text-white"
                          : s === "Lendo"
                            ? "bg-purple-600 border-purple-500 text-white"
                            : "bg-slate-300 dark:bg-neutral-600 border-slate-400 dark:border-neutral-500 text-slate-800 dark:text-white"
                        : "bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-neutral-700/50"></div>

            {/* Availability - Always Visible */}
            <div>
              <label
                className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                htmlFor="availability"
              >
                Disponível em
              </label>
              <select
                id="availability"
                name="availability"
                value={formData.availability}
                onChange={handleChange}
                className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-purple-500"
              >
                {/* Dynamically render options */}
                {availabilityOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {/* CONDITIONAL FIELDS BASED ON STATUS */}
            {formData.status === "Lido" ? (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-emerald-900/10 dark:bg-emerald-900/30 p-3 rounded-lg border border-emerald-900/30 dark:border-emerald-500/30 text-center">
                  <label className="block text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mb-2 uppercase tracking-wider">
                    Sua Avaliação
                  </label>
                  <div className="flex justify-center gap-1.5 mb-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({ ...prev, rating: star }))
                        }
                        className={`text-xl transition-transform hover:scale-110 ${
                          (formData.rating || 0) >= star
                            ? "text-amber-400"
                            : "text-slate-300 dark:text-neutral-700"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-400 font-mono">
                    {formData.rating
                      ? `${formData.rating}/5 Estrelas`
                      : "Sem nota"}
                  </p>
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="date_read"
                  >
                    Data de Conclusão
                  </label>
                  <input
                    id="date_read"
                    type="text"
                    name="date_read"
                    value={formData.date_read || ""}
                    onChange={handleChange}
                    maxLength={7}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-emerald-500 text-center"
                    placeholder="AAAA/MM"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <div>
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="priority"
                  >
                    Prioridade de Leitura
                  </label>
                  <select
                    id="priority"
                    name="priority"
                    value={formData.priority}
                    onChange={handleChange}
                    className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-xs p-2 focus:border-purple-500"
                  >
                    <option>1 - Baixa</option>
                    <option>2 - Média</option>
                    <option>3 - Média-Alta</option>
                    <option>4 - Alta</option>
                  </select>
                </div>

                <div>
                  <label
                    className="block text-[10px] font-bold text-slate-500 dark:text-neutral-500 uppercase tracking-wider mb-1"
                    htmlFor="order"
                  >
                    Ordem na Fila
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 dark:text-neutral-500 text-sm">
                      #
                    </span>
                    <input
                      id="order"
                      type="number"
                      name="order"
                      value={formData.order || ""}
                      onChange={handleChange}
                      className="w-full rounded bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-900 dark:text-white text-sm p-1.5 font-bold focus:border-purple-500"
                      placeholder="Auto"
                    />
                  </div>
                </div>

                {/* Score Stats Component */}
                {formData.status === "A Ler" && (
                  <ScoreStats
                    stats={scoreStats}
                    currentScore={previewScore}
                    loading={statsLoading}
                  />
                )}
              </div>
            )}

            {googleRating && (
              <div className="mt-auto pt-3 border-t border-slate-200 dark:border-neutral-700/50 flex items-center justify-between gap-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">
                  Google Books
                </span>
                <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1 rounded-md border border-amber-200 dark:border-amber-800">
                  <span className="text-amber-500 text-xs">★</span>
                  <span className="text-xs font-bold text-slate-700 dark:text-amber-100">
                    {/* Handle both object form {rating, count} and simple float form */}
                    {typeof googleRating === "object"
                      ? googleRating.rating
                      : googleRating}
                  </span>
                  {(typeof googleRating === "object"
                    ? googleRating.count
                    : null) && (
                    <span className="text-[10px] text-slate-400 dark:text-amber-500/70">
                      ({googleRating.count})
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
