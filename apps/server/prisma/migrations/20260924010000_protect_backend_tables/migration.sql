-- DevFlow authorizes every request in Express. Its tables must not be exposed
-- through Supabase's REST/GraphQL APIs, even when the public schema is exposed.
-- Enable default-deny RLS without FORCE so the owning Prisma role keeps access.
-- Scope every change to DevFlow tables; leave other apps and default grants alone.
DO $migration$
DECLARE
    table_name TEXT;
    api_role TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'User',
        'Authentication',
        'Session',
        'PasswordReset',
        'Workspace',
        'WorkspaceMember',
        'WorkspaceInvitation',
        'Project',
        'ProjectMember',
        'Column',
        'Task',
        'Comment',
        'Activity',
        '_prisma_migrations'
    ]
    LOOP
        -- Prisma's shadow database replays SQL without creating its history table.
        -- A real migrate deploy creates the table first, so it is protected there.
        IF table_name = '_prisma_migrations'
           AND to_regclass('public._prisma_migrations') IS NULL THEN
            CONTINUE;
        END IF;

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);

        -- These API roles exist on Supabase, but not on a normal local PostgreSQL.
        FOR api_role IN
            SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')
        LOOP
            EXECUTE format(
                'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I',
                table_name,
                api_role
            );
        END LOOP;
    END LOOP;
END
$migration$;
