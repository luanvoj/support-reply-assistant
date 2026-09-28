"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useFeedback } from "@/components/app-shell";
import { NavigationIcon } from "@/components/navigation-icon";
import {
  IconImportSpreadsheet,
  IconMergeArticles,
  IconAddDocument,
} from "@/components/ui/action-icons";
import { chunkMarkdown } from "@/lib/retrieval/chunker";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Button,
  Badge,
  Input,
  Textarea,
  Select,
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from "@/components/ui";

export type Article = {
  id: string;
  title: string;
  category: string | null;
  status: string;
  chunk_count: number;
  updated_at: string;
  is_verified?: boolean;
  source_priority?: number;
  review_due_at?: string | null;
  service_group?: string | null;
  response_policy?: "grounded" | "escalate";
  source_file?: string | null;
  version?: number;
  merge_run_id?: string | null;
  merge_status?: "draft" | "approved" | "rejected" | "rolled_back" | null;
};

export function KnowledgeScreen() {
  const { confirm, notify } = useFeedback();
  const [articles, setArticles] = useState<Article[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isVerified, setIsVerified] = useState(true);
  const [sourcePriority, setSourcePriority] = useState(50);
  const [reviewDueAt, setReviewDueAt] = useState("");
  const [serviceGroup, setServiceGroup] = useState("");
  const [responsePolicy, setResponsePolicy] = useState<"grounded" | "escalate">("grounded");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<string | null>(null);
  const [articleFilter, setArticleFilter] = useState("");
  const [articleStatus, setArticleStatus] = useState<"published" | "draft" | "archived">("published");
  const [articlePage, setArticlePage] = useState(1);
  const [articleTotal, setArticleTotal] = useState(0);

  // Import
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{
    total: number;
    valid: number;
    invalid: number;
    rows: Array<{ rowNumber: number; title: string; errors: string[] }>;
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Merge workspace
  const [showMergeWorkspace, setShowMergeWorkspace] = useState(false);
  const [mergeBatch, setMergeBatch] = useState<{
    id: string;
    status: string;
    total_articles: number;
    scanned_articles: number;
    proposed_groups: number;
    error_code?: string;
    error_message?: string;
  } | null>(null);
  const [mergeItems, setMergeItems] = useState<
    Array<{
      id: string;
      article_ids: string[];
      score: number;
      reason: string;
      status: string;
      merge_run_id?: string;
      merge_status?: string;
      decision?: string;
      analysis?: {
        sharedTopics?: string[];
        uniqueTopics?: { articleA?: string[]; articleB?: string[] };
        uniqueCoverage?: number;
      };
      error_code?: string;
      error_message?: string;
      errors?: Array<{
        code: string;
        user_message: string;
        created_at: string;
      }>;
    }>
  >([]);
  const [mergeDiff, setMergeDiff] = useState<{
    run: {
      id: string;
      title: string;
      content_markdown: string;
      status: string;
    };
    sources: Array<{ title: string; content_markdown: string; status: string }>;
  } | null>(null);
  const [selectedMergeItems, setSelectedMergeItems] = useState<string[]>([]);
  const [generatingMerge, setGeneratingMerge] = useState(false);
  const [mergeLimit, setMergeLimit] = useState(100);
  const [mergeThreshold, setMergeThreshold] = useState(0.78);
  const [mergeGroup, setMergeGroup] = useState("");

  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorTitleRef = useRef<HTMLInputElement | null>(null);
  const contentLimit = 30000;

  const hasArticleChanges =
    !editingId ||
    editSnapshot !==
      JSON.stringify({
        title,
        content,
        isVerified,
        sourcePriority,
        reviewDueAt,
        serviceGroup,
        responsePolicy,
      });

  const chunkPreview = useMemo(
    () => (content.trim() ? chunkMarkdown(content).slice(0, 3) : []),
    [content],
  );

  const load = async () => {
    const response = await fetch(
      `/api/knowledge/articles?status=${articleStatus}&page=${articlePage}`,
    );
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      setArticles(body.articles ?? []);
      setArticleTotal(body.pagination?.total ?? 0);
    } else {
      notify("Không thể tải danh sách bài viết từ kho tri thức.", "error");
    }
  };

  useEffect(() => {
    void load();
  }, [articleStatus, articlePage]);

  useEffect(() => {
    if (!editingId || !showForm) return;
    const frame = window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      editorTitleRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [editingId, showForm]);

  useEffect(() => {
    if (!showImport) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !importing) setShowImport(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showImport, importing]);

  const create = async (targetStatus: "draft" | "published") => {
    const slug =
      title
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || `bai-viet-${Date.now()}`;
    const response = await fetch(
      editingId
        ? `/api/knowledge/articles/${editingId}`
        : "/api/knowledge/articles",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          contentMarkdown: content,
          status: targetStatus,
          isVerified,
          sourcePriority,
          serviceGroup: serviceGroup || null,
          responsePolicy,
          reviewDueAt: reviewDueAt
            ? new Date(reviewDueAt).toISOString()
            : undefined,
        }),
      },
    );
    if (response.ok) {
      notify(
        targetStatus === "published"
          ? editingId
            ? "Đã cập nhật, xuất bản và lập chỉ mục bài viết."
            : "Đã xuất bản và lập chỉ mục bài viết thành công."
          : editingId
            ? "Đã cập nhật bản nháp bài viết."
            : "Đã lưu bản nháp bài viết.",
        "success",
      );
      setShowForm(false);
      setTitle("");
      setContent("");
      setIsVerified(true);
      setSourcePriority(50);
      setReviewDueAt("");
      setServiceGroup("");
      setResponsePolicy("grounded");
      setEditingId(null);
      void load();
    } else {
      notify("Không thể lưu bài viết. Hãy kiểm tra quyền hạn và nội dung.", "error");
    }
  };

  const edit = async (id: string) => {
    const response = await fetch(`/api/knowledge/articles/${id}`);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      notify("Không thể tải thông tin bài viết để chỉnh sửa.", "error");
      return;
    }
    const item = body.article;
    setEditingId(id);
    setTitle(item.title ?? "");
    setContent(item.content_markdown ?? "");
    setIsVerified(Boolean(item.is_verified));
    setSourcePriority(Number(item.source_priority ?? 50));
    setReviewDueAt(
      item.review_due_at ? String(item.review_due_at).slice(0, 10) : "",
    );
    setServiceGroup(item.service_group ?? "");
    setResponsePolicy(item.response_policy ?? "grounded");
    setEditSnapshot(
      JSON.stringify({
        title: item.title ?? "",
        content: item.content_markdown ?? "",
        isVerified: Boolean(item.is_verified),
        sourcePriority: Number(item.source_priority ?? 50),
        reviewDueAt: item.review_due_at
          ? String(item.review_due_at).slice(0, 10)
          : "",
        serviceGroup: item.service_group ?? "",
        responsePolicy: item.response_policy ?? "grounded",
      }),
    );
    setShowForm(true);
  };

  const archive = async (id: string) => {
    if (
      !(await confirm({
        title: "Lưu trữ bài viết?",
        description:
          "Trợ lý AI sẽ không dùng bài viết này cho câu trả lời mới. Bạn vẫn có thể xem lại trong mục Đã lưu trữ hoặc khôi phục bất cứ lúc nào.",
        confirmLabel: "Lưu trữ bài viết",
      }))
    )
      return;
    const response = await fetch(`/api/knowledge/articles/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      notify("Đã lưu trữ bài viết khỏi kho tri thức.", "success");
      void load();
    } else {
      notify("Không thể lưu trữ bài viết.", "error");
    }
  };

  const purge = async (item: Article) => {
    if (
      !(await confirm({
        title: "Xóa vĩnh viễn bài viết?",
        description:
          "Bài viết và các phân đoạn tìm kiếm (vector/keyword) sẽ bị xóa hoàn toàn. Hành động này không thể khôi phục.",
        confirmLabel: "Xóa vĩnh viễn",
        tone: "danger",
        requiredValue: item.title,
      }))
    )
      return;
    const response = await fetch(
      `/api/knowledge/articles/${item.id}?permanent=true`,
      { method: "DELETE" },
    );
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      notify("Đã xóa vĩnh viễn bài viết.", "success");
      void load();
    } else {
      notify(body.error ?? "Không thể xóa vĩnh viễn bài viết.", "error");
    }
  };

  const restore = async (item: Article) => {
    const response = await fetch(`/api/knowledge/articles/${item.id}/restore`, {
      method: "POST",
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      notify("Đã khôi phục bài viết thành bản nháp để bạn rà soát.", "success");
      void load();
    } else {
      notify(body.error ?? "Không thể khôi phục bài viết.", "error");
    }
  };

  const previewImport = async (file: File) => {
    setImportFile(file);
    setImportPreview(null);
    const form = new FormData();
    form.append("file", file);
    const response = await fetch("/api/knowledge/import/preview", {
      method: "POST",
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setImportPreview(body);
    else notify(body.error ?? "Không thể kiểm tra tệp import.", "error");
  };

  const applyImport = async () => {
    if (!importFile || !importPreview || importPreview.invalid) return;
    setImporting(true);
    const form = new FormData();
    form.append("file", importFile);
    const response = await fetch("/api/knowledge/import", {
      method: "POST",
      body: form,
    });
    const body = await response.json().catch(() => ({}));
    setImporting(false);
    if (response.ok) {
      notify(
        `Đã import ${body.imported} bài viết và lập chỉ mục để Trợ lý tra cứu.`,
        "success",
      );
      setImportFile(null);
      setImportPreview(null);
      setShowImport(false);
      void load();
    } else {
      notify(body.error ?? "Không thể import tệp.", "error");
    }
  };

  const suggestMerge = async (item: Article) => {
    const response = await fetch("/api/knowledge/merge/suggest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ articleId: item.id }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok && body.suggestion) {
      notify(
        `Đã tạo bản nháp gộp từ “${body.suggestion.sourceTitles.join("” và “")}”. Hãy mở bản nháp để duyệt trước khi xuất bản.`,
        "success",
      );
      void load();
    } else {
      notify(
        body.message ?? body.error ?? "Chưa thể tạo đề xuất gộp bài viết.",
        "info",
      );
    }
  };

  const decideMerge = async (item: Article, decision: "approve" | "reject") => {
    if (!item.merge_run_id) return;
    const accepted = await confirm({
      title: decision === "approve" ? "Xuất bản bản gộp?" : "Từ chối bản gộp?",
      description:
        decision === "approve"
          ? "Bài gộp sẽ được xuất bản; các bài nguồn sẽ chuyển sang lưu trữ nhưng vẫn giữ lại để đối soát."
          : "Bản nháp gộp sẽ được hủy bỏ; các bài nguồn vẫn giữ nguyên trạng thái.",
      confirmLabel:
        decision === "approve" ? "Duyệt & Lưu trữ nguồn" : "Từ chối đề xuất",
    });
    if (!accepted) return;
    const response = await fetch(
      `/api/knowledge/merge/${item.merge_run_id}/${decision}`,
      { method: "POST" },
    );
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      notify(
        decision === "approve"
          ? "Đã xuất bản bài gộp và lưu trữ nguồn để đối soát."
          : "Đã từ chối bản gộp; tài liệu nguồn được giữ nguyên.",
        "success",
      );
      void load();
    } else {
      notify(body.error ?? "Không thể cập nhật quyết định gộp.", "error");
    }
  };

  const loadMergeBatch = async (id: string) => {
    const r = await fetch(`/api/knowledge/merge/batches/${id}`);
    const b = await r.json().catch(() => ({}));
    if (r.ok) {
      setMergeBatch(b.batch);
      setMergeItems(b.items ?? []);
    }
  };

  const startMergeBatch = async () => {
    setMergeItems([]);
    setSelectedMergeItems([]);
    setMergeDiff(null);
    const r = await fetch("/api/knowledge/merge/batches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        limit: mergeLimit,
        threshold: mergeThreshold,
        serviceGroup: mergeGroup || undefined,
        verifiedOnly: true,
      }),
    });
    const b = await r.json().catch(() => ({}));
    if (!r.ok) {
      notify(b.error ?? "Không thể tạo đợt quét gộp.", "error");
      return;
    }
    setMergeBatch(b.batch);
    const scan = await fetch(
      `/api/knowledge/merge/batches/${b.batch.id}/scan`,
      { method: "POST" },
    );
    if (!scan.ok) {
      const e = await scan.json().catch(() => ({}));
      notify(
        `${e.error ?? "Quét gộp không hoàn tất."}${e.code ? ` Mã: ${e.code}` : ""}`,
        "error",
      );
    }
    await loadMergeBatch(b.batch.id);
  };

  const cancelMergeBatch = async () => {
    if (!mergeBatch) return;
    const r = await fetch(
      `/api/knowledge/merge/batches/${mergeBatch.id}/cancel`,
      { method: "POST" },
    );
    if (r.ok) await loadMergeBatch(mergeBatch.id);
  };

  const saveMergeOutcome = async (itemId: string, code: string) =>
    fetch(
      `/api/knowledge/merge/batches/${mergeBatch?.id}/items/${itemId}/fail`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      },
    );

  const generateSelectedMerges = async (itemIds = selectedMergeItems) => {
    if (!mergeBatch || !itemIds.length) return;
    setGeneratingMerge(true);
    let done = 0;
    let failed = 0;
    let skipped = 0;
    for (const item of mergeItems.filter((x) => itemIds.includes(x.id))) {
      const suggest = await fetch("/api/knowledge/merge/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ articleId: item.article_ids[0] }),
      }).catch(() => null);
      const payload = await suggest?.json().catch(() => ({}));
      if (!suggest || !suggest.ok || !payload.suggestion) {
        const code = payload?.code ?? "AGENT_REQUEST_FAILED";
        const result = await saveMergeOutcome(item.id, code);
        const outcome = await result.json().catch(() => ({}));
        if (outcome.status === "skipped") skipped++;
        else failed++;
        continue;
      }
      const attached = await fetch(
        `/api/knowledge/merge/batches/${mergeBatch.id}/items/${item.id}/attach`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mergeRunId: payload.suggestion.runId }),
        },
      ).catch(() => null);
      if (!attached?.ok) {
        await saveMergeOutcome(item.id, "ATTACH_FAILED");
        failed++;
        continue;
      }
      done++;
    }
    setGeneratingMerge(false);
    const summary = [
      done ? `đã tạo ${done} bản nháp` : null,
      skipped ? `${skipped} nhóm được giữ riêng` : null,
      failed ? `${failed} nhóm cần xử lý` : null,
    ]
      .filter(Boolean)
      .join("; ");
    notify(
      summary
        ? `${summary[0].toUpperCase()}${summary.slice(1)}.`
        : "Không có nhóm nào được xử lý.",
      failed ? "error" : "success",
    );
    await loadMergeBatch(mergeBatch.id);
    void load();
  };

  const openMergeDiff = async (id: string) => {
    const r = await fetch(`/api/knowledge/merge/${id}`);
    const b = await r.json().catch(() => ({}));
    if (r.ok) setMergeDiff({ run: b.run, sources: b.sources });
    else notify(b.error ?? "Không thể tải dữ liệu đối chiếu.", "error");
  };

  const filteredArticles = useMemo(() => {
    return articles.filter((item) =>
      `${item.title} ${item.service_group ?? ""} ${item.status} ${item.response_policy ?? ""}`
        .toLocaleLowerCase("vi-VN")
        .includes(articleFilter.toLocaleLowerCase("vi-VN")),
    );
  }, [articles, articleFilter]);

  return (
    <AppShell screen="knowledge">
      {/* Header */}
      <div className="bento-page-header">
        <div>
          <span className="bento-badge-eyebrow">QUẢN LÝ DỮ LIỆU CĂN CỨ</span>
          <h1 className="bento-page-title">Kho Tri Thức & Tài Liệu</h1>
          <p className="bento-page-subtitle">
            Quản lý tài liệu nguồn được kiểm duyệt dùng để cung cấp câu trả lời có căn cứ cho Trợ lý AI.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Button
            variant="outline"
            size="md"
            leftIcon={<IconImportSpreadsheet size={16} />}
            onClick={() => setShowImport(true)}
          >
            Nhập Excel / CSV
          </Button>
          <Button
            variant="outline"
            size="md"
            leftIcon={<IconMergeArticles size={16} />}
            onClick={() => setShowMergeWorkspace(!showMergeWorkspace)}
          >
            Gộp bài tương tự
          </Button>
          {!showForm && (
            <Button
              variant="primary"
              size="md"
              leftIcon={<IconAddDocument size={16} />}
              onClick={() => setShowForm(true)}
            >
              Thêm bài viết mới
            </Button>
          )}
        </div>
      </div>

      {/* Workspace Gộp bài viết */}
      {showMergeWorkspace && (
        <Card style={{ marginBottom: "1.5rem", border: "1px solid var(--color-border-active)" }}>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <CardTitle>Gộp bài viết trùng lặp theo đợt</CardTitle>
                <CardDescription>
                  Hệ thống tự động phát hiện bài viết tương đồng trong cùng nhóm dịch vụ và chính sách phản hồi.
                </CardDescription>
              </div>
              {mergeBatch && ["queued", "scanning", "generating"].includes(mergeBatch.status) && (
                <Button variant="secondary" size="sm" onClick={() => void cancelMergeBatch()}>
                  Hủy đợt quét
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!mergeBatch || ["failed", "cancelled", "completed"].includes(mergeBatch.status) ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 200px auto", gap: "1rem", alignItems: "flex-end" }}>
                <Input
                  label="Nhóm dịch vụ lọc"
                  placeholder="Để trống = quét toàn bộ kho"
                  value={mergeGroup}
                  onChange={(e) => setMergeGroup(e.target.value)}
                />
                <Input
                  label="Số bài tối đa"
                  type="number"
                  min="10"
                  max="200"
                  value={String(mergeLimit)}
                  onChange={(e) => setMergeLimit(Number(e.target.value))}
                />
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.375rem" }}>
                    Ngưỡng tương đồng: {Math.round(mergeThreshold * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="0.98"
                    step="0.01"
                    value={mergeThreshold}
                    onChange={(e) => setMergeThreshold(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--color-primary)" }}
                  />
                </div>
                <Button variant="primary" size="md" onClick={() => void startMergeBatch()}>
                  Bắt đầu quét
                </Button>
              </div>
            ) : (
              <div style={{ padding: "1rem 0" }}>
                <strong>
                  {mergeBatch.status === "review_ready"
                    ? "Quét xong — Đã sẵn sàng để rà soát nhóm gộp"
                    : "Đang quét và so sánh các bài viết…"}
                </strong>
                <div style={{ margin: "0.75rem 0", background: "var(--color-bg-secondary)", borderRadius: "999px", overflow: "hidden", height: "8px" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (mergeBatch.scanned_articles / Math.max(mergeBatch.total_articles, 1)) * 100)}%`,
                      background: "var(--color-primary)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
                <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                  {mergeBatch.scanned_articles}/{mergeBatch.total_articles} bài đã quét •{" "}
                  {mergeBatch.proposed_groups} nhóm bài viết được đề xuất
                </span>
                {mergeBatch.error_code && (
                  <p style={{ color: "var(--color-danger)", fontSize: "0.875rem", marginTop: "0.5rem" }}>
                    Lỗi [{mergeBatch.error_code}]: {mergeBatch.error_message}
                  </p>
                )}
              </div>
            )}

            {mergeItems.length > 0 && (
              <div style={{ marginTop: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <strong>Nhóm bài viết đề xuất ({mergeItems.length})</strong>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!selectedMergeItems.length || generatingMerge}
                    onClick={() => void generateSelectedMerges()}
                  >
                    {generatingMerge
                      ? "Đang tạo bản nháp gộp…"
                      : `Tạo bản nháp gộp (${selectedMergeItems.length})`}
                  </Button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {mergeItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.75rem 1rem",
                        background: "var(--color-bg-secondary)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--color-border-subtle)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <input
                          type="checkbox"
                          disabled={["drafted", "skipped"].includes(item.status)}
                          checked={selectedMergeItems.includes(item.id)}
                          onChange={(e) =>
                            setSelectedMergeItems((v) =>
                              e.target.checked ? [...v, item.id] : v.filter((id) => id !== item.id),
                            )
                          }
                        />
                        <div>
                          <Badge variant="brand" size="sm">
                            {Math.round(item.score * 100)}% tương đồng
                          </Badge>
                          <span style={{ marginLeft: "0.5rem", fontSize: "0.875rem" }}>
                            {item.reason}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        {item.status === "drafted" && item.merge_run_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void openMergeDiff(item.merge_run_id!)}
                          >
                            Xem đối chiếu
                          </Button>
                        )}
                        <span style={{ fontSize: "0.8125rem", color: "var(--color-text-tertiary)" }}>
                          {item.article_ids.length} bài
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mergeDiff && (
              <Card style={{ marginTop: "1rem", background: "var(--color-bg-primary)" }}>
                <CardHeader>
                  <CardTitle>Bản nháp gộp: {mergeDiff.run.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "0.875rem" }}>
                    {mergeDiff.run.content_markdown}
                  </pre>
                  <div style={{ marginTop: "1rem", borderTop: "1px solid var(--color-border-subtle)", paddingTop: "1rem" }}>
                    <strong style={{ display: "block", marginBottom: "0.5rem" }}>Nguồn ban đầu:</strong>
                    {mergeDiff.sources.map((source, i) => (
                      <div key={i} style={{ marginBottom: "0.75rem" }}>
                        <b>Nguồn {i + 1}: {source.title}</b>
                        <p style={{ margin: "0.25rem 0", color: "var(--color-text-secondary)", fontSize: "0.8125rem" }}>
                          {source.content_markdown.slice(0, 200)}…
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Nhập dữ liệu hàng loạt */}
      {showImport && (
        <div className="ui-modal-backdrop" role="presentation" onMouseDown={() => !importing && setShowImport(false)}>
          <div
            className="ui-modal ui-modal-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="ui-modal-header">
              <span className="ui-modal-eyebrow">NHẬP KHO TRI THỨC</span>
              <div className="ui-modal-title-row">
                <h2 id="import-modal-title" className="ui-modal-title">Nhập dữ liệu hàng loạt</h2>
                <button type="button" className="ui-modal-close" onClick={() => setShowImport(false)}>✕</button>
              </div>
              <p className="ui-modal-description">
                Hỗ trợ tệp CSV (UTF-8) hoặc Excel (.xlsx), tối đa 200 bài viết / 5 MB.
              </p>
            </div>
            <div className="ui-modal-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div style={{ border: "2px dashed var(--color-border-active)", borderRadius: "var(--radius-md)", padding: "1.5rem", textAlign: "center" }}>
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void previewImport(file);
                  }}
                  style={{ display: "block", margin: "0 auto 0.5rem auto" }}
                />
                <a
                  href="/api/knowledge/import/template?format=xlsx"
                  style={{ color: "var(--color-primary)", fontSize: "0.8125rem", textDecoration: "underline" }}
                >
                  Tải tệp mẫu Excel chuẩn
                </a>
              </div>

              {importPreview && (
                <div
                  style={{
                    background: importPreview.invalid ? "rgba(239, 68, 68, 0.08)" : "rgba(34, 197, 94, 0.08)",
                    border: `1px solid ${importPreview.invalid ? "var(--color-danger)" : "var(--color-success)"}`,
                    borderRadius: "var(--radius-md)",
                    padding: "1rem",
                  }}
                >
                  <strong>{importFile?.name}</strong>
                  <div style={{ fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {importPreview.valid}/{importPreview.total} dòng hợp lệ
                    {importPreview.invalid
                      ? ` • ${importPreview.invalid} dòng có lỗi cần sửa`
                      : " • Đã sẵn sàng nhập vào hệ thống"}
                  </div>
                  {importPreview.invalid > 0 && (
                    <ul style={{ margin: "0.5rem 0 0 1.25rem", padding: 0, fontSize: "0.8125rem", color: "var(--color-danger)" }}>
                      {importPreview.rows
                        .filter((r) => r.errors.length)
                        .slice(0, 5)
                        .map((row) => (
                          <li key={row.rowNumber}>
                            Dòng {row.rowNumber}: {row.errors.join("; ")}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <div className="ui-modal-footer">
              <div className="ui-modal-actions">
                <Button variant="secondary" size="md" disabled={importing} onClick={() => setShowImport(false)}>
                  Hủy bỏ
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  disabled={importing || !importPreview || importPreview.invalid > 0}
                  onClick={() => void applyImport()}
                >
                  {importing ? "Đang xử lý nhập dữ liệu…" : `Nhập ${importPreview?.valid ?? 0} bài viết`}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Soạn thảo / Thêm mới bài viết */}
      {showForm && (
        <Card ref={editorRef} style={{ marginBottom: "1.5rem", border: "1px solid var(--color-primary)" }}>
          <CardHeader>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <CardTitle>{editingId ? "Chỉnh sửa bài viết tri thức" : "Thêm bài viết tri thức mới"}</CardTitle>
                <CardDescription>
                  Nội dung xuất bản sẽ được tự động chia nhỏ thành các đoạn tìm kiếm để Trợ lý đối soát tra cứu.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                  setEditSnapshot(null);
                }}
              >
                ✕ Đóng
              </Button>
            </div>
          </CardHeader>
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <Input
              ref={editorTitleRef}
              label="Tiêu đề bài viết"
              placeholder="Ví dụ: Quy trình cài đặt chứng chỉ SSL"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.375rem" }}>
                <label style={{ fontSize: "0.875rem", fontWeight: "600" }}>Nội dung chi tiết (Markdown)</label>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setContent((v) => `${v}${v ? "\n\n" : ""}## Tiêu đề mục\n`)}
                  >
                    Tiêu đề
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setContent((v) => `${v}**in đậm**`)}
                  >
                    In đậm
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setContent((v) => `${v}${v ? "\n" : ""}- Gạch đầu dòng\n`)}
                  >
                    Danh sách
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setContent((v) => `${v}${v ? "\n" : ""}> Ghi chú quan trọng\n`)}
                  >
                    Ghi chú
                  </Button>
                </div>
              </div>
              <Textarea
                placeholder="Nhập nội dung bài viết tài liệu đã được thẩm định…"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--color-text-tertiary)", marginTop: "0.375rem" }}>
                <span>
                  {content.length.toLocaleString("vi-VN")}/{contentLimit.toLocaleString("vi-VN")} ký tự
                </span>
                <span>
                  Ước tính {Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 260) || 0} phân đoạn tra cứu
                </span>
              </div>

              {chunkPreview.length > 0 && (
                <details style={{ marginTop: "0.75rem", background: "var(--color-bg-secondary)", padding: "0.75rem", borderRadius: "var(--radius-md)", fontSize: "0.8125rem" }}>
                  <summary style={{ cursor: "pointer", fontWeight: "600" }}>
                    Xem trước {chunkPreview.length} đoạn đầu Agent sẽ tra cứu
                  </summary>
                  <ol style={{ margin: "0.5rem 0 0 1.25rem", padding: 0 }}>
                    {chunkPreview.map((chunk) => (
                      <li key={chunk.index} style={{ marginBottom: "0.375rem", color: "var(--color-text-secondary)" }}>
                        {chunk.content.slice(0, 180)}…
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 0" }}>
                <input
                  type="checkbox"
                  id="chk-verified"
                  checked={isVerified}
                  onChange={(e) => setIsVerified(e.target.checked)}
                />
                <label htmlFor="chk-verified" style={{ fontSize: "0.875rem", cursor: "pointer" }}>
                  <strong>Nguồn đã xác minh</strong>
                  <div style={{ fontSize: "0.75rem", color: "var(--color-text-tertiary)" }}>
                    Được ưu tiên khi Trợ lý đối soát
                  </div>
                </label>
              </div>

              <Select
                label="Mức độ ưu tiên"
                value={String(sourcePriority)}
                onChange={(e) => setSourcePriority(Number(e.target.value))}
              >
                <option value="80">Cao (Chính sách/Quy trình chuẩn)</option>
                <option value="50">Tiêu chuẩn (Hướng dẫn sử dụng)</option>
                <option value="20">Tham khảo (Cần đối chiếu thêm)</option>
              </Select>

              <Input
                label="Hạn nhắc rà soát"
                type="date"
                value={reviewDueAt}
                onChange={(e) => setReviewDueAt(e.target.value)}
              />

              <Input
                label="Nhóm dịch vụ"
                placeholder="Ví dụ: Email Server, Cloud Hosting"
                value={serviceGroup}
                onChange={(e) => setServiceGroup(e.target.value)}
              />

              <Select
                label="Cách Trợ lý phản hồi"
                value={responsePolicy}
                onChange={(e) => setResponsePolicy(e.target.value as "grounded" | "escalate")}
              >
                <option value="grounded">Trả lời có căn cứ</option>
                <option value="escalate">Chuyển tiếp chuyên gia</option>
              </Select>
            </div>
          </CardContent>
          <CardFooter style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setEditSnapshot(null);
              }}
            >
              Hủy
            </Button>
            <Button
              variant="outline"
              size="md"
              disabled={title.length < 3 || content.length < 20 || !hasArticleChanges}
              onClick={() => void create("draft")}
            >
              Lưu bản nháp
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={title.length < 3 || content.length < 20 || !hasArticleChanges}
              onClick={() => void create("published")}
            >
              Xuất bản bài viết →
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Bảng danh sách bài viết */}
      <Card>
        <CardHeader>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button
                variant={articleStatus === "published" ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setArticleStatus("published");
                  setArticlePage(1);
                }}
              >
                Đang sử dụng
              </Button>
              <Button
                variant={articleStatus === "draft" ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setArticleStatus("draft");
                  setArticlePage(1);
                }}
              >
                Bản nháp
              </Button>
              <Button
                variant={articleStatus === "archived" ? "primary" : "secondary"}
                size="sm"
                onClick={() => {
                  setArticleStatus("archived");
                  setArticlePage(1);
                }}
              >
                Đã lưu trữ
              </Button>
            </div>
            <div style={{ width: "320px" }}>
              <Input
                placeholder="Tìm tiêu đề, nhóm dịch vụ…"
                value={articleFilter}
                onChange={(e) => setArticleFilter(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent style={{ padding: 0 }}>
          {filteredArticles.length === 0 ? (
            <EmptyState
              title="Không tìm thấy bài viết"
              description={
                articleFilter
                  ? "Không có tài liệu nào khớp với từ khóa tìm kiếm của bạn."
                  : "Chưa có bài viết trong danh mục này. Hãy tạo bài viết hoặc nhập từ Excel."
              }
              action={
                !showForm && (
                  <Button variant="primary" size="md" onClick={() => setShowForm(true)}>
                    + Thêm bài viết mới
                  </Button>
                )
              }
            />
          ) : (
            <TableWrapper>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tên tài liệu / Nhóm</TableHead>
                    <TableHead>Số đoạn</TableHead>
                    <TableHead>Chính sách</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead style={{ textAlign: "right" }}>Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArticles.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                          <span style={{ marginTop: "2px", color: "var(--color-primary)" }}>
                            <NavigationIcon name="knowledge" />
                          </span>
                          <div>
                            <strong className="bento-table-lead" style={{ cursor: "pointer" }} onClick={() => void edit(item.id)}>
                              {item.title}
                            </strong>
                            <small className="bento-table-sub">
                              {item.service_group ?? item.category ?? "Chưa phân loại"} • Cập nhật:{" "}
                              {new Date(item.updated_at).toLocaleDateString("vi-VN")}
                              {item.is_verified ? " • Đã xác minh" : " • Chưa xác minh"}
                              {item.version ? ` • v${item.version}` : ""}
                            </small>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="neutral" size="sm">
                          {item.chunk_count} đoạn
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={item.response_policy === "escalate" ? "warning" : "info"}
                          size="sm"
                        >
                          {item.response_policy === "escalate" ? "Chuyển chuyên gia" : "Có căn cứ"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === "published"
                              ? "success"
                              : item.status === "draft"
                              ? "warning"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {item.status === "published"
                            ? "Đã xuất bản"
                            : item.status === "draft"
                            ? "Bản nháp"
                            : "Đã lưu trữ"}
                        </Badge>
                      </TableCell>
                      <TableCell style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.375rem" }}>
                          <Button variant="outline" size="sm" onClick={() => void edit(item.id)}>
                            Sửa
                          </Button>
                          {item.merge_status === "draft" ? (
                            <>
                              <Button variant="primary" size="sm" onClick={() => void decideMerge(item, "approve")}>
                                Duyệt gộp
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => void decideMerge(item, "reject")}>
                                Từ chối
                              </Button>
                            </>
                          ) : (
                            item.status === "published" && (
                              <Button variant="ghost" size="sm" onClick={() => void suggestMerge(item)}>
                                Gộp
                              </Button>
                            )
                          )}
                          {item.status !== "archived" ? (
                            <Button variant="ghost" size="sm" onClick={() => void archive(item.id)}>
                              Lưu trữ
                            </Button>
                          ) : (
                            <>
                              <Button variant="outline" size="sm" onClick={() => void restore(item)}>
                                Khôi phục
                              </Button>
                              <Button variant="danger" size="sm" onClick={() => void purge(item)}>
                                Xóa
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableWrapper>
          )}
        </CardContent>
        {articleTotal > 20 && (
          <CardFooter style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
              Trang {articlePage} / {Math.ceil(articleTotal / 20)} ({articleTotal} bài viết)
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Button
                variant="secondary"
                size="sm"
                disabled={articlePage === 1}
                onClick={() => setArticlePage((p) => p - 1)}
              >
                ← Trước
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={articlePage >= Math.ceil(articleTotal / 20)}
                onClick={() => setArticlePage((p) => p + 1)}
              >
                Sau →
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </AppShell>
  );
}
