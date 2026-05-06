-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill demo photo URLs
-- ─────────────────────────────────────────────────────────────────────────────
-- The original seed wrote placeholder paths like '/captures/IMG_xxx.jpg' that
-- never resolved — the cockpit "Recent photos" strip showed broken tiles. This
-- migration rewrites the demo project's photo URLs to public Unsplash CDN
-- assets that match the captioned subject (concrete, steel, glazing, etc.).
--
-- Idempotent: rewrites only rows that still hold the placeholder path.
-- Scoped to the demo project so real customer projects are untouched.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  demo_project_id constant uuid := 'b1111111-1111-1111-1111-111111111111';
BEGIN
  -- Concrete slab pour
  UPDATE field_captures
     SET file_url = 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=640&q=80&fm=jpg&auto=format&fit=crop'
   WHERE project_id = demo_project_id
     AND content LIKE 'Level 14 slab pour%'
     AND (file_url IS NULL OR file_url LIKE '/captures/%');

  -- Steel erection
  UPDATE field_captures
     SET file_url = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=640&q=80&fm=jpg&auto=format&fit=crop'
   WHERE project_id = demo_project_id
     AND content LIKE 'Steel erection Level 15%'
     AND (file_url IS NULL OR file_url LIKE '/captures/%');

  -- Curtain wall / glazing
  UPDATE field_captures
     SET file_url = 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=640&q=80&fm=jpg&auto=format&fit=crop'
   WHERE project_id = demo_project_id
     AND content LIKE 'Curtain wall%'
     AND (file_url IS NULL OR file_url LIKE '/captures/%');

  -- Fire caulk deficiency
  UPDATE field_captures
     SET file_url = 'https://images.unsplash.com/photo-1581094288338-2314dddb7ece?w=640&q=80&fm=jpg&auto=format&fit=crop'
   WHERE project_id = demo_project_id
     AND content LIKE 'Fire caulk missing%'
     AND (file_url IS NULL OR file_url LIKE '/captures/%');

  -- Stone lobby
  UPDATE field_captures
     SET file_url = 'https://images.unsplash.com/photo-1503387837-b154d5074bd2?w=640&q=80&fm=jpg&auto=format&fit=crop'
   WHERE project_id = demo_project_id
     AND content LIKE 'Lobby stone veneer%'
     AND (file_url IS NULL OR file_url LIKE '/captures/%');

  -- Cracked tile deficiency
  UPDATE field_captures
     SET file_url = 'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=640&q=80&fm=jpg&auto=format&fit=crop'
   WHERE project_id = demo_project_id
     AND content LIKE 'Cracked floor tile%'
     AND (file_url IS NULL OR file_url LIKE '/captures/%');
END $$;
