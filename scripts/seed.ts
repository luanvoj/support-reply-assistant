import { hashPassword } from "@/lib/auth/password";
import { db, withTransaction } from "@/lib/db";
import { replaceArticleChunks } from "@/lib/knowledge/article";

const demoArticles = [
  {
    sourceKey: "demo:competition:refund-policy",
    title: "[DEMO] Điều kiện hoàn tiền dịch vụ",
    slug: "demo-dieu-kien-hoan-tien-dich-vu",
    serviceGroup: "Chăm sóc khách hàng",
    content: `## Điều kiện hoàn tiền\n\nKhách hàng có thể gửi yêu cầu hoàn tiền trong vòng 7 ngày kể từ ngày thanh toán nếu dịch vụ chưa được kích hoạt hoặc có lỗi kỹ thuật đã được xác minh.\n\n## Cách xử lý\n\nNhân viên xác minh mã đơn hàng, thời điểm thanh toán và trạng thái kích hoạt trước khi tạo yêu cầu hoàn tiền. Không cam kết thời gian xử lý nếu chưa có xác nhận từ bộ phận tài chính.`,
  },
  {
    sourceKey: "demo:competition:refund-evidence",
    title: "[DEMO] Hồ sơ xác minh yêu cầu hoàn tiền",
    slug: "demo-ho-so-xac-minh-yeu-cau-hoan-tien",
    serviceGroup: "Chăm sóc khách hàng",
    content: `## Hồ sơ cần xác minh\n\nKhi tiếp nhận yêu cầu hoàn tiền, cần kiểm tra mã đơn hàng, thời điểm thanh toán, trạng thái kích hoạt dịch vụ và bằng chứng lỗi kỹ thuật nếu có.\n\n## Nguyên tắc phản hồi\n\nChỉ thông báo điều kiện và bước xác minh. Không tự phê duyệt hoàn tiền hoặc đưa ra mốc thời gian xử lý khi chưa có xác nhận của bộ phận tài chính.`,
  },
] as const;

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) {
    throw new Error("SEED_PASSWORD must be set before creating demo users.");
  }
  const passwordHash = await hashPassword(password);
  const users = [
    ["Demo Sales", "sales@example.local", "sales"],
    ["Demo Technical", "technical@example.local", "technical"],
    ["Demo Admin", "admin@example.local", "admin"],
  ] as const;

  for (const [fullName, email, role] of users) {
    await db.query(
      `INSERT INTO users (full_name, username, email, password_hash, role_id)
       SELECT $1, split_part($2, '@', 1), $2, $3, id FROM roles WHERE code = $4
       ON CONFLICT (email) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         password_hash = EXCLUDED.password_hash,
         role_id = EXCLUDED.role_id,
         status = 'active',
         disabled_at = NULL,
         purge_after = NULL,
         purged_at = NULL,
         session_version = users.session_version + 1,
         updated_at = now()`,
      [fullName, email, passwordHash, role],
    );
  }

  const admin = await db.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    ["admin@example.local"],
  );
  const adminId = admin.rows[0]?.id;
  if (!adminId) throw new Error("Demo admin was not created.");

  for (const article of demoArticles) {
    await withTransaction(async (client) => {
      const saved = await client.query<{ id: string }>(
        `INSERT INTO knowledge_articles (
          title, slug, content_markdown, status, is_verified, source_priority,
          service_group, response_policy, source_key, source_file,
          created_by, reviewed_by, published_at
        ) VALUES ($1,$2,$3,'published',true,80,$4,'grounded',$5,'seed.ts',$6,$6,now())
        ON CONFLICT (source_key) WHERE source_key IS NOT NULL DO UPDATE SET
          title = EXCLUDED.title,
          slug = EXCLUDED.slug,
          content_markdown = EXCLUDED.content_markdown,
          service_group = EXCLUDED.service_group,
          response_policy = EXCLUDED.response_policy,
          source_priority = EXCLUDED.source_priority,
          is_verified = true,
          status = 'published',
          reviewed_by = EXCLUDED.reviewed_by,
          published_at = COALESCE(knowledge_articles.published_at, now()),
          updated_at = now(),
          version = knowledge_articles.version + 1
        RETURNING id`,
        [article.title, article.slug, article.content, article.serviceGroup, article.sourceKey, adminId],
      );
      const articleId = saved.rows[0]?.id;
      if (!articleId) throw new Error(`Demo article was not saved: ${article.sourceKey}`);
      await replaceArticleChunks(client, articleId, article.title, article.content);
    });
  }

  console.log("Seeded demo users and 2 verified knowledge fixtures. Password was read from SEED_PASSWORD.");
}

void main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.end());
