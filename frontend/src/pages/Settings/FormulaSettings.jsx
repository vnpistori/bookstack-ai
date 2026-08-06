import { useState, useEffect } from "react";
import {
  Filter,
  Database,
  Star,
  Calendar,
  Award,
  RotateCcw,
  Save,
  Calculator,
  ArrowRight,
  Settings2,
} from "lucide-react";
import { api } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { hslToString, getClassBaseHSL } from "../../utils/analyticsUtils.js";

const DEFAULT_CONFIG = {
  type: { Técnico: 0, default: 0 },
  availability: { Físico: 0, default: 0 },
  priority: {
    "1 - Baixa": 0,
    "2 - Média": 0,
    "3 - Média-Alta": 0,
    "4 - Alta": 0,
  },
  year: {
    ranges: [
      { max: 2005, weight: 0, label: "Antigos (≤ 2005)" },
      { min: 2006, max: 2021, weight: 0, label: "Intermediários (2006-2021)" },
      { min: 2022, weight: 0, label: "Recentes (≥ 2022)" },
    ],
  },
};

const DEFAULT_CATEGORIES = {
  "Tecnologia & IA": [
    "Análise de Dados",
    "Data Science",
    "IA",
    "Visão Computacional",
    "Machine Learning",
    "Programação",
    "Sistemas de IA & LLMs",
  ],
  "Engenharia & Arquitetura": [
    "Arquitetura de Software",
    "Engenharia de Dados",
    "MLOps",
  ],
  "Conhecimento & Ciências": [
    "Conhecimento Geral",
    "Estatística",
    "Cosmologia",
  ],
  "Negócios & Finanças": [
    "Finanças Pessoais",
    "Negócios",
    "Liberdade Econômica",
  ],
  "Literatura & Cultura": [
    "Diversidade e Inclusão",
    "História/Ficção",
    "Literatura Brasileira",
  ],
  "Desenvolvimento Pessoal": [
    "Bem-estar",
    "Comunicação",
    "Criatividade",
    "Inteligência Emocional",
    "Liderança",
    "Produtividade",
    "Biohacking & Existência",
  ],
};

export default function FormulaSettings() {
  const { addToast } = useToast();
  const [config, setConfig] = useState({
    ...DEFAULT_CONFIG,
    book_class: {},
    category: {},
  });
  const [classCategories, setClassCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Simulation State
  const [simBook, setSimBook] = useState({
    type: "Técnico",
    availability: "Físico",
    priority: "4 - Alta",
    year: new Date().getFullYear(),
    book_class: "Tecnologia & IA",
    category: "IA",
  });

  // Helper for Year Score
  const getYearScore = (y) => {
    if (!config || !config.year || !config.year.ranges) return 0;
    for (let r of config.year.ranges) {
      if (r.min && r.max) {
        if (y >= r.min && y <= r.max) return r.weight;
      } else if (r.max) {
        if (y <= r.max) return r.weight;
      } else if (r.min) {
        if (y >= r.min) return r.weight;
      }
    }
    return 0;
  };

  // Calculate live score for simulator
  const calculateSimScore = () => {
    if (!config) return 0;
    let score = 0;

    // Type
    score +=
      config.type?.[simBook.type] !== undefined
        ? config.type[simBook.type]
        : config.type?.default || 0;

    // Availability
    score +=
      config.availability?.[simBook.availability] !== undefined
        ? config.availability[simBook.availability]
        : config.availability?.default || 0;

    // Priority
    score += config.priority?.[simBook.priority] || 0;

    // Class
    score += config.book_class?.[simBook.book_class] || 0;

    // Category
    score += config.category?.[simBook.category] || 0;

    // Year
    score += getYearScore(simBook.year);

    return score;
  };

  const simScore = calculateSimScore();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get("/preferences/");
      const data = res.data;

      if (
        data?.class_categories &&
        Object.keys(data.class_categories).length > 0
      ) {
        setClassCategories(data.class_categories);
      }

      if (data?.formula_config && Object.keys(data.formula_config).length > 0) {
        const loaded = data.formula_config;
        setConfig((prev) => ({
          ...prev,
          ...loaded,
          type: { ...DEFAULT_CONFIG.type, ...(loaded.type || {}) },
          availability: {
            ...DEFAULT_CONFIG.availability,
            ...(loaded.availability || {}),
          },
          priority: { ...DEFAULT_CONFIG.priority, ...(loaded.priority || {}) },
          year: { ...DEFAULT_CONFIG.year, ...(loaded.year || {}) },
          book_class: loaded.book_class || {},
          category: loaded.category || {},
        }));
      }
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.get("/preferences/");
      await api.put("/preferences/", { ...res.data, formula_config: config });
      await api.post("/books/recalculate_scores");
      addToast({ type: "success", message: "Fórmula atualizada com sucesso!" });
    } catch (err) {
      addToast({ type: "error", message: "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Restaurar padrão?"))
      setConfig({ ...DEFAULT_CONFIG, book_class: {}, category: {} });
  };

  // Update Helpers
  const updateType = (k, v) =>
    setConfig((p) => ({ ...p, type: { ...p.type, [k]: parseInt(v) || 0 } }));
  const updateAvail = (k, v) =>
    setConfig((p) => ({
      ...p,
      availability: { ...p.availability, [k]: parseInt(v) || 0 },
    }));
  const updatePriority = (k, v) =>
    setConfig((p) => ({
      ...p,
      priority: { ...p.priority, [k]: parseInt(v) || 0 },
    }));
  const updateYear = (i, v) => {
    const r = [...config.year.ranges];
    r[i] = { ...r[i], weight: parseInt(v) || 0 };
    setConfig((p) => ({ ...p, year: { ...p.year, ranges: r } }));
  };

  if (loading)
    return (
      <div className="p-10 text-center animate-pulse text-slate-400">
        Carregando editor...
      </div>
    );

  return (
    <div className="w-full animate-fade-in pb-20 md:pb-0 font-sans">
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* LEFT: Header and Configuration Forms */}
        <div className="flex-1 w-full space-y-8">
          {/* Header with Title and Buttons */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 items-stretch">
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                Editor de Fórmula
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Ajuste os pesos para calibrar o algoritmo de priorização.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-red-500 transition-colors text-sm font-semibold"
              >
                <RotateCcw size={18} />
                Restaurar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Save size={18} />
                {saving ? "Salvando..." : "Salvar Fórmula"}
              </button>
            </div>
          </div>

          <div className="w-full bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl p-4 flex gap-3 items-start animate-fade-in shadow-sm">
            <Calculator
              size={18}
              className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
            />
            <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <p className="font-bold text-amber-700 dark:text-amber-300 mb-1">
                Score Fluido & Sincronizado
              </p>
              O Score de prioridade não é fixo. Ao salvar novos pesos, o sistema
              irá <strong>recalcular instantaneamente</strong> o índice de todos
              os livros da sua biblioteca para manter a consistência.
            </div>
          </div>

          {/* Card: Base Factors */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 flex items-center gap-3">
              <h3 className="font-bold text-slate-700 dark:text-white">
                Fatores Base
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <InputGroup
                label="Livro Técnico"
                value={config.type?.["Técnico"] || 0}
                onChange={(v) => updateType("Técnico", v)}
              />
              <InputGroup
                label="Livro Não Técnico"
                value={config.type?.["default"] || 0}
                onChange={(v) => updateType("default", v)}
              />
              <InputGroup
                label="Livro Físico"
                value={config.availability?.["Físico"] || 0}
                onChange={(v) => updateAvail("Físico", v)}
              />
            </div>
          </div>

          {/* Card: Priority */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 flex items-center gap-3">
              <h3 className="font-bold text-slate-700 dark:text-white">
                Prioridade Manual
              </h3>
            </div>
            <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              {["1 - Baixa", "2 - Média", "3 - Média-Alta", "4 - Alta"].map(
                (p) => (
                  <div key={p} className="flex flex-col gap-2">
                    <label
                      htmlFor={`priority-${p}`}
                      className="text-xs font-semibold text-slate-500 uppercase"
                    >
                      {p.split(" - ")[1]}
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                        +
                      </div>
                      <input
                        id={`priority-${p}`}
                        type="number"
                        value={config.priority?.[p] || 0}
                        onChange={(e) => updatePriority(p, e.target.value)}
                        className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-left font-mono font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Card: Year Context */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 flex items-center gap-3">
              <h3 className="font-bold text-slate-700 dark:text-white">
                Contexto Temporal
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {(config.year?.ranges || []).map((range, idx) => (
                <div key={idx} className="flex flex-col gap-2">
                  <label
                    htmlFor={`year-range-${idx}`}
                    className="text-xs font-semibold text-slate-500 uppercase"
                  >
                    {range.label}
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
                      +
                    </div>
                    <input
                      id={`year-range-${idx}`}
                      type="number"
                      value={range.weight}
                      onChange={(e) => updateYear(idx, e.target.value)}
                      className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-left font-mono font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card: Classes (Dynamic) */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 flex items-center gap-3">
              <h3 className="font-bold text-slate-700 dark:text-white">
                Classes de Livro
              </h3>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(classCategories).map((cls) => (
                <InputGroup
                  key={cls}
                  label={cls}
                  value={config.book_class?.[cls] || 0}
                  onChange={(v) =>
                    setConfig((p) => ({
                      ...p,
                      book_class: { ...p.book_class, [cls]: parseInt(v) || 0 },
                    }))
                  }
                />
              ))}
            </div>
          </div>

          {/* Card: Categories (Dynamic) */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-neutral-800 bg-slate-50/50 dark:bg-neutral-800/50 flex items-center gap-3">
              <div className="flex items-center justify-between w-full">
                <h3 className="font-bold text-slate-700 dark:text-white">
                  Categorias Específicas
                </h3>
                <span className="text-[10px] text-slate-400 uppercase font-bold">
                  Baseado em suas listas
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-6">
                {Object.entries(classCategories).map(([cls, cats]) => {
                  const baseHSL = getClassBaseHSL(cls);
                  const classColor = hslToString(baseHSL);

                  return (
                    <div key={cls}>
                      <h4
                        className="text-xs font-bold uppercase mb-3 flex items-center gap-2"
                        style={{ color: classColor }}
                      >
                        <span
                          className="w-2 h-2 rounded-full shadow-sm"
                          style={{ backgroundColor: classColor }}
                        ></span>
                        {cls}
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {cats.map((cat) => (
                          <InputGroup
                            key={cat}
                            label={cat}
                            value={config.category?.[cat] || 0}
                            onChange={(v) =>
                              setConfig((p) => ({
                                ...p,
                                category: {
                                  ...p.category,
                                  [cat]: parseInt(v) || 0,
                                },
                              }))
                            }
                            small
                          />
                        ))}
                        {cats.length === 0 && (
                          <p className="text-xs text-slate-400 italic">
                            Sem categorias definidas nesta classe.
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Simulator (Sticky) */}
        <aside className="hidden lg:block lg:w-96 lg:sticky lg:top-8 lg:self-start z-20">
          <div className="bg-white dark:bg-neutral-900 rounded-[2.5rem] border border-slate-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-60px)]">
            {/* Score Header (Fixed at top of card) */}
            <div className="bg-slate-900 p-6 text-white relative overflow-hidden flex-shrink-0">
              <div className="relative z-10">
                <div className="flex items-center gap-2 text-slate-400 mb-1">
                  <Calculator size={14} className="animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    Simulador de Score
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-black text-white">
                    {simScore.toFixed(0)}
                  </span>
                  <span className="text-slate-400 text-sm font-bold">
                    pontos
                  </span>
                </div>
              </div>
              <div className="absolute -right-4 -bottom-4 text-white/5 transform rotate-12">
                <Star size={120} weight="fill" />
              </div>
            </div>

            {/* Scrollable Characteristics Section */}
            <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1 bg-white dark:bg-neutral-900">
              <div className="space-y-4">
                <div className="space-y-4">
                  {/* Type & Avail Header/Weights Logic */}
                  {(() => {
                    // Robust Weight Extraction
                    const typeWeight =
                      config.type?.[simBook.type] !== undefined
                        ? config.type[simBook.type]
                        : config.type?.default || 0;

                    const availWeight =
                      config.availability?.[simBook.availability] !== undefined
                        ? config.availability[simBook.availability]
                        : config.availability?.default || 0;

                    const priorityWeight =
                      config.priority?.[simBook.priority] || 0;
                    const yearWeight = getYearScore(simBook.year);

                    // Weights
                    const classWeight =
                      config.book_class?.[simBook.book_class] || 0;
                    const catWeight = config.category?.[simBook.category] || 0;

                    return (
                      <>
                        {/* Type & Avail */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-2.5 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 transition-colors group">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-slate-500 transition-colors">
                                Tipo
                              </span>
                              <span className="bg-slate-800 dark:bg-neutral-700 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                                +{typeWeight}
                              </span>
                            </div>
                            <div className="h-8 flex items-center">
                              <select
                                value={simBook.type}
                                onChange={(e) =>
                                  setSimBook({
                                    ...simBook,
                                    type: e.target.value,
                                  })
                                }
                                className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer"
                              >
                                <option value="Técnico">Técnico</option>
                                <option value="Não Técnico">Não Técnico</option>
                              </select>
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-2.5 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 transition-colors group">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-slate-500 transition-colors">
                                Onde
                              </span>
                              <span className="bg-slate-800 dark:bg-neutral-700 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                                +{availWeight}
                              </span>
                            </div>
                            <div className="h-8 flex items-center">
                              <select
                                aria-label="Selecionar disponibilidade"
                                value={simBook.availability}
                                onChange={(e) =>
                                  setSimBook({
                                    ...simBook,
                                    availability: e.target.value,
                                  })
                                }
                                className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none cursor-pointer"
                              >
                                <option value="Físico">Físico</option>
                                <option value="Digital">Digital</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        {/* Priority */}
                        <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-2.5 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 transition-colors group">
                          <div className="flex justify-between items-center mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-slate-500 transition-colors">
                                Prioridade
                              </span>
                              <span className="text-[10px] font-black text-purple-600 dark:text-purple-400">
                                {simBook.priority.split(" - ")[1]}
                              </span>
                            </div>
                            <span className="bg-slate-800 dark:bg-neutral-700 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                              +{priorityWeight}
                            </span>
                          </div>
                          <div className="h-8 flex items-center">
                            <input
                              type="range"
                              min="1"
                              max="4"
                              step="1"
                              value={simBook.priority.split(" - ")[0]}
                              onChange={(e) => {
                                const mapping = {
                                  1: "1 - Baixa",
                                  2: "2 - Média",
                                  3: "3 - Média-Alta",
                                  4: "4 - Alta",
                                };
                                setSimBook({
                                  ...simBook,
                                  priority: mapping[e.target.value],
                                });
                              }}
                              className="w-full h-1.5 bg-slate-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                            />
                          </div>
                        </div>

                        {/* Year */}
                        <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-2.5 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 transition-colors group">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-slate-500 transition-colors">
                              Ano de Lançamento
                            </span>
                            <span className="bg-slate-800 dark:bg-neutral-700 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                              +{yearWeight}
                            </span>
                          </div>
                          <div className="h-8 flex items-center gap-3">
                            <input
                              type="number"
                              value={simBook.year}
                              onChange={(e) =>
                                setSimBook({
                                  ...simBook,
                                  year: parseInt(e.target.value) || 2024,
                                })
                              }
                              className="w-full bg-transparent text-sm font-bold text-slate-700 dark:text-white outline-none"
                            />
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() =>
                                  setSimBook({
                                    ...simBook,
                                    year: simBook.year + 1,
                                  })
                                }
                                className="p-0.5 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded text-slate-400 hover:text-slate-600"
                              >
                                <ArrowRight size={10} className="-rotate-90" />
                              </button>
                              <button
                                onClick={() =>
                                  setSimBook({
                                    ...simBook,
                                    year: simBook.year - 1,
                                  })
                                }
                                className="p-0.5 hover:bg-slate-200 dark:hover:bg-neutral-700 rounded text-slate-400 hover:text-slate-600"
                              >
                                <ArrowRight size={10} className="rotate-90" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3.5 pt-1">
                          {/* Class */}
                          <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-2.5 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 transition-colors group">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-slate-500 transition-colors">
                                Classe
                              </span>
                              <span className="bg-slate-800 dark:bg-neutral-700 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                                +{classWeight}
                              </span>
                            </div>
                            <div className="h-8 flex items-center">
                              <Select
                                value={simBook.book_class}
                                onChange={(v) => {
                                  const cats = classCategories[v] || [];
                                  setSimBook({
                                    ...simBook,
                                    book_class: v,
                                    category: cats[0] || "",
                                  });
                                }}
                                options={Object.keys(classCategories).sort()}
                              />
                            </div>
                          </div>

                          {/* Category */}
                          <div className="bg-slate-50 dark:bg-neutral-800/50 rounded-2xl p-2.5 border border-slate-100 dark:border-neutral-800 hover:border-slate-200 transition-colors group">
                            <div className="flex justify-between items-center mb-1.5">
                              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-slate-500 transition-colors">
                                Categoria
                              </span>
                              <span className="bg-slate-800 dark:bg-neutral-700 text-white text-[9px] px-1.5 py-0.5 rounded-md font-mono font-bold">
                                +{catWeight}
                              </span>
                            </div>
                            <div className="h-8 flex items-center">
                              <Select
                                value={simBook.category}
                                onChange={(v) =>
                                  setSimBook({ ...simBook, category: v })
                                }
                                options={(
                                  classCategories[simBook.book_class] || []
                                ).sort()}
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Mobile Score Bar (Fixed at bottom for mobile) */}
        <div className="lg:hidden fixed bottom-6 left-6 right-6 z-50 animate-slide-up">
          <div className="bg-slate-900 dark:bg-neutral-800 rounded-2xl p-4 shadow-2xl border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-600 rounded-lg text-white">
                <Calculator size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Simulador
                </p>
                <p className="text-sm font-bold text-white line-clamp-1">
                  {simBook.category || simBook.book_class}
                </p>
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">
                {simScore.toFixed(0)}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                pts
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange, small = false }) {
  const inputId = `input-${label.replace(/\s+/g, "-").toLowerCase()}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className={`text-slate-500 font-semibold uppercase tracking-tight ${
          small ? "text-[10px]" : "text-xs"
        }`}
      >
        {label}
      </label>
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs">
          +
        </div>
        <input
          id={inputId}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg pl-8 pr-3 py-2 text-left font-mono font-bold text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none transition-all"
        />
      </div>
    </div>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-transparent text-xs font-bold text-slate-700 dark:text-white outline-none cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-white dark:bg-neutral-900">
          {opt}
        </option>
      ))}
    </select>
  );
}
