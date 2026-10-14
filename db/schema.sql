CREATE TABLE IF NOT EXISTS public.team_members (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.team_invites (
  user_id text PRIMARY KEY,
  email text NOT NULL,
  created_by text DEFAULT auth.user_id(),
  created_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 120),
  project text NOT NULL DEFAULT 'Team updates',
  assignee_id text REFERENCES public.team_members(id),
  priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High', 'Medium', 'Low')),
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  due_date date,
  created_by text NOT NULL REFERENCES public.team_members(id),
  completed_by text REFERENCES public.team_members(id),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION public.is_board_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM neon_auth."user" AS account
    WHERE account.id::text = auth.user_id()
      AND account.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_board_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members AS member
    WHERE member.id = auth.user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.join_team_member(member_display_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_user_id text := auth.user_id();
  current_email text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Sign in before joining the team';
  END IF;

  SELECT account.email INTO current_email
  FROM neon_auth."user" AS account
  WHERE account.id::text = current_user_id;

  IF current_email IS NULL THEN
    RAISE EXCEPTION 'Could not verify the signed-in account';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.team_members AS member
    WHERE member.id = current_user_id
  ) THEN
    UPDATE public.team_members
    SET display_name = member_display_name
    WHERE id = current_user_id;
    RETURN current_user_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.team_invites AS invite
    WHERE invite.user_id = current_user_id
      AND lower(invite.email) = lower(current_email)
      AND invite.used_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This account has not been invited to the team';
  END IF;

  INSERT INTO public.team_members (id, email, display_name)
  VALUES (current_user_id, current_email, member_display_name);

  UPDATE public.team_invites
  SET used_at = now()
  WHERE user_id = current_user_id;

  RETURN current_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_task_activity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.user_id();
    NEW.created_at := now();
    IF NEW.status = 'done' THEN
      NEW.completed_by := auth.user_id();
      NEW.completed_at := now();
    ELSE
      NEW.completed_by := NULL;
      NEW.completed_at := NULL;
    END IF;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status = 'done' THEN
        NEW.completed_by := auth.user_id();
        NEW.completed_at := now();
      ELSE
        NEW.completed_by := NULL;
        NEW.completed_at := NULL;
      END IF;
    ELSE
      NEW.completed_by := OLD.completed_by;
      NEW.completed_at := OLD.completed_at;
    END IF;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_stamp_activity ON public.tasks;
CREATE TRIGGER tasks_stamp_activity
  BEFORE INSERT OR UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.stamp_task_activity();

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.team_members TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.team_members FROM authenticated;
GRANT INSERT ON public.team_invites TO authenticated;
REVOKE SELECT, UPDATE, DELETE ON public.team_invites FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON public.tasks TO authenticated;
REVOKE ALL ON FUNCTION public.is_board_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_board_member() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.join_team_member(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_board_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_board_member() TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_team_member(text) TO authenticated;

DROP POLICY IF EXISTS team_members_read_team ON public.team_members;
CREATE POLICY team_members_read_team ON public.team_members
  FOR SELECT TO authenticated USING (public.is_board_member() OR public.is_board_admin());

DROP POLICY IF EXISTS team_members_create_self ON public.team_members;
DROP POLICY IF EXISTS team_members_update_self ON public.team_members;

DROP POLICY IF EXISTS team_invites_create_admin ON public.team_invites;
CREATE POLICY team_invites_create_admin ON public.team_invites
  FOR INSERT TO authenticated WITH CHECK (public.is_board_admin());

DROP POLICY IF EXISTS tasks_read_team ON public.tasks;
CREATE POLICY tasks_read_team ON public.tasks
  FOR SELECT TO authenticated USING (public.is_board_member());

DROP POLICY IF EXISTS tasks_create_team ON public.tasks;
CREATE POLICY tasks_create_team ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (public.is_board_member());

DROP POLICY IF EXISTS tasks_update_team ON public.tasks;
CREATE POLICY tasks_update_team ON public.tasks
  FOR UPDATE TO authenticated USING (public.is_board_member()) WITH CHECK (public.is_board_member());