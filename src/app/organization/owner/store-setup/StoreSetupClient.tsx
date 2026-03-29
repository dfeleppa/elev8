"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Package, Plus, Trash2, X } from "lucide-react";

import {
  ownerButtonPrimaryClass,
  ownerButtonSecondaryClass,
  ownerIconButtonDangerClass,
} from "../../../../components/owner/buttonStyles";
import OwnerSectionCard from "../../../../components/owner/OwnerSectionCard";
import OwnerSettingsSubheader from "../../../../components/owner/OwnerSettingsSubheader";

type ProductOption = {
  optionName: string;
  optionValues: string[];
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  coaches_price: number | null;
  tax_rate: string | null;
  tax_included_in_price: boolean;
  inventory_count: number | null;
  image_url: string | null;
  hidden_in_store: boolean;
  defer_to_invoice: boolean;
  notify_admins_on_purchase: boolean;
  has_options: boolean;
  store_product_options: { id: string; option_name: string; option_values: string[] }[];
};

type Preorder = {
  id: string;
  name: string;
  description: string | null;
  order_deadline: string | null;
  estimated_delivery_date: string | null;
  is_active: boolean;
  store_preorder_items: { product_id: string }[];
};

const EMPTY_DRAFT = {
  name: "",
  description: "",
  category: "",
  price: "",
  coachesPrice: "",
  taxRate: "",
  taxIncludedInPrice: false,
  inventoryCount: "",
  hiddenInStore: false,
  deferToInvoice: false,
  notifyAdminsOnPurchase: false,
  hasOptions: false,
  options: [{ optionName: "", optionValues: "" }] as { optionName: string; optionValues: string }[],
};

const EMPTY_PREORDER_DRAFT = {
  name: "",
  description: "",
  orderDeadline: "",
  estimatedDeliveryDate: "",
  isActive: true,
  productIds: [] as string[],
};

const inputClass =
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-slate-100 placeholder:text-white/25 focus:border-[#ffb1c4]/60 focus:outline-none";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50";
const checkboxRowClass =
  "flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3";

export default function StoreSetupClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Category filter
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Add product modal
  const [showModal, setShowModal] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [draftImageUrl, setDraftImageUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Preorder modal
  const [showPreorderModal, setShowPreorderModal] = useState(false);
  const [preorderDraft, setPreorderDraft] = useState({ ...EMPTY_PREORDER_DRAFT });
  const [savingPreorder, setSavingPreorder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const res = await fetch("/api/owner/store");
    const data = await res.json();
    if (!res.ok) {
      setPageError(data.error ?? "Failed to load products.");
    } else {
      setProducts(data.products ?? []);
    }
    const preRes = await fetch("/api/owner/preorders");
    const preData = await preRes.json();
    if (preRes.ok) setPreorders(preData.preorders ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  const categories = ["All", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[]))];

  const filteredProducts =
    activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);

  // ----- Product image upload -----
  async function handleImageUpload(file: File) {
    setUploadingImage(true);
    const formData = new FormData();
    formData.append("image", file);
    const res = await fetch("/api/owner/store/image", { method: "POST", body: formData });
    const data = await res.json();
    setUploadingImage(false);
    if (res.ok && data.imageUrl) {
      setDraftImageUrl(data.imageUrl);
      setDraft((prev) => ({ ...prev }));
    }
  }

  // ----- Add product -----
  async function handleSaveProduct(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setPageError(null);

    const options: ProductOption[] = draft.hasOptions
      ? draft.options
          .filter((o) => o.optionName.trim())
          .map((o) => ({
            optionName: o.optionName.trim(),
            optionValues: o.optionValues
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean),
          }))
      : [];

    const res = await fetch("/api/owner/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        description: draft.description,
        category: draft.category,
        price: draft.price,
        coachesPrice: draft.coachesPrice || null,
        taxRate: draft.taxRate || null,
        taxIncludedInPrice: draft.taxIncludedInPrice,
        inventoryCount: draft.inventoryCount || null,
        imageUrl: draftImageUrl || null,
        hiddenInStore: draft.hiddenInStore,
        deferToInvoice: draft.deferToInvoice,
        notifyAdminsOnPurchase: draft.notifyAdminsOnPurchase,
        hasOptions: draft.hasOptions,
        options,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setPageError(data.error ?? "Failed to save product.");
      return;
    }

    setProducts((prev) => [data.product, ...prev]);
    setShowModal(false);
    setDraft({ ...EMPTY_DRAFT });
    setDraftImageUrl(null);
    showSuccess("Product added.");
  }

  // ----- Delete product -----
  async function handleDeleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`/api/owner/store/${id}`, { method: "DELETE" });
    if (res.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== id));
      showSuccess("Product deleted.");
    }
  }

  // ----- Add preorder -----
  async function handleSavePreorder(e: React.FormEvent) {
    e.preventDefault();
    setSavingPreorder(true);
    setPageError(null);

    const res = await fetch("/api/owner/preorders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preorderDraft),
    });

    const data = await res.json();
    setSavingPreorder(false);

    if (!res.ok) {
      setPageError(data.error ?? "Failed to save preorder.");
      return;
    }

    setPreorders((prev) => [data.preorder, ...prev]);
    setShowPreorderModal(false);
    setPreorderDraft({ ...EMPTY_PREORDER_DRAFT });
    showSuccess("Preorder campaign created.");
  }

  return (
    <>
      <OwnerSettingsSubheader />
      <div className="space-y-8 px-5 py-10 lg:px-8 lg:py-16 mx-auto max-w-6xl">
        <header className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold text-slate-100">Store Setup</h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage your products, pricing, and preorder campaigns.
            </p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPreorderModal(true)}
              className={ownerButtonSecondaryClass}
            >
              + New Preorder
            </button>
            <button
              type="button"
              onClick={() => { setShowModal(true); setDraftImageUrl(null); }}
              className={`${ownerButtonPrimaryClass} flex items-center gap-2`}
            >
              <Plus size={15} />
              Add Product
            </button>
          </div>
        </header>

        {success && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
            {success}
          </div>
        )}
        {pageError && (
          <div className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
            <span>{pageError}</span>
            <button type="button" className="ml-4 underline opacity-70 hover:opacity-100" onClick={() => setPageError(null)}>
              Dismiss
            </button>
          </div>
        )}

        {/* ── Products Table ── */}
        <OwnerSectionCard
          title="Products"
          meta={`${filteredProducts.length} item${filteredProducts.length !== 1 ? "s" : ""}`}
          headerRight={
            categories.length > 1 ? (
              <div className="flex gap-1 flex-wrap">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={
                      activeCategory === cat
                        ? "rounded-full border border-white/40 bg-white/20 px-2.5 py-0.5 text-[11px] font-semibold text-white"
                        : "rounded-full border border-white/20 px-2.5 py-0.5 text-[11px] text-white/60 hover:bg-white/10"
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            ) : undefined
          }
        >
          {loading ? (
            <p className="text-sm text-slate-500">Loading...</p>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Package size={40} className="text-white/20" />
              <p className="text-sm text-slate-400">No products yet. Click <strong>Add Product</strong> to get started.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Product</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white/40">Category</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-white/40">Price</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white/40">Inventory</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white/40">Visible</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-3">
                          {p.image_url ? (
                            <Image
                              src={p.image_url}
                              alt={p.name}
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                              <Package size={16} className="text-white/30" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-slate-100">{p.name}</p>
                            {p.description && (
                              <p className="text-xs text-slate-500 line-clamp-1">{p.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-400">
                        {p.category ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs">
                            {p.category}
                          </span>
                        ) : (
                          <span className="text-white/20">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-200">
                        ${Number(p.price).toFixed(2)}
                        {p.coaches_price != null && (
                          <p className="text-xs text-slate-500">Coach: ${Number(p.coaches_price).toFixed(2)}</p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-300">
                        {p.inventory_count ?? <span className="text-white/20">∞</span>}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {p.hidden_in_store ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40">Hidden</span>
                        ) : (
                          <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300">Visible</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteProduct(p.id)}
                          className={ownerIconButtonDangerClass}
                          aria-label="Delete product"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </OwnerSectionCard>

        {/* ── Preorders ── */}
        <OwnerSectionCard title="Preorder Campaigns" meta={`${preorders.length} active`}>
          {preorders.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <p className="text-sm text-slate-400">No preorder campaigns yet. Use <strong>New Preorder</strong> to create one.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {preorders.map((pr) => (
                <div key={pr.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-100">{pr.name}</p>
                      {pr.description && <p className="mt-1 text-xs text-slate-400">{pr.description}</p>}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                        {pr.order_deadline && (
                          <span>Order deadline: <span className="text-slate-300">{pr.order_deadline}</span></span>
                        )}
                        {pr.estimated_delivery_date && (
                          <span>Est. delivery: <span className="text-slate-300">{pr.estimated_delivery_date}</span></span>
                        )}
                        <span>
                          {pr.store_preorder_items?.length ?? 0} product{(pr.store_preorder_items?.length ?? 0) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <span className={pr.is_active
                      ? "rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300"
                      : "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-white/40"
                    }>
                      {pr.is_active ? "Active" : "Closed"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </OwnerSectionCard>
      </div>

      {/* ──── Add Product Modal ──── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowModal(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/15 bg-[#111418] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#e11d8a] px-6 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">Add Product</p>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-full border border-white/20 p-1.5 text-white/80 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* ── Left: Product Info & Price ── */}
                <div className="lg:col-span-2 space-y-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/40">Product Info and Price</p>

                  {/* Category + image thumb */}
                  <div className="flex gap-3 items-start">
                    <div className="flex-1">
                      <label className={labelClass}>Product Category</label>
                      <input
                        type="text"
                        value={draft.category}
                        onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}
                        placeholder="e.g. Apparel, Supplements..."
                        className={inputClass}
                        list="category-list"
                      />
                      <datalist id="category-list">
                        {Array.from(new Set(products.map((p) => p.category).filter(Boolean))).map((c) => (
                          <option key={c as string} value={c as string} />
                        ))}
                      </datalist>
                    </div>
                    {/* Thumbnail upload */}
                    <div>
                      <label className={labelClass}>Photo</label>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="group relative flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/20 bg-black/20 transition hover:border-[#ffb1c4]/40"
                      >
                        {draftImageUrl ? (
                          <Image src={draftImageUrl} alt="Product" fill className="object-cover" />
                        ) : (
                          <Camera size={18} className="text-white/30" />
                        )}
                        {uploadingImage && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-[10px] text-white">...</div>
                        )}
                      </button>
                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleImageUpload(f);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Product Name *</label>
                    <input
                      type="text"
                      required
                      value={draft.name}
                      onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Product Name"
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Product Description *</label>
                    <textarea
                      required
                      value={draft.description}
                      onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))}
                      placeholder="Product Description"
                      rows={2}
                      className={`${inputClass} resize-none`}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Price *</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">$</span>
                        <input
                          type="number"
                          required
                          min="0"
                          step="0.01"
                          value={draft.price}
                          onChange={(e) => setDraft((p) => ({ ...p, price: e.target.value }))}
                          className={`${inputClass} pl-7`}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Coaches Price (optional)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft.coachesPrice}
                          onChange={(e) => setDraft((p) => ({ ...p, coachesPrice: e.target.value }))}
                          className={`${inputClass} pl-7`}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Tax Rate</label>
                      <select
                        value={draft.taxRate}
                        onChange={(e) => setDraft((p) => ({ ...p, taxRate: e.target.value }))}
                        className={inputClass}
                      >
                        <option value="">Tax Rate</option>
                        <option value="0%">0%</option>
                        <option value="5%">5%</option>
                        <option value="8%">8%</option>
                        <option value="10%">10%</option>
                        <option value="13%">13%</option>
                        <option value="15%">15%</option>
                        <option value="20%">20%</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Tax Included in Price *</label>
                      <select
                        value={draft.taxIncludedInPrice ? "yes" : "no"}
                        onChange={(e) => setDraft((p) => ({ ...p, taxIncludedInPrice: e.target.value === "yes" }))}
                        className={inputClass}
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* ── Right: Options + Payment/Notification ── */}
                <div className="space-y-4">
                  {/* Product/Inventory Options */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Product / Inventory Options</p>
                    <label className={checkboxRowClass}>
                      <input
                        type="checkbox"
                        checked={draft.hasOptions}
                        onChange={(e) => setDraft((p) => ({ ...p, hasOptions: e.target.checked }))}
                        className="mt-0.5 h-4 w-4 rounded border-white/20"
                      />
                      <span className="text-sm text-slate-300">Define Product Options (i.e. sizes, colors, flavors...)</span>
                    </label>

                    {draft.hasOptions && (
                      <div className="mt-3 space-y-2">
                        {draft.options.map((opt, idx) => (
                          <div key={idx} className="space-y-1">
                            <input
                              type="text"
                              value={opt.optionName}
                              onChange={(e) => setDraft((p) => {
                                const opts = [...p.options];
                                opts[idx] = { ...opts[idx], optionName: e.target.value };
                                return { ...p, options: opts };
                              })}
                              placeholder="Option name (e.g. Size)"
                              className={inputClass}
                            />
                            <input
                              type="text"
                              value={opt.optionValues}
                              onChange={(e) => setDraft((p) => {
                                const opts = [...p.options];
                                opts[idx] = { ...opts[idx], optionValues: e.target.value };
                                return { ...p, options: opts };
                              })}
                              placeholder="Values, comma-separated (S, M, L)"
                              className={inputClass}
                            />
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => setDraft((p) => ({ ...p, options: [...p.options, { optionName: "", optionValues: "" }] }))}
                          className="text-xs text-[#ffb1c4] hover:underline"
                        >
                          + Add another option
                        </button>
                      </div>
                    )}

                    <div className="mt-3">
                      <label className={labelClass}>Inventory Count</label>
                      <input
                        type="number"
                        min="0"
                        value={draft.inventoryCount}
                        onChange={(e) => setDraft((p) => ({ ...p, inventoryCount: e.target.value }))}
                        placeholder="Leave blank for unlimited"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  {/* Payment / Notification Options */}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Payment / Notification Options</p>
                    <div className="space-y-2">
                      <label className={checkboxRowClass}>
                        <input
                          type="checkbox"
                          checked={draft.deferToInvoice}
                          onChange={(e) => setDraft((p) => ({ ...p, deferToInvoice: e.target.checked }))}
                          className="mt-0.5 h-4 w-4 rounded border-white/20"
                        />
                        <span className="text-xs text-slate-300">Defer purchases to customer&apos;s next Invoice (Recommended to avoid transaction fees on small purchases)</span>
                      </label>
                      <label className={checkboxRowClass}>
                        <input
                          type="checkbox"
                          checked={draft.notifyAdminsOnPurchase}
                          onChange={(e) => setDraft((p) => ({ ...p, notifyAdminsOnPurchase: e.target.checked }))}
                          className="mt-0.5 h-4 w-4 rounded border-white/20"
                        />
                        <span className="text-xs text-slate-300">Send in-app notification to Admins when purchased</span>
                      </label>
                      <label className={checkboxRowClass}>
                        <input
                          type="checkbox"
                          checked={draft.hiddenInStore}
                          onChange={(e) => setDraft((p) => ({ ...p, hiddenInStore: e.target.checked }))}
                          className="mt-0.5 h-4 w-4 rounded border-white/20"
                        />
                        <span className="text-xs text-slate-300">Hidden in Store</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className={ownerButtonSecondaryClass}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`${ownerButtonPrimaryClass} flex items-center gap-2`}
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──── New Preorder Modal ──── */}
      {showPreorderModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowPreorderModal(false)}
            aria-label="Close modal"
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-[28px] border border-white/15 bg-[#111418] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 bg-[#e11d8a] px-6 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white">New Preorder Campaign</p>
              <button
                type="button"
                onClick={() => setShowPreorderModal(false)}
                className="rounded-full border border-white/20 p-1.5 text-white/80 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleSavePreorder} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={preorderDraft.name}
                  onChange={(e) => setPreorderDraft((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Spring Apparel Drop"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={preorderDraft.description}
                  onChange={(e) => setPreorderDraft((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Describe what members are pre-ordering..."
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Order Deadline</label>
                  <input
                    type="date"
                    value={preorderDraft.orderDeadline}
                    onChange={(e) => setPreorderDraft((p) => ({ ...p, orderDeadline: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Est. Delivery Date</label>
                  <input
                    type="date"
                    value={preorderDraft.estimatedDeliveryDate}
                    onChange={(e) => setPreorderDraft((p) => ({ ...p, estimatedDeliveryDate: e.target.value }))}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Link Products (optional)</label>
                <div className="max-h-40 overflow-y-auto space-y-1 rounded-xl border border-white/10 bg-black/20 p-3">
                  {products.length === 0 ? (
                    <p className="text-xs text-slate-500">No products yet.</p>
                  ) : (
                    products.map((p) => (
                      <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={preorderDraft.productIds.includes(p.id)}
                          onChange={(e) => setPreorderDraft((prev) => ({
                            ...prev,
                            productIds: e.target.checked
                              ? [...prev.productIds, p.id]
                              : prev.productIds.filter((id) => id !== p.id),
                          }))}
                          className="h-4 w-4 rounded border-white/20"
                        />
                        <span className="text-sm text-slate-300">{p.name}</span>
                        {p.category && <span className="text-xs text-slate-500">({p.category})</span>}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <label className={checkboxRowClass}>
                <input
                  type="checkbox"
                  checked={preorderDraft.isActive}
                  onChange={(e) => setPreorderDraft((p) => ({ ...p, isActive: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-white/20"
                />
                <span className="text-sm text-slate-300">Active (visible to members)</span>
              </label>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowPreorderModal(false)}
                  className={ownerButtonSecondaryClass}
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={savingPreorder}
                  className={`${ownerButtonPrimaryClass} flex items-center gap-2`}
                >
                  {savingPreorder ? "Saving..." : "Create Preorder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
