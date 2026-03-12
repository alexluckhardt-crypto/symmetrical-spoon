import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { fileName, fileType } = await req.json()
    if (!fileName) return NextResponse.json({ error: 'fileName required' }, { status: 400 })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Debug: tell client exactly what's missing
    if (!supabaseUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL not set in Vercel env vars' }, { status: 503 })
    if (!serviceKey) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not set in Vercel env vars' }, { status: 503 })
    if (!supabaseUrl.startsWith('https://')) return NextResponse.json({ error: 'NEXT_PUBLIC_SUPABASE_URL must start with https://' }, { status: 503 })

    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `uploads/${Date.now()}_${safeName}`

    // Try signed upload URL first
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/upload/sign/raw-footage/${path}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!res.ok) {
      const errText = await res.text()
      // Fall back: return a direct upload URL using service role key
      // The client will PUT directly with the service role key in the header
      const publicUrl = `${supabaseUrl}/storage/v1/object/raw-footage/${path}`
      return NextResponse.json({ 
        directUrl: publicUrl,
        publicUrl: `${supabaseUrl}/storage/v1/object/public/raw-footage/${path}`,
        serviceKey, // send service key so client can upload directly
        path,
        signedUrlError: errText
      })
    }

    const data = await res.json()
    const signedUrl = data.signedURL
      ? (data.signedURL.startsWith('http') ? data.signedURL : `${supabaseUrl}${data.signedURL}`)
      : null

    if (!signedUrl) {
      // Same fallback
      return NextResponse.json({
        directUrl: `${supabaseUrl}/storage/v1/object/raw-footage/${path}`,
        publicUrl: `${supabaseUrl}/storage/v1/object/public/raw-footage/${path}`,
        serviceKey,
        path,
      })
    }

    return NextResponse.json({ 
      signedUrl, 
      publicUrl: `${supabaseUrl}/storage/v1/object/public/raw-footage/${path}`, 
      path 
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
