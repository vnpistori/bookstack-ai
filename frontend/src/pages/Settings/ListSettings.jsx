import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Layers,
  Tag,
  Save,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { api } from "../../services/api";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmationContext";
import { hslToString, getClassBaseHSL } from "../../utils/analyticsUtils.js";
import { DEFAULT_CLASS_CATEGORIES } from "../../utils/constants";

function ListSettings() {
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [classCategories, setClassCategories] = useState({});
  const [editingClass, setEditingClass] = useState(null);
  const [newCategory, setNewCategory] = useState({ class: "", value: "" });
  const [newClass, setNewClass] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const res = await api.get("/preferences/");
      if (
        res.data?.class_categories &&
        Object.keys(res.data.class_categories).length > 0
      ) {
        setClassCategories(res.data.class_categories);
      } else {
        setClassCategories(DEFAULT_CLASS_CATEGORIES);
      }
    } catch (err) {
      console.error("Erro ao carregar listas:", err);
      setClassCategories(DEFAULT_CLASS_CATEGORIES);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.get("/preferences/");
      await api.put("/preferences/", {
        ...res.data,
        class_categories: classCategories,
      });
      await api.post("/books/recalculate_scores");
      addToast({ type: "success", message: "Listas atualizadas com sucesso!" });
    } catch (err) {
      addToast({ type: "error", message: "Erro ao salvar listas." });
    } finally {
      setSaving(false);
    }
  };

  const handleFixOrder = async () => {
    confirm({
      title: "Corrigir Ordem da Fila",
      description:
        "Isso irá reordenar sequencialmente todos os livros (1, 2, 3...) baseados na posição atual, eliminando duplicatas e buracos na numeração. Deseja continuar?",
      confirmText: "Sim, Corrigir",
      onConfirm: async () => {
        try {
          const res = await api.post("/books/fix_consistency");
          addToast({
            type: "success",
            message: res.data.message || "Ordem corrigida com sucesso!",
          });
        } catch (err) {
          console.error(err);
          addToast({ type: "error", message: "Erro ao corrigir ordem." });
        }
      },
    });
  };

  const handleReset = () => {
    confirm({
      title: "Restaurar Padrões",
      description:
        "Isso irá reverter todas as classes e categorias para a configuração original de fábrica. Suas personalizações serão perdidas. Deseja continuar?",
      confirmText: "Sim, Restaurar",
      isDanger: true,
      onConfirm: () => {
        setClassCategories(DEFAULT_CLASS_CATEGORIES);
        addToast({
          type: "info",
          message: "Padrões restaurados. Clique em Salvar para persistir.",
        });
      },
    });
  };

  // Class Actions
  const addClass = () => {
    if (!newClass.trim()) return;
    if (classCategories[newClass]) {
      addToast({ type: "error", message: "Esta classe já existe." });
      return;
    }
    setClassCategories((prev) => ({ ...prev, [newClass.trim()]: [] }));
    setNewClass("");
  };

  const removeClass = (cls) => {
    confirm({
      title: "Excluir Classe",
      description: `Deseja excluir a classe "${cls}" e todas as suas categorias?`,
      confirmText: "Sim, Excluir",
      isDanger: true,
      onConfirm: () => {
        const updated = { ...classCategories };
        delete updated[cls];
        setClassCategories(updated);
      },
    });
  };

  const updateClassName = (oldName, newName) => {
    if (!newName.trim() || oldName === newName) {
      setEditingClass(null);
      return;
    }
    const updated = { ...classCategories };
    updated[newName.trim()] = updated[oldName];
    delete updated[oldName];
    setClassCategories(updated);
    setEditingClass(null);
  };

  // Category Actions
  const addCat = (cls) => {
    const val = newCategory.value.trim();
    if (!val) return;
    if (classCategories[cls].includes(val)) {
      addToast({ type: "error", message: "Categoria já existe nesta classe." });
      return;
    }
    setClassCategories((prev) => ({
      ...prev,
      [cls]: [...prev[cls], val],
    }));
    setNewCategory({ class: "", value: "" });
  };

  const removeCat = (cls, cat) => {
    setClassCategories((prev) => ({
      ...prev,
      [cls]: prev[cls].filter((c) => c !== cat),
    }));
  };

  if (loading)
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse">
        Carregando listas...
      </div>
    );

  return (
    <div className="w-full animate-fade-in space-y-6 pb-20">
      <div className="hidden md:block">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          Listas e Campos
        </h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          Gerencie as classes e categorias que organizam sua biblioteca.
        </p>
      </div>

      {/* Content Area */}
      <div className="space-y-4">
        {Object.entries(classCategories).map(([cls, cats]) => {
          const baseHSL = getClassBaseHSL(cls);
          const classColor = hslToString(baseHSL);

          return (
            <div
              key={cls}
              className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-xl overflow-hidden transition-all group"
            >
              {/* Class Header */}
              <div className="bg-slate-50/50 dark:bg-neutral-800/30 p-4 border-b border-slate-100 dark:border-neutral-800 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div
                    className="w-4 h-4 rounded-full shadow-sm flex-shrink-0"
                    style={{ backgroundColor: classColor }}
                  ></div>

                  {editingClass === cls ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <input
                        autoFocus
                        defaultValue={cls}
                        className="w-full px-2 py-1 text-sm bg-white dark:bg-neutral-800 border-b-2 border-purple-500 outline-none text-slate-800 dark:text-white font-bold"
                        onKeyDown={(e) => {
                          if (e.key === "Enter")
                            updateClassName(cls, e.target.value);
                          if (e.key === "Escape") setEditingClass(null);
                        }}
                        onBlur={(e) => updateClassName(cls, e.target.value)}
                      />
                    </div>
                  ) : (
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">
                      {cls}
                    </h3>
                  )}

                  <button
                    onClick={() => setEditingClass(cls)}
                    className="p-1.5 text-slate-400 hover:text-purple-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>

                <button
                  onClick={() => removeClass(cls)}
                  className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>

              {/* Categories Area */}
              <div className="p-4 bg-white dark:bg-neutral-900">
                <div className="flex flex-wrap gap-2 mb-4">
                  {cats.map((cat, idx) => {
                    const lightnessStep = 6;
                    const offset =
                      (idx - (cats.length - 1) / 2) * lightnessStep;
                    const bgL = Math.max(92, Math.min(99, 94 + offset / 3));
                    const catBg = hslToString({ ...baseHSL, l: bgL, s: 70 });
                    const textL = Math.max(30, Math.min(50, baseHSL.l - 40));
                    const catText = hslToString({
                      ...baseHSL,
                      l: textL,
                      s: 45,
                    });

                    return (
                      <div
                        key={cat}
                        className="group/tag flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition-all hover:pr-1"
                        style={{
                          backgroundColor: catBg,
                          color: catText,
                          borderColor: `${catText}30`,
                        }}
                      >
                        {cat}
                        <button
                          onClick={() => removeCat(cls, cat)}
                          className="p-0.5 hover:bg-black/10 rounded-full opacity-0 group-hover/tag:opacity-100 transition-opacity"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add Category Input Inline */}
                  <div className="flex items-center">
                    {newCategory.class === cls ? (
                      <div className="flex items-center gap-1 bg-slate-50 dark:bg-neutral-800 pl-3 pr-1 py-1 rounded-full border border-purple-500/30 animate-scale-in">
                        <input
                          autoFocus
                          placeholder="Nova categoria..."
                          className="bg-transparent border-none outline-none text-[11px] w-28 text-slate-700 dark:text-slate-300"
                          value={newCategory.value}
                          onChange={(e) =>
                            setNewCategory({
                              ...newCategory,
                              value: e.target.value,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addCat(cls);
                            if (e.key === "Escape")
                              setNewCategory({ class: "", value: "" });
                          }}
                        />
                        <button
                          onClick={() => addCat(cls)}
                          className="p-1 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={() =>
                            setNewCategory({ class: "", value: "" })
                          }
                          className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() =>
                          setNewCategory({ class: cls, value: "" })
                        }
                        className="flex items-center gap-1 px-3 py-1 rounded-full border border-dashed border-slate-300 dark:border-neutral-700 text-slate-400 hover:border-purple-500 hover:text-purple-500 transition-all text-xs"
                      >
                        <Plus size={12} />
                        Categoria
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add New Class */}
        <div className="border-2 border-dashed border-slate-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col items-center justify-center text-center group hover:border-purple-500/50 transition-all">
          <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-neutral-800 flex items-center justify-center mb-3 group-hover:bg-purple-50 dark:group-hover:bg-purple-900/20 transition-all">
            <Plus
              className="text-slate-400 group-hover:text-purple-500"
              size={24}
            />
          </div>
          <h3 className="text-slate-800 dark:text-white font-bold mb-4">
            Nova Categoria de Livros
          </h3>

          <div className="flex gap-2 w-full max-w-sm">
            <input
              placeholder="Ex: Hobbies, Carreira..."
              className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-800 dark:text-white focus:ring-2 focus:ring-purple-500 focus:outline-none"
              value={newClass}
              onChange={(e) => setNewClass(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addClass()}
            />
            <button
              onClick={addClass}
              className="px-4 py-2 bg-slate-900 dark:bg-neutral-700 hover:bg-slate-800 dark:hover:bg-neutral-600 text-white font-bold rounded-lg transition-all"
            >
              Criar
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Actions */}
      <div className="flex justify-between items-center bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-neutral-800 sticky bottom-6 shadow-2xl">
        <button
          onClick={handleReset}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-red-500 transition-colors"
        >
          <RotateCcw size={18} />
          Restaurar Padrões
        </button>

        <button
          onClick={handleFixOrder}
          className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-amber-600 transition-colors mr-auto ml-6"
        >
          <Wrench size={18} />
          Corrigir Ordem
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          <Save size={18} />
          {saving ? "Salvando..." : "Salvar Listas"}
        </button>
      </div>
    </div>
  );
}

export default ListSettings;
