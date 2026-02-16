"use client";
import React, {useState} from 'react';
import Link from 'next/link';

export default function Sidebar(){
  const [open,setOpen]=useState(true);
  return (
    <aside className="w-64 bg-gray-100 h-screen p-4">
      <div className="mb-4">
        <button onClick={()=>setOpen(!open)} className="font-semibold">YouTube Scripts</button>
      </div>
      {open && (
        <nav>
          <ul>
            <li className="mb-2"><Link href="/youtube-scripts"><a className="text-blue-600">YouTube Scripts</a></Link></li>
          </ul>
        </nav>
      )}
    </aside>
  )
}
