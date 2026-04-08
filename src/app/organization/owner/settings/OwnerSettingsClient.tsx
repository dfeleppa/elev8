"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Save } from "lucide-react";

import {
  ownerButtonPrimaryClass,
  ownerButtonSecondaryClass,
} from "../../../../components/owner/buttonStyles";
import OwnerSectionCard from "../../../../components/owner/OwnerSectionCard";
import OwnerSettingsSubheader from "../../../../components/owner/OwnerSettingsSubheader";

type OrgSettings = {
  id: string;
  name: string;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  invitationCode: string | null;
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const inputClass =
  "w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-slate-100 placeholder:text-white/25 focus:border-[#ffb1c4]/60 focus:outline-none";
const labelClass =
  "mb-1.5 block text-xs font-medium uppercase tracking-wider text-white/50";

export default function OwnerSettingsClient() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [invitationCode, setInvitationCode] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const res = await fetch("/api/owner/settings");
    const data = await res.json();
    if (!res.ok) {
      setPageError(data.error ?? "Failed to load settings.");
    } else {
      setSettings(data);
      setName(data.name ?? "");
      setAddress(data.address ?? "");
      setPhone(data.phone ?? "");
      setEmail(data.email ?? "");
      setInvitationCode(data.invitationCode ?? "");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  function showSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setPageError(null);

    const res = await fetch("/api/owner/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address, phone, email }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setPageError(data.error ?? "Failed to save.");
      return;
    }

    setSettings(data);
    showSuccess("Organization profile saved.");
  }

  async function handleSaveCode(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setPageError(null);

    const res = await fetch("/api/owner/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invitationCode: invitationCode || null }),
    });

    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      setPageError(data.error ?? "Failed to save.");
      return;
    }

    setSettings(data);
    setInvitationCode(data.invitationCode ?? "");
    showSuccess("Invitation code saved.");
  }

  async function handleLogoUpload(file: File) {
    setUploading(true);
    setPageError(null);

    const formData = new FormData();
    formData.append("logo", file);

    const res = await fetch("/api/owner/settings/logo", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    setUploading(false);

    if (!res.ok) {
      setPageError(data.error ?? "Failed to upload logo.");
      return;
    }

    setSettings((prev) => (prev ? { ...prev, logoUrl: data.logoUrl } : prev));
    showSuccess("Logo uploaded.");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleLogoUpload(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleLogoUpload(file);
  }

  if (loading) {
    return (
      <>
        <OwnerSettingsSubheader />
        <section className="space-y-8 px-5 py-10 lg:px-8 lg:py-16">
          <h1 className="text-3xl font-semibold text-slate-100">General Settings</h1>
          <p className="text-sm text-slate-500">Loading...</p>
        </section>
      </>
    );
  }

  return (
    <>
      <OwnerSettingsSubheader />
      <section className="space-y-8 px-5 py-10 lg:px-8 lg:py-16">
      <header>
        <h1 className="text-3xl font-semibold text-slate-100">General Settings</h1>
        <p className="mt-3 text-sm text-slate-400">
          Manage your organization profile, branding, and invitation code.
        </p>
      </header>

      {/* Success banner */}
      {success && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-300">
          <span>{success}</span>
        </div>
      )}

      {/* Error banner */}
      {pageError && (
        <div className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-300">
          <span>{pageError}</span>
          <button
            type="button"
            className="ml-4 underline opacity-70 hover:opacity-100"
            onClick={() => setPageError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Organization Profile */}
      <OwnerSectionCard title="Organization Profile" meta="">
        <form onSubmit={handleSaveProfile} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="orgName" className={labelClass}>
                Organization Name
              </label>
              <input
                id="orgName"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="My Gym"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="orgAddress" className={labelClass}>
                Address
              </label>
              <input
                id="orgAddress"
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className={inputClass}
                placeholder="123 Main St, City, State ZIP"
              />
            </div>
            <div>
              <label htmlFor="orgPhone" className={labelClass}>
                Telephone
              </label>
              <input
                id="orgPhone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label htmlFor="orgEmail" className={labelClass}>
                Email
              </label>
              <input
                id="orgEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="contact@mygym.com"
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`${ownerButtonPrimaryClass} flex items-center gap-2`}
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </form>
      </OwnerSectionCard>

      {/* Branding / Logo */}
      <OwnerSectionCard title="Branding" meta="">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          {/* Logo preview */}
          <div
            className="group relative flex h-32 w-32 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-white/20 bg-black/20 transition hover:border-[#ffb1c4]/40"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt="Organization logo"
                fill
                className="object-contain p-3"
              />
            ) : (
              <Camera size={32} className="text-white/25" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
              <p className="text-xs font-medium text-white">
                {uploading ? "Uploading..." : "Change Logo"}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-slate-300">
              Upload a square organization logo to replace the top-left Elev8 mark across the app. Supports PNG, JPG, or WebP up to 2MB.
            </p>
            <p className="text-xs text-slate-500">
              Click the preview or drag and drop an image file. Transparent backgrounds work well.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
      </OwnerSectionCard>

      {/* Invitation Code */}
      <OwnerSectionCard title="Invitation Code" meta="">
        <form onSubmit={handleSaveCode} className="space-y-4">
          <p className="text-sm text-slate-400">
            New members must enter this code to join your organization. Share it
            with people you&apos;d like to invite.
          </p>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label htmlFor="invitationCode" className={labelClass}>
                Code
              </label>
              <input
                id="invitationCode"
                type="text"
                value={invitationCode}
                onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
                className={`${inputClass} font-mono text-lg tracking-[0.3em]`}
                placeholder="ABCD1234"
              />
            </div>
            <button
              type="button"
              onClick={() => setInvitationCode(generateCode())}
              className={`${ownerButtonSecondaryClass} flex items-center gap-2`}
              title="Generate random code"
            >
              <RefreshCw size={14} />
              Generate
            </button>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className={`${ownerButtonPrimaryClass} flex items-center gap-2`}
            >
              <Save size={15} />
              {saving ? "Saving..." : "Save Code"}
            </button>
          </div>
        </form>
      </OwnerSectionCard>
      </section>
    </>
  );
}
