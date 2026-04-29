"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";

import {
  ownerButtonPrimaryClass,
  ownerButtonSecondaryClass,
} from "@/components/owner/buttonStyles";
import OwnerSectionCard from "@/components/owner/OwnerSectionCard";
import OwnerSettingsSubheader from "@/components/owner/OwnerSettingsSubheader";
import {
  uiBannerErrorClass,
  uiBannerSuccessClass,
  uiCopyClass,
  uiLabelClass,
  uiPageClass,
  uiPageHeaderClass,
  uiTitleClass,
} from "@/components/ui";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const inputClass =
  "ds-field";
const labelClass = uiLabelClass;

export default function OwnerSettingsClient() {
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [invitationCode, setInvitationCode] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setPageError(null);
    const res = await fetch("/api/owner/settings");
    const data = await res.json();
    if (!res.ok) {
      setPageError(data.error ?? "Failed to load settings.");
    } else {
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

    setInvitationCode(data.invitationCode ?? "");
    showSuccess("Invitation code saved.");
  }

  if (loading) {
    return (
      <>
        <OwnerSettingsSubheader />
        <section className={`${uiPageClass} px-5 py-10 lg:px-8 lg:py-16`}>
          <h1 className={uiTitleClass}>General Settings</h1>
          <p className="text-sm text-[var(--text-soft)]">Loading...</p>
        </section>
      </>
    );
  }

  return (
    <>
      <OwnerSettingsSubheader />
      <section className={`${uiPageClass} px-5 py-10 lg:px-8 lg:py-16`}>
      <header className={uiPageHeaderClass}>
        <h1 className={uiTitleClass}>General Settings</h1>
        <p className={uiCopyClass}>
          Manage your organization profile and invitation code.
        </p>
      </header>

      {/* Success banner */}
      {success && (
        <div className={`${uiBannerSuccessClass} flex items-center justify-between`}>
          <span>{success}</span>
        </div>
      )}

      {/* Error banner */}
      {pageError && (
        <div className={`${uiBannerErrorClass} flex items-center justify-between`}>
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

      {/* Invitation Code */}
      <OwnerSectionCard title="Invitation Code" meta="">
        <form onSubmit={handleSaveCode} className="space-y-4">
          <p className="text-sm text-[var(--text-muted)]">
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
