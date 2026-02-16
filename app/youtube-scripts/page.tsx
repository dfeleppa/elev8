"use client";
import Sidebar from '../../components/Sidebar';
import React from 'react';

export default function Page() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1 className="text-3xl font-bold mb-4">YouTube Scripts</h1>
        <p className="mb-4">Upload and collaborate on scripts here.</p>

        <form id="scriptForm" className="space-y-2" onSubmit={(e) => { e.preventDefault(); alert('Save handled via API'); }}>
          <input name="title" placeholder="Title" className="w-full p-2 border rounded" />
          <textarea name="content" rows={8} placeholder="Paste script here..." className="w-full p-2 border rounded" />
          <div>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </form>

      </main>
    </div>
  );
}
