import { db, query } from "@/lib/db";

async function main() {
  const result = await query<{ table_count: string }>(
    `SELECT count(*)::text AS table_count
     FROM information_schema.tables WHERE table_schema = 'public'`,
  );

  if (Number(result.rows[0]?.table_count ?? 0) < 14) {
    throw new Error(
      "Database is not initialized. Start PostgreSQL with docker compose first.",
    );
  }

  await query(`
    -- Identity and account lifecycle. These statements are deliberately idempotent:
    -- this application upgrades an existing Supabase database in place.
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_key TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_content_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_size_bytes INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS purge_after TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled_at TIMESTAMPTZ;
    UPDATE users
      SET username = regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]+', '-', 'g') || '-' || left(replace(id::text, '-', ''), 6)
      WHERE username IS NULL OR btrim(username) = '';
    ALTER TABLE users ALTER COLUMN username SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_ci_idx ON users(lower(username));
    CREATE INDEX IF NOT EXISTS users_lifecycle_idx ON users(status, purge_after)
      WHERE status IN ('disabled', 'purged');
    CREATE TABLE IF NOT EXISTS user_mfa_totp (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      secret_encrypted TEXT NOT NULL,
      recovery_code_hashes JSONB NOT NULL DEFAULT '[]'::jsonb,
      verified_at TIMESTAMPTZ,
      verification_attempts INTEGER NOT NULL DEFAULT 0,
      last_verified_counter BIGINT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE user_mfa_totp ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE user_mfa_totp ADD COLUMN IF NOT EXISTS last_verified_counter BIGINT;
    CREATE TABLE IF NOT EXISTS user_lifecycle_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id),
      actor_id UUID REFERENCES users(id),
      event_type TEXT NOT NULL CHECK (event_type IN ('created', 'updated', 'disabled', 'restored', 'ownership_transferred', 'purged', 'mfa_disabled', 'password_reset_by_admin')),
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS user_lifecycle_events_user_idx ON user_lifecycle_events(user_id, created_at DESC);
    ALTER TABLE user_lifecycle_events DROP CONSTRAINT IF EXISTS user_lifecycle_events_event_type_check;
    ALTER TABLE user_lifecycle_events ADD CONSTRAINT user_lifecycle_events_event_type_check
      CHECK (event_type IN ('created', 'updated', 'disabled', 'restored', 'ownership_transferred', 'purged', 'mfa_disabled', 'password_reset_by_admin'));
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS classification TEXT NOT NULL DEFAULT 'normal';
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days');
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS redacted_at TIMESTAMPTZ;
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS message_mode TEXT;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS request_id UUID;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS redacted_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS evidence_score NUMERIC(6, 5);
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sequence_no BIGINT;
    WITH ordered_messages AS (
      SELECT id, row_number() OVER (
        PARTITION BY conversation_id
        ORDER BY created_at, request_id NULLS LAST,
          CASE sender_type WHEN 'user' THEN 0 ELSE 1 END, id
      ) AS sequence_no
      FROM messages
    )
    UPDATE messages m
    SET sequence_no = ordered_messages.sequence_no
    FROM ordered_messages
    WHERE m.id = ordered_messages.id AND m.sequence_no IS NULL;
    ALTER TABLE messages ALTER COLUMN sequence_no SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS messages_conversation_sequence_idx
      ON messages(conversation_id, sequence_no);
    ALTER TABLE unanswered_questions ADD COLUMN IF NOT EXISTS source_message_id UUID REFERENCES messages(id) ON DELETE CASCADE;
    CREATE UNIQUE INDEX IF NOT EXISTS unanswered_questions_source_message_idx
      ON unanswered_questions(source_message_id) WHERE source_message_id IS NOT NULL;
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_mode_check;
    ALTER TABLE messages ADD CONSTRAINT messages_message_mode_check
      CHECK (message_mode IS NULL OR message_mode IN ('grounded', 'social', 'review', 'provider_error', 'knowledge_suggestions'));
    ALTER TABLE retrieval_logs DROP CONSTRAINT IF EXISTS retrieval_logs_decision_check;
    ALTER TABLE retrieval_logs ADD CONSTRAINT retrieval_logs_decision_check
      CHECK (decision IN ('answered', 'partial', 'fallback', 'ticket_created', 'provider_error', 'knowledge_suggestions'));
    CREATE TABLE IF NOT EXISTS ai_provider_runtime_health (
      provider_id UUID PRIMARY KEY REFERENCES ai_provider_settings(id) ON DELETE CASCADE,
      state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      opened_until TIMESTAMPTZ,
      half_open_until TIMESTAMPTZ,
      last_failure_code TEXT,
      last_success_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    DO $$
    DECLARE constraint_name TEXT;
    BEGIN
      SELECT conname INTO constraint_name
      FROM pg_constraint
      WHERE conrelid = 'conversations'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) LIKE '%status%';
      IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE conversations DROP CONSTRAINT %I', constraint_name);
      END IF;
      ALTER TABLE conversations ADD CONSTRAINT conversations_status_check
        CHECK (status IN ('active', 'archived', 'redacted'));
    END $$;
    CREATE TABLE IF NOT EXISTS conversation_retention_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cutoff_at TIMESTAMPTZ NOT NULL,
      deleted_conversations INTEGER NOT NULL DEFAULT 0,
      redacted_conversations INTEGER NOT NULL DEFAULT 0,
      protected_conversations INTEGER NOT NULL DEFAULT 0,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS assistant_profiles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL DEFAULT 'Trợ lý phản hồi',
      role_description TEXT NOT NULL DEFAULT 'Chuyên viên tư vấn nội bộ lịch sự và trung thực',
      tone TEXT NOT NULL DEFAULT 'professional' CHECK (tone IN ('professional', 'friendly', 'concise')),
      response_length TEXT NOT NULL DEFAULT 'balanced' CHECK (response_length IN ('concise', 'balanced', 'detailed')),
      fallback_style TEXT NOT NULL DEFAULT 'supportive' CHECK (fallback_style IN ('supportive', 'direct')),
      custom_instructions TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID REFERENCES users(id),
      updated_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS assistant_profiles_single_active_idx
      ON assistant_profiles(is_active) WHERE is_active;
    CREATE TABLE IF NOT EXISTS retrieval_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), top_k INTEGER NOT NULL DEFAULT 10 CHECK (top_k BETWEEN 3 AND 30),
      max_articles INTEGER NOT NULL DEFAULT 3 CHECK (max_articles BETWEEN 1 AND 8),
      keyword_weight NUMERIC(4,3) NOT NULL DEFAULT 0.400 CHECK (keyword_weight BETWEEN 0 AND 1), semantic_weight NUMERIC(4,3) NOT NULL DEFAULT 0.600 CHECK (semantic_weight BETWEEN 0 AND 1), diversity_weight NUMERIC(4,3) NOT NULL DEFAULT 0.300 CHECK (diversity_weight BETWEEN 0 AND 1),
      auto_answer_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.800 CHECK (auto_answer_threshold BETWEEN 0 AND 1), partial_answer_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.600 CHECK (partial_answer_threshold BETWEEN 0 AND 1), sensitive_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.900 CHECK (sensitive_threshold BETWEEN 0 AND 1),
      sensitive_topics JSONB NOT NULL DEFAULT '["Giá & báo giá", "Hợp đồng", "Bảo mật", "SLA"]'::jsonb,
      verified_only BOOLEAN NOT NULL DEFAULT true, exclude_replaced BOOLEAN NOT NULL DEFAULT true, is_active BOOLEAN NOT NULL DEFAULT true,
      created_by UUID REFERENCES users(id), updated_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS retrieval_settings_single_active_idx ON retrieval_settings(is_active) WHERE is_active;
    CREATE TABLE IF NOT EXISTS retrieval_evaluation_cases (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), external_id INTEGER NOT NULL UNIQUE,
      service_group TEXT NOT NULL, question TEXT NOT NULL, expected_source_title TEXT,
      expected_decision TEXT NOT NULL CHECK (expected_decision IN ('grounded', 'partial', 'fallback')),
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS search_text TEXT NOT NULL DEFAULT '';
    UPDATE knowledge_chunks c SET search_text = a.title || ' ' || c.content FROM knowledge_articles a WHERE a.id = c.article_id AND c.search_text = '';
    DROP INDEX IF EXISTS knowledge_chunks_lexical_idx;
    CREATE INDEX IF NOT EXISTS knowledge_chunks_lexical_idx ON knowledge_chunks USING GIN (to_tsvector('simple', search_text));
    ALTER TABLE retrieval_settings ADD COLUMN IF NOT EXISTS shadow_mode BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE retrieval_settings ADD COLUMN IF NOT EXISTS merge_prefilter_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.400;
    ALTER TABLE retrieval_settings ADD COLUMN IF NOT EXISTS merge_suggestion_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.780;
    ALTER TABLE retrieval_settings ADD COLUMN IF NOT EXISTS merge_unique_coverage_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.250;
    ALTER TABLE retrieval_settings ADD COLUMN IF NOT EXISTS merge_synonyms JSONB NOT NULL DEFAULT '["record = bản ghi", "txt record = bản ghi txt"]'::jsonb;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ NOT NULL DEFAULT now();
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS effective_until TIMESTAMPTZ;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS review_due_at TIMESTAMPTZ;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS source_priority INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS replaced_at TIMESTAMPTZ;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS replaced_by UUID REFERENCES knowledge_articles(id);
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS source_key TEXT;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS source_file TEXT;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS service_group TEXT;
    ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS response_policy TEXT NOT NULL DEFAULT 'grounded';
    UPDATE knowledge_articles SET response_policy = 'escalate' WHERE response_policy = 'partial';
    ALTER TABLE knowledge_articles DROP CONSTRAINT IF EXISTS knowledge_articles_response_policy_check;
    ALTER TABLE knowledge_articles ADD CONSTRAINT knowledge_articles_response_policy_check
      CHECK (response_policy IN ('grounded', 'escalate'));
    CREATE UNIQUE INDEX IF NOT EXISTS knowledge_articles_source_key_idx
      ON knowledge_articles(source_key) WHERE source_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS knowledge_articles_service_policy_idx
      ON knowledge_articles(service_group, response_policy, status);
    CREATE TABLE IF NOT EXISTS knowledge_article_audits (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
      actor_id UUID REFERENCES users(id), action TEXT NOT NULL,
      version INTEGER NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE knowledge_articles DROP CONSTRAINT IF EXISTS knowledge_articles_version_check;
    ALTER TABLE knowledge_articles ADD CONSTRAINT knowledge_articles_version_check CHECK (version > 0);
    ALTER TABLE knowledge_articles DROP CONSTRAINT IF EXISTS knowledge_articles_source_priority_check;
    ALTER TABLE knowledge_articles ADD CONSTRAINT knowledge_articles_source_priority_check CHECK (source_priority BETWEEN 0 AND 100);
    UPDATE knowledge_articles
      SET is_verified = true
      WHERE status = 'published' AND reviewed_by IS NOT NULL AND is_verified = false;
    CREATE INDEX IF NOT EXISTS knowledge_articles_retrieval_eligibility_idx
      ON knowledge_articles(status, is_verified, effective_from, effective_until) WHERE replaced_at IS NULL;
    CREATE INDEX IF NOT EXISTS knowledge_chunks_lexical_idx
      ON knowledge_chunks USING GIN (to_tsvector('simple', content));
    CREATE UNIQUE INDEX IF NOT EXISTS messages_user_request_idx
      ON messages(request_id)
      WHERE sender_type = 'user' AND request_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS conversations_retention_idx ON conversations(status, expires_at);
    CREATE TABLE IF NOT EXISTS knowledge_import_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), file_name TEXT NOT NULL, file_type TEXT NOT NULL CHECK (file_type IN ('csv','xlsx')),
      status TEXT NOT NULL CHECK (status IN ('imported','rolled_back','failed')), total_rows INTEGER NOT NULL DEFAULT 0,
      imported_rows INTEGER NOT NULL DEFAULT 0, invalid_rows INTEGER NOT NULL DEFAULT 0, created_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), applied_at TIMESTAMPTZ, rolled_back_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS knowledge_import_rows (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES knowledge_import_batches(id) ON DELETE CASCADE,
      row_number INTEGER NOT NULL, original_title TEXT, final_title TEXT, status TEXT NOT NULL CHECK (status IN ('imported','failed','rolled_back')),
      error TEXT, article_id UUID REFERENCES knowledge_articles(id), payload JSONB NOT NULL DEFAULT '{}'::jsonb
    );
    CREATE INDEX IF NOT EXISTS knowledge_import_rows_batch_idx ON knowledge_import_rows(batch_id);
    CREATE TABLE IF NOT EXISTS knowledge_merge_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), status TEXT NOT NULL CHECK (status IN ('draft','approved','rejected','rolled_back')),
      score NUMERIC(5,4) NOT NULL, analysis JSONB NOT NULL DEFAULT '{}'::jsonb, merged_article_id UUID REFERENCES knowledge_articles(id),
      created_by UUID REFERENCES users(id), approved_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), approved_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS knowledge_merge_sources (
      merge_run_id UUID NOT NULL REFERENCES knowledge_merge_runs(id) ON DELETE CASCADE,
      article_id UUID NOT NULL REFERENCES knowledge_articles(id), PRIMARY KEY (merge_run_id, article_id)
    );
    CREATE TABLE IF NOT EXISTS knowledge_merge_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), status TEXT NOT NULL CHECK (status IN ('queued','scanning','review_ready','generating','completed','failed','cancelled')),
      scope JSONB NOT NULL DEFAULT '{}'::jsonb, total_articles INTEGER NOT NULL DEFAULT 0, scanned_articles INTEGER NOT NULL DEFAULT 0,
      proposed_groups INTEGER NOT NULL DEFAULT 0, completed_groups INTEGER NOT NULL DEFAULT 0, error_code TEXT, error_message TEXT,
      created_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(), started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS knowledge_merge_batch_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES knowledge_merge_batches(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('candidate','selected','generating','drafted','skipped','failed')), article_ids JSONB NOT NULL,
      score NUMERIC(5,4), reason TEXT, merge_run_id UUID REFERENCES knowledge_merge_runs(id), error_code TEXT, error_message TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS knowledge_merge_errors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), batch_id UUID NOT NULL REFERENCES knowledge_merge_batches(id) ON DELETE CASCADE,
      item_id UUID REFERENCES knowledge_merge_batch_items(id) ON DELETE SET NULL, code TEXT NOT NULL, user_message TEXT NOT NULL, technical_context JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS knowledge_merge_batches_status_idx ON knowledge_merge_batches(status,created_at DESC);
    CREATE INDEX IF NOT EXISTS knowledge_merge_batch_items_batch_idx ON knowledge_merge_batch_items(batch_id,status);
    CREATE TABLE IF NOT EXISTS knowledge_merge_pair_decisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      article_low_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
      article_high_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
      low_version INTEGER NOT NULL, high_version INTEGER NOT NULL,
      decision TEXT NOT NULL CHECK (decision IN ('not_merge')),
      reason TEXT NOT NULL, decided_by UUID REFERENCES users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (article_low_id < article_high_id),
      UNIQUE(article_low_id,article_high_id,low_version,high_version,decision)
    );
    CREATE INDEX IF NOT EXISTS knowledge_merge_pair_decisions_lookup_idx ON knowledge_merge_pair_decisions(article_low_id,article_high_id,low_version,high_version);
    ALTER TABLE knowledge_merge_batch_items ADD COLUMN IF NOT EXISTS decision TEXT;
    ALTER TABLE knowledge_merge_batch_items ADD COLUMN IF NOT EXISTS analysis JSONB NOT NULL DEFAULT '{}'::jsonb;
    UPDATE knowledge_merge_batch_items AS item
    SET status = 'drafted', merge_run_id = approved.id, error_code = NULL, error_message = NULL, updated_at = now()
    FROM (
      SELECT run.id, jsonb_agg(source.article_id) AS source_ids
      FROM knowledge_merge_runs AS run
      JOIN knowledge_merge_sources AS source ON source.merge_run_id = run.id
      WHERE run.status = 'approved'
      GROUP BY run.id
    ) AS approved
    WHERE item.status IN ('candidate','selected','generating','failed')
      AND item.article_ids @> approved.source_ids
      AND item.article_ids <@ approved.source_ids;
    UPDATE conversations
      SET last_message_at = COALESCE((SELECT max(created_at) FROM messages WHERE conversation_id = conversations.id), updated_at),
          expires_at = COALESCE(expires_at, updated_at + interval '90 days');
    WITH ranked_enabled_providers AS (
      SELECT id, row_number() OVER (ORDER BY is_default DESC, updated_at DESC, id) AS position
      FROM ai_provider_settings
      WHERE is_enabled = true
    )
    UPDATE ai_provider_settings AS provider
      SET is_enabled = false, is_default = false, updated_at = now()
      FROM ranked_enabled_providers AS ranked
      WHERE provider.id = ranked.id AND ranked.position > 1;
    CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_settings_single_enabled_idx
      ON ai_provider_settings ((is_enabled)) WHERE is_enabled = true;
    CREATE TABLE IF NOT EXISTS operational_log_settings (
      id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id), retention_days INTEGER NOT NULL DEFAULT 90 CHECK (retention_days BETWEEN 7 AND 3650),
      updated_by UUID REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    INSERT INTO operational_log_settings(id) VALUES(true) ON CONFLICT (id) DO NOTHING;
    CREATE TABLE IF NOT EXISTS operational_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(), category TEXT NOT NULL CHECK (category IN ('account','authentication','knowledge','configuration')),
      action TEXT NOT NULL, summary TEXT NOT NULL, actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      actor_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      target_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS operational_logs_created_idx ON operational_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS operational_logs_category_idx ON operational_logs(category,created_at DESC);
    CREATE TABLE IF NOT EXISTS auth_rate_limit_buckets (
      scope TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      window_started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
      blocked_until TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (scope, key_hash)
    );
    CREATE INDEX IF NOT EXISTS auth_rate_limit_buckets_expiry_idx ON auth_rate_limit_buckets(updated_at);
  `);

  console.log(
    `Database is ready and conversation lifecycle migration is applied (${result.rows[0]?.table_count} public tables).`,
  );
}

void main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
