import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const SCRIPTS_DIR = path.join(process.cwd(), 'content', 'scripts')

export async function GET(req: NextRequest) {
  try {
    await fs.mkdir(SCRIPTS_DIR, { recursive: true })
    const files = await fs.readdir(SCRIPTS_DIR)
    const scripts = []
    for (const f of files) {
      if (f.endsWith('.md')) {
        const full = path.join(SCRIPTS_DIR, f)
        const txt = await fs.readFile(full, 'utf8')
        scripts.push({ file: f, content: txt })
      }
    }
    return NextResponse.json({ scripts })
  } catch (err:any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const title = (body.title || 'untitled').toString()
    const content = (body.content || '').toString()
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    await fs.mkdir(SCRIPTS_DIR, { recursive: true })
    const filename = `${slug || 'untitled'}.md`
    const full = path.join(SCRIPTS_DIR, filename)
    const fileContent = `---
title: ${title}
---

${content}
`
    await fs.writeFile(full, fileContent, 'utf8')
    return NextResponse.json({ ok: true, file: filename })
  } catch (err:any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
