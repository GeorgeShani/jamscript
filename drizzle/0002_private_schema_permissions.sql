-- Workspace data is reached only through server routes that verify Clerk sessions
-- and workspace membership. Do not add this schema to Supabase's exposed API schemas.
REVOKE ALL ON SCHEMA "jamscript" FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON ALL TABLES IN SCHEMA "jamscript" FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA "jamscript" FROM anon';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "jamscript" FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA "jamscript" FROM authenticated';
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA "jamscript" FROM authenticated';
  END IF;
END $$;
