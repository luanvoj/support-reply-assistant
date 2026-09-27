CREATE TYPE user_role AS ENUM ('sales', 'technical', 'admin');
CREATE TYPE article_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE unanswered_status AS ENUM ('new', 'in_review', 'answered', 'published', 'rejected');
CREATE TYPE sender_type AS ENUM ('user', 'assistant', 'system');
CREATE TYPE feedback_type AS ENUM ('helpful', 'not_helpful');

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code user_role UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role_id UUID NOT NULL REFERENCES roles(id),
  status TEXT NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category_id UUID REFERENCES knowledge_categories(id),
  status article_status NOT NULL DEFAULT 'draft',
  content_markdown TEXT NOT NULL,
  summary TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,
  review_due_at TIMESTAMPTZ,
  source_priority INTEGER NOT NULL DEFAULT 0 CHECK (source_priority BETWEEN 0 AND 100),
  replaced_at TIMESTAMPTZ,
  replaced_by UUID REFERENCES knowledge_articles(id),
  created_by UUID NOT NULL REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL
);

CREATE TABLE knowledge_article_tags (
  article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  search_text TEXT NOT NULL DEFAULT '',
  context_hint TEXT,
  embedding vector(1536),
  token_count INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (article_id, chunk_index)
);

CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title TEXT NOT NULL DEFAULT 'New conversation',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'redacted')),
  classification TEXT NOT NULL DEFAULT 'normal' CHECK (classification IN ('social', 'normal', 'escalated', 'knowledge_linked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days'),
  archived_at TIMESTAMPTZ,
  redacted_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type sender_type NOT NULL,
  content TEXT NOT NULL,
  provider_used TEXT,
  confidence_score NUMERIC(6, 5),
  evidence_score NUMERIC(6, 5),
  retrieval_summary JSONB,
  message_mode TEXT CHECK (message_mode IN ('grounded', 'social', 'review', 'provider_error', 'knowledge_suggestions')),
  request_id UUID,
  redacted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE unanswered_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id),
  original_question TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  retrieval_score NUMERIC(6, 5),
  status unanswered_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES users(id),
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE question_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unanswered_question_id UUID NOT NULL REFERENCES unanswered_questions(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES users(id),
  draft_answer TEXT,
  final_answer TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_article_id UUID REFERENCES knowledge_articles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_provider_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_type TEXT NOT NULL CHECK (provider_type IN ('gemini', 'azure_openai')),
  display_name TEXT NOT NULL,
  endpoint TEXT,
  api_key_encrypted TEXT NOT NULL,
  deployment TEXT,
  model TEXT,
  api_version TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  is_default BOOLEAN NOT NULL DEFAULT false,
  fallback_priority INTEGER,
  created_by UUID NOT NULL REFERENCES users(id),
  updated_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_provider_runtime_health (
  provider_id UUID PRIMARY KEY REFERENCES ai_provider_settings(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'closed' CHECK (state IN ('closed', 'open', 'half_open')),
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  opened_until TIMESTAMPTZ,
  half_open_until TIMESTAMPTZ,
  last_failure_code TEXT,
  last_success_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assistant_profiles (
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

CREATE TABLE retrieval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  top_k INTEGER NOT NULL DEFAULT 10 CHECK (top_k BETWEEN 3 AND 30),
  max_articles INTEGER NOT NULL DEFAULT 3 CHECK (max_articles BETWEEN 1 AND 8),
  keyword_weight NUMERIC(4,3) NOT NULL DEFAULT 0.400 CHECK (keyword_weight BETWEEN 0 AND 1),
  semantic_weight NUMERIC(4,3) NOT NULL DEFAULT 0.600 CHECK (semantic_weight BETWEEN 0 AND 1),
  diversity_weight NUMERIC(4,3) NOT NULL DEFAULT 0.300 CHECK (diversity_weight BETWEEN 0 AND 1),
  auto_answer_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.800 CHECK (auto_answer_threshold BETWEEN 0 AND 1),
  partial_answer_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.600 CHECK (partial_answer_threshold BETWEEN 0 AND 1),
  sensitive_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.900 CHECK (sensitive_threshold BETWEEN 0 AND 1),
  sensitive_topics JSONB NOT NULL DEFAULT '["Giá & báo giá", "Hợp đồng", "Bảo mật", "SLA"]'::jsonb,
  verified_only BOOLEAN NOT NULL DEFAULT true,
  exclude_replaced BOOLEAN NOT NULL DEFAULT true,
  shadow_mode BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  query_text TEXT NOT NULL,
  retrieval_mode TEXT NOT NULL CHECK (retrieval_mode IN ('keyword', 'semantic', 'hybrid')),
  top_chunks_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision TEXT NOT NULL CHECK (decision IN ('answered', 'partial', 'fallback', 'ticket_created', 'provider_error', 'knowledge_suggestions')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE retrieval_evaluation_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id INTEGER NOT NULL UNIQUE,
  service_group TEXT NOT NULL,
  question TEXT NOT NULL,
  expected_source_title TEXT,
  expected_decision TEXT NOT NULL CHECK (expected_decision IN ('grounded', 'partial', 'fallback')),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE feedback_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  feedback_type feedback_type NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id)
);

CREATE TABLE conversation_retention_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_at TIMESTAMPTZ NOT NULL,
  deleted_conversations INTEGER NOT NULL DEFAULT 0,
  redacted_conversations INTEGER NOT NULL DEFAULT 0,
  protected_conversations INTEGER NOT NULL DEFAULT 0,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX knowledge_articles_status_idx ON knowledge_articles(status);
CREATE INDEX knowledge_articles_retrieval_eligibility_idx ON knowledge_articles(status, is_verified, effective_from, effective_until) WHERE replaced_at IS NULL;
CREATE INDEX knowledge_chunks_article_idx ON knowledge_chunks(article_id);
CREATE INDEX knowledge_chunks_embedding_idx ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX knowledge_chunks_lexical_idx ON knowledge_chunks USING GIN (to_tsvector('simple', search_text));
CREATE INDEX messages_conversation_idx ON messages(conversation_id, created_at);
CREATE UNIQUE INDEX messages_user_request_idx ON messages(request_id) WHERE sender_type = 'user' AND request_id IS NOT NULL;
CREATE INDEX conversations_retention_idx ON conversations(status, expires_at);
CREATE UNIQUE INDEX assistant_profiles_single_active_idx ON assistant_profiles(is_active) WHERE is_active;
CREATE UNIQUE INDEX retrieval_settings_single_active_idx ON retrieval_settings(is_active) WHERE is_active;
CREATE INDEX unanswered_questions_status_idx ON unanswered_questions(status, created_at);
