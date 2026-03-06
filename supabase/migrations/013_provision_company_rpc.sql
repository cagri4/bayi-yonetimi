-- =============================================================================
-- Migration 013: provision_company RPC
-- =============================================================================
-- Atomic company provisioning function called by the superadmin Server Action.
-- Creates: company + users row + subscription + 12 agent_definitions in one TX.
-- SECURITY DEFINER + REVOKE ensures only service role can call this function.
-- =============================================================================

CREATE OR REPLACE FUNCTION provision_company(
  p_name          TEXT,
  p_slug          TEXT,
  p_sektor        TEXT,
  p_plan          TEXT,
  p_admin_user_id UUID,
  p_admin_email   TEXT,
  p_trial_days    INTEGER DEFAULT 14
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id  UUID;
  v_trial_end   TIMESTAMPTZ;
  v_role        TEXT;
  v_template_id UUID;
BEGIN
  -- Calculate trial end date
  v_trial_end := NOW() + (p_trial_days || ' days')::INTERVAL;

  -- 1. Insert company record
  INSERT INTO companies (name, slug, plan, is_active, trial_ends_at)
  VALUES (p_name, p_slug, p_plan, true, v_trial_end)
  RETURNING id INTO v_company_id;

  -- 2. Insert admin user row (auth user already created by service role client)
  INSERT INTO users (id, email, role, company_id)
  VALUES (p_admin_user_id, p_admin_email, 'admin', v_company_id);

  -- 3. Insert subscription record
  INSERT INTO subscriptions (company_id, plan, status, trial_ends_at)
  VALUES (v_company_id, p_plan, 'trialing', v_trial_end);

  -- 4. Clone 12 agent_definitions from the default company template
  FOR v_role IN
    SELECT unnest(ARRAY[
      'egitimci',
      'satis_temsilcisi',
      'muhasebeci',
      'depo_sorumlusu',
      'genel_mudur_danismani',
      'tahsilat_uzmani',
      'dagitim_koordinatoru',
      'saha_satis',
      'pazarlamaci',
      'urun_yoneticisi',
      'satin_alma',
      'iade_kalite'
    ])
  LOOP
    -- Try to clone from default company template
    INSERT INTO agent_definitions (company_id, role, is_active, system_prompt, model)
    SELECT
      v_company_id,
      ad.role,
      true,
      ad.system_prompt,
      ad.model
    FROM agent_definitions ad
    WHERE ad.role = v_role
      AND ad.company_id = (SELECT id FROM companies WHERE slug = 'default' LIMIT 1)
    LIMIT 1;

    -- If no template found, insert minimal definition
    IF NOT FOUND THEN
      INSERT INTO agent_definitions (company_id, role, is_active, system_prompt, model)
      VALUES (v_company_id, v_role, true, '', 'claude-haiku-4-5');
    END IF;
  END LOOP;

  RETURN v_company_id;
END;
$$;

-- Revoke public execute — service role has BYPASSRLS and implicit EXECUTE
REVOKE EXECUTE ON FUNCTION provision_company FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION provision_company FROM authenticated;
