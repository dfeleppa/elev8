"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { CalendarClock, Package, ShoppingBag } from "lucide-react";

type ProductOption = {
  id: string;
  option_name: string;
  option_values: string[];
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
  defer_to_invoice: boolean;
  has_options: boolean;
  store_product_options: ProductOption[];
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

function formatDate(d: string | null) {
  if (!d) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(d));
}

export default function MemberStoreClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [preorders, setPreorders] = useState<Preorder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/member/store")
      .then((r) => r.json())
      .then((data) => {
        setProducts(data.products ?? []);
        setPreorders(data.preorders ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const categories = [
    "All",
    ...Array.from(new Set(products.map((p) => p.category).filter(Boolean) as string[])),
  ];

  const filteredProducts =
    activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);

  // Which products are part of an active preorder?
  const preorderProductIds = new Set(
    preorders.flatMap((pr) => pr.store_preorder_items.map((i) => i.product_id))
  );

  function openProduct(p: Product) {
    setSelectedProduct(p);
    const defaults: Record<string, string> = {};
    for (const opt of p.store_product_options) {
      defaults[opt.option_name] = opt.option_values[0] ?? "";
    }
    setSelectedOptions(defaults);
  }

  return (
    <section className="space-y-8">
      <header>
        <div className="flex items-center gap-3">
          <ShoppingBag size={28} className="text-[#ffb1c4]" />
          <h1 className="text-3xl font-semibold text-slate-100">Store</h1>
        </div>
        <p className="mt-2 text-sm text-slate-400">Browse available products from your gym.</p>
      </header>

      {/* Active preorder banners */}
      {preorders.length > 0 && (
        <div className="space-y-3">
          {preorders.map((pr) => (
            <div
              key={pr.id}
              className="flex items-start gap-4 rounded-2xl border border-[#ffb1c4]/20 bg-[#ffb1c4]/5 p-4"
            >
              <CalendarClock size={20} className="mt-0.5 shrink-0 text-[#ffb1c4]" />
              <div>
                <p className="font-semibold text-slate-100">{pr.name}</p>
                {pr.description && <p className="mt-0.5 text-xs text-slate-400">{pr.description}</p>}
                <div className="mt-1 flex flex-wrap gap-4 text-xs text-slate-500">
                  {pr.order_deadline && (
                    <span>
                      Order by: <span className="font-medium text-[#ffb1c4]">{formatDate(pr.order_deadline)}</span>
                    </span>
                  )}
                  {pr.estimated_delivery_date && (
                    <span>
                      Est. delivery: <span className="text-slate-300">{formatDate(pr.estimated_delivery_date)}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category filter */}
      {categories.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={
                activeCategory === cat
                  ? "rounded-full border border-[#ffb1c4]/40 bg-[#ffb1c4]/15 px-4 py-1.5 text-sm font-semibold text-[#ffb1c4] transition-colors"
                  : "rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-[20px] bg-white/5" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Package size={48} className="text-white/15" />
          <p className="text-slate-400">No products available right now.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((p) => {
            const isPreorder = preorderProductIds.has(p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => openProduct(p)}
                className="group text-left rounded-[20px] border border-white/10 bg-white/5 overflow-hidden transition hover:border-[#ffb1c4]/30 hover:bg-white/8 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffb1c4]/50"
              >
                {/* Thumbnail */}
                <div className="relative h-44 w-full bg-black/20">
                  {p.image_url ? (
                    <Image
                      src={p.image_url}
                      alt={p.name}
                      fill
                      className="object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Package size={36} className="text-white/15" />
                    </div>
                  )}
                  {isPreorder && (
                    <span className="absolute left-3 top-3 rounded-full border border-[#ffb1c4]/30 bg-[#1a0d12] px-2.5 py-0.5 text-[10px] font-semibold text-[#ffb1c4]">
                      PREORDER
                    </span>
                  )}
                  {p.category && (
                    <span className="absolute right-3 top-3 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] text-slate-300">
                      {p.category}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="font-semibold text-slate-100 leading-snug">{p.name}</p>
                  {p.description && (
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">{p.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-lg font-bold text-[#ffb1c4]">
                      ${Number(p.price).toFixed(2)}
                    </p>
                    {p.inventory_count != null && p.inventory_count <= 5 && (
                      <span className="text-xs text-amber-400">Only {p.inventory_count} left</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Product Detail / Order Modal ── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            onClick={() => setSelectedProduct(null)}
            aria-label="Close"
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px] border border-white/15 bg-[#111418] shadow-2xl">
            {/* Product image */}
            {selectedProduct.image_url && (
              <div className="relative h-52 w-full overflow-hidden rounded-t-[28px]">
                <Image
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}

            <div className="p-6 space-y-4">
              {selectedProduct.category && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-400">
                  {selectedProduct.category}
                </span>
              )}
              <h2 className="text-2xl font-bold text-slate-100">{selectedProduct.name}</h2>
              {selectedProduct.description && (
                <p className="text-sm text-slate-400">{selectedProduct.description}</p>
              )}

              <p className="text-2xl font-bold text-[#ffb1c4]">
                ${Number(selectedProduct.price).toFixed(2)}
                {selectedProduct.tax_rate && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    {selectedProduct.tax_included_in_price ? "tax incl." : `+ ${selectedProduct.tax_rate} tax`}
                  </span>
                )}
              </p>

              {/* Options */}
              {selectedProduct.store_product_options.map((opt) => (
                <div key={opt.id}>
                  <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50">
                    {opt.option_name}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {opt.option_values.map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSelectedOptions((prev) => ({ ...prev, [opt.option_name]: val }))}
                        className={
                          selectedOptions[opt.option_name] === val
                            ? "rounded-xl border border-[#ffb1c4]/50 bg-[#ffb1c4]/15 px-3 py-1.5 text-sm font-semibold text-[#ffb1c4]"
                            : "rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:border-white/30"
                        }
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {selectedProduct.defer_to_invoice && (
                <p className="text-xs text-slate-500 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                  This item will be added to your next invoice.
                </p>
              )}

              {selectedProduct.inventory_count != null && selectedProduct.inventory_count === 0 ? (
                <button
                  type="button"
                  disabled
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-slate-500 cursor-not-allowed"
                >
                  Out of Stock
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full rounded-xl border border-[#ffb1c4]/30 bg-gradient-to-r from-[#ff4a8d] to-[#ff7aa9] py-3 text-sm font-semibold text-[#2a0818] shadow-[0_10px_24px_rgba(255,74,141,0.35)] transition hover:brightness-110"
                  onClick={() => {
                    // Purchase flow placeholder — will wire to payment in next pass
                    alert("Purchase flow coming soon!");
                  }}
                >
                  {preorderProductIds.has(selectedProduct.id) ? "Place Preorder" : "Add to Order"}
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm text-slate-400 transition hover:bg-white/10"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
