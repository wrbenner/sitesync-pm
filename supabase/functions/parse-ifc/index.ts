// parse-ifc: Parse uploaded IFC STEP files and extract structured building data.
// IFC STEP is plaintext — we extract entity counts and basic hierarchy
// (IfcBuilding, IfcBuildingStorey, IfcSpace, IfcWall, IfcDoor, IfcWindow, IfcSlab, ...).



const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

type EntityRow = { ifc_guid: string; ifc_type: string; name: string | null; floor: string | null; trade: string | null }

type ParseSummary = {
  building: string | null
  stories: number
  spaces: number
  walls: number
  doors: number
  windows: number
  slabs: number
  columns: number
  beams: number
  mep: number
  total_elements: number
  summary: string
  entities: EntityRow[]
}

// Extract a single IFC line entity like:
//   #25=IFCBUILDING('GUID',$,'Main Tower',$,$,#28,$,'Main Tower',.ELEMENT.,$,$,$);
// Returns { typeUpper, args } or null if not a top-level entity.
function parseEntity(line: string): { typeUpper: string; args: string[] } | null {
  const m = line.match(/^#(\d+)\s*=\s*([A-Z0-9_]+)\s*\(([\s\S]*)\)\s*;?$/i)
  if (!m) return null
  return { typeUpper: m[2].toUpperCase(), args: splitArgs(m[3]) }
}

function splitArgs(raw: string): string[] {
  const args: string[] = []
  let depth = 0
  let inStr = false
  let current = ''
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (ch === "'" && raw[i - 1] !== '\\') inStr = !inStr
    if (!inStr) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === ',' && depth === 0) {
        args.push(current.trim())
        current = ''
        continue
      }
    }
    current += ch
  }
  if (current.trim()) args.push(current.trim())
  return args
}

function unquote(arg: string | undefined): string | null {
  if (!arg || arg === '$' || arg === '*') return null
  const m = arg.match(/^'(.*)'$/)
  return m ? m[1] : null
}

function tradeFor(type: string): string | null {
  if (/IFC(?:WALL|SLAB|COLUMN|BEAM|FOOTING|ROOF|STAIR)/.test(type)) return 'structural'
  if (/IFC(?:PIPE|VALVE|PUMP|TANK|SANITARY)/.test(type)) return 'plumbing'
  if (/IFC(?:DUCT|AIRTERMINAL|FAN|BOILER|CHILLER)/.test(type)) return 'mechanical'
  if (/IFC(?:CABLE|LIGHT|SWITCH|OUTLET|ELECTRIC)/.test(type)) return 'electrical'
  if (/IFC(?:DOOR|WINDOW|SPACE|BUILDING|STOREY)/.test(type)) return 'architectural'
  return null
}

function parseIFCText(text: string): ParseSummary {
  // Normalize — join physical lines into logical entities (entities end with ";" and can span lines).
  const statements = text.replace(/\/\*[\s\S]*?\*\//g, '').split(/;\s*\n/)

  let building: string | null = null
  let stories = 0
  let spaces = 0
  let walls = 0
  let doors = 0
  let windows = 0
  let slabs = 0
  let columns = 0
  let beams = 0
  let mep = 0
  let total = 0
  const entities: EntityRow[] = []

  for (const raw of statements) {
    const line = raw.trim()
    if (!line || !line.startsWith('#')) continue
    const parsed = parseEntity(line + ';')
    if (!parsed) continue
    const { typeUpper, args } = parsed

    // IFC spatial / element entity args typically: GlobalId, OwnerHistory, Name, Description, ...
    const guid = unquote(args[0]) ?? ''
    const name = unquote(args[2])

    const isBuilding = typeUpper === 'IFCBUILDING'
    const isStorey = typeUpper === 'IFCBUILDINGSTOREY'
    const isSpace = typeUpper === 'IFCSPACE'
    const isWall = typeUpper === 'IFCWALL' || typeUpper === 'IFCWALLSTANDARDCASE'
    const isDoor = typeUpper === 'IFCDOOR'
    const isWindow = typeUpper === 'IFCWINDOW'
    const isSlab = typeUpper === 'IFCSLAB'
    const isColumn = typeUpper === 'IFCCOLUMN'
    const isBeam = typeUpper === 'IFCBEAM'
    const isMep =
      /^IFC(?:PIPE|DUCT|VALVE|PUMP|FAN|BOILER|CHILLER|CABLE|LIGHT|SWITCH|OUTLET|AIRTERMINAL|FLOWSEGMENT|FLOWFITTING)/.test(
        typeUpper
      )

    const captured =
      isBuilding || isStorey || isSpace || isWall || isDoor || isWindow || isSlab || isColumn || isBeam || isMep

    if (isBuilding) {
      building = name ?? building
    }
    if (isStorey) stories++
    else if (isSpace) spaces++
    else if (isWall) walls++
    else if (isDoor) doors++
    else if (isWindow) windows++
    else if (isSlab) slabs++
    else if (isColumn) columns++
    else if (isBeam) beams++
    else if (isMep) mep++

    if (captured && guid && entities.length < 5000) {
      total++
      entities.push({
        ifc_guid: guid,
        ifc_type: typeUpper.replace(/^IFC/, 'Ifc'),
        name,
        floor: null,
        trade: tradeFor(typeUpper),
      })
    }
  }

  const summary = `Building: ${building ?? 'unnamed'}, ${stories} stories, ${spaces} rooms, ${walls} walls, ${doors} doors, ${windows} windows, ${slabs} slabs, ${columns} columns, ${beams} beams, ${mep} MEP`

  return { building, stories, spaces, walls, doors, windows, slabs, columns, beams, mep, total_elements: total, summary, entities }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS_HEADERS })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const fileUrl: string | undefined = body.file_url
    const modelId: string | undefined = body.model_id
    const ifcText: string | undefined = body.ifc_text

    let text: string | null = null
    if (ifcText && typeof ifcText === 'string') {
      text = ifcText
    } else if (fileUrl) {
      const resp = await fetch(fileUrl)
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `Failed to fetch IFC file: ${resp.status}` }), { status: 400, headers: CORS_HEADERS })
      }
      text = await resp.text()
    }

    if (!text) {
      return new Response(JSON.stringify({ error: 'Provide file_url or ifc_text' }), { status: 400, headers: CORS_HEADERS })
    }

    // Cap input size to avoid edge-function memory blowup.
    const MAX_BYTES = 20 * 1024 * 1024
    if (text.length > MAX_BYTES) text = text.slice(0, MAX_BYTES)

    const result = parseIFCText(text)

    // Optionally persist to bim_elements if model_id is provided and service role is available.
    if (modelId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (supabaseUrl && serviceKey) {
        const rows = result.entities.slice(0, 2000).map((e) => ({
          model_id: modelId,
          ifc_guid: e.ifc_guid,
          ifc_type: e.ifc_type,
          name: e.name,
          floor: e.floor,
          trade: e.trade,
        }))
        if (rows.length > 0) {
          await fetch(`${supabaseUrl}/rest/v1/bim_elements`, {
            method: 'POST',
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              'Content-Type': 'application/json',
              Prefer: 'resolution=ignore-duplicates',
            },
            body: JSON.stringify(rows),
          })
        }
      }
    }

    return new Response(JSON.stringify({
      building: result.building,
      stories: result.stories,
      spaces: result.spaces,
      walls: result.walls,
      doors: result.doors,
      windows: result.windows,
      slabs: result.slabs,
      columns: result.columns,
      beams: result.beams,
      mep: result.mep,
      total_elements: result.total_elements,
      summary: result.summary,
      sampled_entities: result.entities.slice(0, 200),
    }), { status: 200, headers: CORS_HEADERS })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS_HEADERS })
  }
})
