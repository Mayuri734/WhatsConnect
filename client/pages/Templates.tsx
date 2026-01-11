import { useEffect, useState, FormEvent } from "react";
import { Plus, Edit, Trash2, FileText } from "lucide-react";
import Layout from "@/components/Layout";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api";

interface Template {
  _id: string;
  name: string;
  category?: string;
  message: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "",
    message: "",
  });
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();

  // -----------------------------
  // Load templates
  // -----------------------------
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/templates");
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error loading templates:", err);
      toast({
        title: "Error",
        description: "Failed to load templates",
      });
    } finally {
      setLoading(false);
    }
  };

  // -----------------------------
  // Open modal helpers
  // -----------------------------
  const openNew = () => {
    setEditing(null);
    setForm({ name: "", category: "", message: "" });
    setShowModal(true);
  };

  const openEdit = (template: Template) => {
    setEditing(template);
    setForm({
      name: template.name,
      category: template.category || "",
      message: template.message,
    });
    setShowModal(true);
  };

  // -----------------------------
  // Save (Create / Update)
  // -----------------------------
  const handleSave = async (e: FormEvent) => {
  e.preventDefault();

    try {
      setSaving(true);

      const payload = {
        name: form.name,
        category: form.category || "custom",
        message: form.message,
      };

      if (editing) {
        await api.put(`/api/templates/${editing._id}`, payload);
      } else {
        await api.post("/api/templates", payload);
      }

      toast({
        title: editing ? "Template updated" : "Template created",
      });

      setShowModal(false);
      loadTemplates();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Unable to save template",
      });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------
  // Delete
  // -----------------------------
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;

    try {
      await api.delete(`/api/templates/${id}`);
      toast({ title: "Template deleted" });
      loadTemplates();
    } catch (err) {
      console.error(err);
      toast({
        title: "Error",
        description: "Failed to delete template",
      });
    }
  };

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <Layout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              Message Templates
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Create and manage reusable message templates
            </p>
          </div>

          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Template
          </button>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full mb-4">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No templates yet</h3>
            <p className="text-slate-500 mb-6">
              Create templates to save time composing messages
            </p>
            <button
              onClick={openNew}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg"
            >
              <Plus className="w-4 h-4" />
              New Template
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((t) => (
              <div
                key={t._id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6"
              >
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-sm text-slate-500">
                      {t.category || "General"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(t)}>
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(t._id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </div>

                <p className="mt-4 text-sm whitespace-pre-line">
                  {t.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-2xl">
              <h2 className="text-xl font-bold mb-4">
                {editing ? "Edit Template" : "New Template"}
              </h2>

              <form onSubmit={handleSave} className="space-y-4">
                <input
                  required
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  className="w-full p-2 rounded border"
                />

                <input
                  placeholder="Category"
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                  className="w-full p-2 rounded border"
                />

                <textarea
                  required
                  rows={6}
                  placeholder="Message"
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  className="w-full p-2 rounded border"
                />

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-200 p-2 rounded"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={saving}
                    type="submit"
                    className="flex-1 bg-emerald-600 text-white p-2 rounded"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
