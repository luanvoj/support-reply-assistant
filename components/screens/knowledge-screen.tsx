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
  BentoSelect,
  BentoDatePicker,
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
  const [mergeConfigOpen, setMergeConfigOpen] = useState(false);

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
      { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: true }) },
    );
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      notify("Đã xóa vĩnh viễn bài viết.", "success");
      setArticles((current) => current.filter((article) => article.id !== item.id));
      setArticleTotal((current) => Math.max(0, current - 1));
      if (articles.length === 1 && articlePage > 1) setArticlePage(articlePage - 1);
      else void load();
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
      const items = b.items ?? [];
      setMergeItems(items);
      // A completed draft must never remain in the local selection from an
      // earlier render; otherwise the bulk CTA can still show a stale count.
      const selectableIds = new Set(
        items
          .filter((item: { id: string; status: string }) => !["drafted", "skipped"].includes(item.status))
          .map((item: { id: string }) => item.id),
      );
      setSelectedMergeItems((selected) => selected.filter((itemId) => selectableIds.has(itemId)));
    }
  };

  const startMergeBatch = async () => {
    setMergeConfigOpen(false);
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
    const selectableIds = new Set(
      mergeItems
        .filter((item) => !["drafted", "skipped"].includes(item.status))
        .map((item) => item.id),
    );
    const selectedItems = mergeItems.filter(
      (item) => itemIds.includes(item.id) && selectableIds.has(item.id),
    );
    if (!selectedItems.length) {
      setSelectedMergeItems([]);
      return;
    }
    setGeneratingMerge(true);
    let done = 0;
    let failed = 0;
    let skipped = 0;
    for (const item of selectedItems) {
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

  const articleTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of articles) {
      map.set(a.id, a.title);
    }
    return map;
  }, [articles]);

  const selectableMergeItems = useMemo(
    () => mergeItems.filter((item) => !["drafted", "skipped"].includes(item.status)),
    [mergeItems],
  );
  const selectedSelectableMergeItems = useMemo(
    () => selectedMergeItems.filter((itemId) => selectableMergeItems.some((item) => item.id === itemId)),
    [selectedMergeItems, selectableMergeItems],
  );

  return (
    <AppShell screen="knowledge">
      {/* Header */}
      <div className="bento-page-header">
        <div>
          <span className="bento-eyebrow">QUẢN LÝ DỮ LIỆU</span>
          <h1 className="bento-page-title">Kho Tri Thức & Tài Liệu</h1>
          <p className="bento-page-desc">
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
        <Card
          variant="elevated"
          style={{
            marginBottom: "var(--space-6)",
            border: "1px solid var(--border-default)",
            borderRadius: "var(--radius-xl)",
            overflow: "hidden",
            background: "var(--bg-surface)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          {/* Header Workspace */}
          <div
            style={{
              padding: "var(--space-4) var(--space-6)",
              background: "linear-gradient(180deg, var(--bg-surface-subtle) 0%, var(--bg-surface) 100%)",
              borderBottom: "1px solid var(--border-default)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "var(--radius-md)",
                  background: "linear-gradient(135deg, rgba(99, 102, 241, 0.14), rgba(79, 70, 229, 0.24))",
                  color: "var(--brand-primary)",
                  display: "grid",
                  placeItems: "center",
                  border: "1px solid var(--brand-light-border)",
                  boxShadow: "0 2px 8px var(--brand-glow)",
                  flexShrink: 0,
                }}
              >
                <IconMergeArticles size={22} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      letterSpacing: "0.08em",
                      color: "var(--brand-primary)",
                      textTransform: "uppercase",
                    }}
                  >
                    HỢP NHẤT DỮ LIỆU THÔNG MINH
                  </span>
                  {mergeBatch && (
                    <Badge
                      variant={
                        mergeBatch.status === "review_ready" || mergeBatch.status === "completed"
                          ? "success"
                          : ["scanning", "generating", "queued"].includes(mergeBatch.status)
                          ? "brand"
                          : mergeBatch.status === "failed"
                          ? "danger"
                          : "neutral"
                      }
                      size="sm"
                      dot
                      pulse={["scanning", "generating"].includes(mergeBatch.status)}
                    >
                      {mergeBatch.status === "review_ready"
                        ? "Đã sẵn sàng rà soát"
                        : mergeBatch.status === "scanning"
                        ? "Đang quét dữ liệu…"
                        : mergeBatch.status === "generating"
                        ? "Đang tạo bản nháp…"
                        : mergeBatch.status === "queued"
                        ? "Đang xếp hàng đợi"
                        : mergeBatch.status === "completed"
                        ? "Đã hoàn thành"
                        : mergeBatch.status === "failed"
                        ? "Gặp sự cố"
                        : "Đã hủy"}
                    </Badge>
                  )}
                </div>
                <h2
                  style={{
                    margin: "2px 0 0",
                    fontSize: "var(--text-lg)",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  Gộp bài viết trùng lặp theo đợt
                </h2>
                <p
                  style={{
                    margin: "2px 0 0",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-muted)",
                  }}
                >
                  Hệ thống tự động phát hiện bài viết tương đồng trong cùng nhóm dịch vụ và chính sách phản hồi.
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              {mergeBatch && ["queued", "scanning", "generating"].includes(mergeBatch.status) && (
                <Button variant="danger" size="sm" onClick={() => void cancelMergeBatch()}>
                  Hủy đợt quét
                </Button>
              )}
              {mergeBatch && !["queued", "scanning", "generating"].includes(mergeBatch.status) && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setMergeConfigOpen((v) => !v)}
                >
                  {mergeConfigOpen ? "Thu gọn cấu hình" : "Điều chỉnh tham số quét"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMergeWorkspace(false)}
                title="Đóng workspace"
              >
                ✕ Thu gọn
              </Button>
            </div>
          </div>

          {/* Bento Stats / KPI Summary */}
          {mergeBatch && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "var(--space-3)",
                padding: "var(--space-4) var(--space-6)",
                background: "var(--bg-surface-subtle)",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              {/* Card 1: Số bài đã quét */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Tiến độ quét</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--brand-primary)" }}>
                    {Math.round((mergeBatch.scanned_articles / Math.max(mergeBatch.total_articles, 1)) * 100)}%
                  </span>
                </div>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>
                  {mergeBatch.scanned_articles}{" "}
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 400 }}>
                    / {mergeBatch.total_articles} bài
                  </span>
                </div>
                <div
                  style={{
                    marginTop: "var(--space-2)",
                    height: "6px",
                    borderRadius: "var(--radius-full)",
                    background: "var(--border-default)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, (mergeBatch.scanned_articles / Math.max(mergeBatch.total_articles, 1)) * 100)}%`,
                      background: "var(--brand-gradient)",
                      transition: "width 0.3s ease",
                    }}
                  />
                </div>
              </div>

              {/* Card 2: Nhóm đề xuất */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Nhóm bài viết phát hiện</span>
                <div
                  style={{
                    fontSize: "var(--text-xl)",
                    fontWeight: 800,
                    color: mergeBatch.proposed_groups > 0 ? "var(--brand-primary)" : "var(--text-primary)",
                    marginTop: "4px",
                  }}
                >
                  {mergeBatch.proposed_groups}{" "}
                  <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", fontWeight: 400 }}>
                    nhóm
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "var(--space-1)", display: "block" }}>
                  {mergeBatch.proposed_groups > 0 ? "Đã phân tích độ tương đồng" : "Chưa có nhóm nào thỏa ngưỡng"}
                </span>
              </div>

              {/* Card 3: Ngưỡng tương đồng */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Ngưỡng tương đồng</span>
                <div style={{ fontSize: "var(--text-xl)", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>
                  {Math.round(mergeThreshold * 100)}%
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: mergeThreshold >= 0.8 ? "var(--success-text)" : "var(--brand-primary)",
                    marginTop: "var(--space-1)",
                    display: "block",
                  }}
                >
                  {mergeThreshold >= 0.85
                    ? "Khắt khe (Chính xác cao)"
                    : mergeThreshold >= 0.75
                    ? "Tiêu chuẩn (Khuyến nghị)"
                    : "Mở rộng (Tìm kiếm rộng)"}
                </span>
              </div>

              {/* Card 4: Phạm vi */}
              <div
                style={{
                  background: "var(--bg-surface)",
                  padding: "var(--space-3) var(--space-4)",
                  borderRadius: "var(--radius-md)",
                  border: "1px solid var(--border-default)",
                  boxShadow: "var(--shadow-xs)",
                }}
              >
                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Phạm vi nhóm dịch vụ</span>
                <div
                  style={{
                    fontSize: "var(--text-base)",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginTop: "4px",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                  }}
                >
                  {mergeGroup || "Toàn bộ kho tri thức"}
                </div>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "var(--space-1)", display: "block" }}>
                  Giới hạn tối đa {mergeLimit} bài viết
                </span>
              </div>
            </div>
          )}

          <CardContent style={{ padding: "var(--space-6)" }}>
            {/* Lỗi nếu có */}
            {mergeBatch?.error_code && (
              <div
                style={{
                  padding: "var(--space-3) var(--space-4)",
                  background: "var(--danger-bg)",
                  border: "1px solid var(--danger-border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--danger-text)",
                  fontSize: "var(--text-sm)",
                  marginBottom: "var(--space-4)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                }}
              >
                <strong>Lỗi [{mergeBatch.error_code}]:</strong>
                <span>{mergeBatch.error_message || "Đã xảy ra lỗi trong quá trình quét đợt gộp."}</span>
              </div>
            )}

            {/* Khối cấu hình quét: Hiện khi chưa quét, hoặc khi quét xong/lỗi, hoặc khi bấm mở cấu hình */}
            {(!mergeBatch ||
              ["failed", "cancelled", "completed"].includes(mergeBatch.status) ||
              mergeConfigOpen) && (
              <div
                style={{
                  background: "var(--bg-surface-subtle)",
                  border: "1px solid var(--border-default)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-5)",
                  marginBottom: mergeBatch ? "var(--space-5)" : 0,
                }}
              >
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <h3 style={{ margin: 0, fontSize: "var(--text-md)", fontWeight: 700, color: "var(--text-primary)" }}>
                    Cấu hình tham số đợt quét mới
                  </h3>
                  <p style={{ margin: "4px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                    Tùy chỉnh nhóm dịch vụ lọc, giới hạn bài viết và ngưỡng độ tương đồng trước khi bắt đầu quét.
                  </p>
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "var(--space-4)",
                    alignItems: "flex-start",
                  }}
                >
                  <Input
                    label="Nhóm dịch vụ lọc"
                    placeholder="Để trống = quét toàn bộ kho"
                    value={mergeGroup}
                    onChange={(e) => setMergeGroup(e.target.value)}
                  />

                  <Input
                    label="Số bài tối đa cần quét"
                    type="number"
                    min="10"
                    max="200"
                    value={String(mergeLimit)}
                    onChange={(e) => setMergeLimit(Number(e.target.value))}
                  />

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-1-5)" }}>
                      <label style={{ fontSize: "var(--text-xs)", fontWeight: 600, color: "var(--text-secondary)" }}>
                        Ngưỡng tương đồng:
                      </label>
                      <Badge variant={mergeThreshold >= 0.8 ? "success" : "brand"} size="sm">
                        {Math.round(mergeThreshold * 100)}%
                      </Badge>
                    </div>

                    <input
                      type="range"
                      min="0.5"
                      max="0.98"
                      step="0.01"
                      value={mergeThreshold}
                      onChange={(e) => setMergeThreshold(Number(e.target.value))}
                      style={{
                        width: "100%",
                        height: "6px",
                        accentColor: "var(--brand-primary)",
                        cursor: "pointer",
                      }}
                    />

                    {/* Quick Presets */}
                    <div style={{ display: "flex", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
                      {[
                        { val: 0.65, label: "65% (Mở rộng)" },
                        { val: 0.75, label: "75% (Chuẩn)" },
                        { val: 0.85, label: "85% (Khắt khe)" },
                      ].map((preset) => (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setMergeThreshold(preset.val)}
                          style={{
                            padding: "2px 8px",
                            fontSize: "10px",
                            fontWeight: 600,
                            borderRadius: "var(--radius-sm)",
                            border:
                              Math.abs(mergeThreshold - preset.val) < 0.02
                                ? "1px solid var(--brand-primary)"
                                : "1px solid var(--border-default)",
                            background:
                              Math.abs(mergeThreshold - preset.val) < 0.02
                                ? "var(--brand-light)"
                                : "var(--bg-surface)",
                            color:
                              Math.abs(mergeThreshold - preset.val) < 0.02
                                ? "var(--brand-primary)"
                                : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "flex-end", height: "100%", paddingTop: "1.25rem" }}>
                    <Button
                      variant="primary"
                      size="md"
                      leftIcon={<IconMergeArticles size={16} />}
                      onClick={() => void startMergeBatch()}
                      style={{ width: "100%" }}
                    >
                      Bắt đầu quét trùng lặp
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Trạng thái đang quét */}
            {mergeBatch && ["queued", "scanning", "generating"].includes(mergeBatch.status) && (
              <div
                style={{
                  padding: "var(--space-6)",
                  textAlign: "center",
                  background: "var(--bg-surface-subtle)",
                  borderRadius: "var(--radius-lg)",
                  border: "1px solid var(--border-default)",
                }}
              >
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    background: "var(--brand-light)",
                    color: "var(--brand-primary)",
                    display: "grid",
                    placeItems: "center",
                    margin: "0 auto var(--space-3)",
                    animation: "bento-pulse-ring 2s infinite ease-in-out",
                  }}
                >
                  <IconMergeArticles size={24} />
                </div>
                <h4 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                  {mergeBatch.status === "generating"
                    ? "Đang tạo bản nháp gộp từ các tài liệu nguồn…"
                    : "Đang quét và so sánh các bài viết trong kho…"}
                </h4>
                <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                  Tiến độ: {mergeBatch.scanned_articles} / {mergeBatch.total_articles} bài đã được phân tích ngữ nghĩa vector.
                </p>
              </div>
            )}

            {/* Trạng thái quét xong nhưng 0 nhóm đề xuất: Empty State */}
            {mergeBatch && mergeBatch.status === "review_ready" && mergeItems.length === 0 && (
              <EmptyState
                icon={
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      background: "var(--brand-light)",
                      color: "var(--brand-primary)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <IconMergeArticles size={28} />
                  </div>
                }
                title="Không phát hiện bài viết trùng lặp"
                description={
                  mergeBatch.total_articles === 0
                    ? "Không tìm thấy bài viết đã xuất bản nào phù hợp với phạm vi quét hiện tại."
                    : `Hệ thống đã phân tích ${mergeBatch.scanned_articles} bài viết với ngưỡng tương đồng ${Math.round(
                        mergeThreshold * 100,
                      )}%. Tất cả bài viết đều có nội dung riêng biệt hoặc mức tương đồng thấp hơn ngưỡng yêu cầu.`
                }
                action={
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", justifyContent: "center" }}>
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => setMergeConfigOpen(true)}
                    >
                      Điều chỉnh tham số & Quét lại
                    </Button>
                    {mergeThreshold > 0.65 && (
                      <Button
                        variant="outline"
                        size="md"
                        onClick={() => {
                          setMergeThreshold(0.65);
                          void startMergeBatch();
                        }}
                      >
                        Thử quét lại với ngưỡng 65% (Mở rộng)
                      </Button>
                    )}
                  </div>
                }
              />
            )}

            {/* Danh sách các nhóm bài viết đề xuất gộp */}
            {mergeItems.length > 0 && (
              <div style={{ marginTop: "var(--space-2)" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "var(--space-3)",
                    flexWrap: "wrap",
                    gap: "var(--space-2)",
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0, fontSize: "var(--text-base)", fontWeight: 700, color: "var(--text-primary)" }}>
                      Nhóm bài viết đề xuất hợp nhất ({mergeItems.length})
                    </h3>
                    <p style={{ margin: "2px 0 0", fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>
                      Chọn các nhóm tương đồng cao để hệ thống tạo bản nháp tổng hợp và đưa vào hàng rà soát.
                    </p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (selectedSelectableMergeItems.length === selectableMergeItems.length) {
                          setSelectedMergeItems([]);
                        } else {
                          setSelectedMergeItems(selectableMergeItems.map((i) => i.id));
                        }
                      }}
                      disabled={!selectableMergeItems.length || generatingMerge}
                    >
                      {selectedSelectableMergeItems.length === selectableMergeItems.length
                        ? "Bỏ chọn tất cả"
                        : "Chọn tất cả"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!selectedSelectableMergeItems.length || generatingMerge}
                      onClick={() => void generateSelectedMerges()}
                    >
                      {generatingMerge
                        ? "Đang tạo bản nháp gộp…"
                        : `Tạo bản nháp gộp (${selectedSelectableMergeItems.length})`}
                    </Button>
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2-5)" }}>
                  {mergeItems.map((item) => {
                    const isDrafted = item.status === "drafted";
                    const isSkipped = item.status === "skipped";
                    const isSelected = !isDrafted && !isSkipped && selectedMergeItems.includes(item.id);

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          padding: "var(--space-3-5) var(--space-4)",
                          background: isSelected
                            ? "var(--brand-light)"
                            : "var(--bg-surface)",
                          borderRadius: "var(--radius-lg)",
                          border: isSelected
                            ? "1px solid var(--brand-light-border)"
                            : "1px solid var(--border-default)",
                          boxShadow: "var(--shadow-xs)",
                          transition: "all var(--duration-fast) var(--ease-spring)",
                          gap: "var(--space-3)",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)", flex: 1, minWidth: 0 }}>
                          <input
                            type="checkbox"
                            disabled={isDrafted || isSkipped}
                            checked={isSelected}
                            onChange={(e) =>
                              setSelectedMergeItems((v) =>
                                e.target.checked ? [...v, item.id] : v.filter((id) => id !== item.id),
                              )
                            }
                            style={{
                              marginTop: "4px",
                              width: "16px",
                              height: "16px",
                              cursor: isDrafted || isSkipped ? "not-allowed" : "pointer",
                              accentColor: "var(--brand-primary)",
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                              <Badge
                                variant={item.score >= 0.85 ? "success" : "brand"}
                                size="sm"
                              >
                                {Math.round(item.score * 100)}% tương đồng
                              </Badge>
                              {isDrafted && (
                                <Badge variant="info" size="sm">
                                  Đã tạo bản nháp gộp
                                </Badge>
                              )}
                              {isSkipped && (
                                <Badge variant="neutral" size="sm">
                                  Giữ riêng
                                </Badge>
                              )}
                              <span style={{ fontSize: "var(--text-xs)", color: "var(--text-secondary)", fontWeight: 500 }}>
                                {item.reason}
                              </span>
                            </div>

                            {/* Danh sách tiêu đề bài viết con trong nhóm */}
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-1)", marginTop: "var(--space-2)" }}>
                              {item.article_ids.map((artId, idx) => {
                                const artTitle = articleTitleMap.get(artId);
                                return (
                                  <span
                                    key={artId}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "2px 8px",
                                      background: "var(--bg-surface-subtle)",
                                      border: "1px solid var(--border-subtle)",
                                      borderRadius: "var(--radius-sm)",
                                      fontSize: "11px",
                                      color: "var(--text-secondary)",
                                      maxWidth: "320px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                    title={artTitle || artId}
                                  >
                                    <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>#{idx + 1}</span>
                                    {artTitle || `Bài viết #${artId.slice(0, 8)}`}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Cột phải: Thao tác */}
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexShrink: 0 }}>
                          {isDrafted && item.merge_run_id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void openMergeDiff(item.merge_run_id!)}
                            >
                              Xem đối chiếu
                            </Button>
                          )}
                          <span
                            style={{
                              fontSize: "var(--text-xs)",
                              fontWeight: 600,
                              color: "var(--text-muted)",
                              padding: "4px 8px",
                              background: "var(--bg-surface-subtle)",
                              borderRadius: "var(--radius-sm)",
                            }}
                          >
                            {item.article_ids.length} bài nguồn
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Modal Đối chiếu bản nháp gộp (Thay thế thẻ pre thô) */}
      {mergeDiff && (
        <div
          className="ui-modal-backdrop"
          role="presentation"
          onMouseDown={() => setMergeDiff(null)}
        >
          <div
            className="ui-modal ui-modal-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="merge-diff-modal-title"
            onMouseDown={(e) => e.stopPropagation()}
            style={{ maxWidth: "1020px", maxHeight: "90vh" }}
          >
            <div className="ui-modal-header">
              <span className="ui-modal-eyebrow">ĐỐI CHIẾU HỢP NHẤT TRI THỨC</span>
              <div className="ui-modal-title-row">
                <h2 id="merge-diff-modal-title" className="ui-modal-title">
                  Đối chiếu bản gộp: {mergeDiff.run.title}
                </h2>
                <button
                  type="button"
                  className="ui-modal-close"
                  onClick={() => setMergeDiff(null)}
                  title="Đóng modal"
                >
                  ✕
                </button>
              </div>
              <p className="ui-modal-description">
                So sánh nội dung bản nháp do AI tổng hợp với các bài viết nguồn ban đầu trước khi duyệt xuất bản.
              </p>
            </div>

            <div
              className="ui-modal-body"
              style={{
                overflowY: "auto",
                display: "grid",
                gridTemplateColumns: "1.25fr 1fr",
                gap: "var(--space-4)",
                padding: "var(--space-5)",
              }}
            >
              {/* Cột 1: Bản nháp gộp hoàn thiện */}
              <div
                style={{
                  background: "var(--bg-surface-subtle)",
                  borderRadius: "var(--radius-lg)",
                  padding: "var(--space-4)",
                  border: "1px solid var(--border-default)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                    <Badge variant="brand" size="sm">
                      Bản nháp gộp mới
                    </Badge>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Do AI biên soạn</span>
                  </div>
                  <Badge variant="neutral" size="sm">
                    {mergeDiff.run.status}
                  </Badge>
                </div>
                <h3
                  style={{
                    margin: 0,
                    fontSize: "var(--text-base)",
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {mergeDiff.run.title}
                </h3>
                <div
                  style={{
                    background: "var(--bg-surface)",
                    padding: "var(--space-4)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-default)",
                    fontSize: "var(--text-sm)",
                    lineHeight: "var(--leading-relaxed)",
                    whiteSpace: "pre-wrap",
                    color: "var(--text-secondary)",
                    maxHeight: "440px",
                    overflowY: "auto",
                    fontFamily: "inherit",
                  }}
                >
                  {mergeDiff.run.content_markdown}
                </div>
              </div>

              {/* Cột 2: Các tài liệu nguồn ban đầu */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "var(--text-primary)" }}>
                    Tài liệu nguồn ({mergeDiff.sources.length} bài viết)
                  </span>
                  <Badge variant="neutral" size="sm">
                    Nội dung gốc
                  </Badge>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-3)",
                    maxHeight: "520px",
                    overflowY: "auto",
                  }}
                >
                  {mergeDiff.sources.map((source, i) => (
                    <div
                      key={i}
                      style={{
                        background: "var(--bg-surface)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--border-default)",
                        padding: "var(--space-3-5)",
                        boxShadow: "var(--shadow-xs)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: "var(--space-1-5)",
                        }}
                      >
                        <Badge variant="info" size="sm">
                          Nguồn #{i + 1}
                        </Badge>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          Trạng thái: {source.status}
                        </span>
                      </div>
                      <h4
                        style={{
                          margin: "0 0 var(--space-2) 0",
                          fontSize: "var(--text-sm)",
                          fontWeight: 700,
                          color: "var(--text-primary)",
                        }}
                      >
                        {source.title}
                      </h4>
                      <div
                        style={{
                          fontSize: "var(--text-xs)",
                          color: "var(--text-secondary)",
                          lineHeight: "var(--leading-normal)",
                          maxHeight: "150px",
                          overflowY: "auto",
                          whiteSpace: "pre-wrap",
                          background: "var(--bg-surface-subtle)",
                          padding: "var(--space-2-5)",
                          borderRadius: "var(--radius-sm)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {source.content_markdown}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="ui-modal-footer">
              <div className="ui-modal-actions" style={{ justifyContent: "flex-end", width: "100%" }}>
                <Button variant="secondary" size="md" onClick={() => setMergeDiff(null)}>
                  Đóng đối chiếu
                </Button>
              </div>
            </div>
          </div>
        </div>
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
          <CardContent style={{ display: "flex", flexDirection: "column", gap: "1.25rem", position: "relative", zIndex: 1 }}>
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

              <BentoSelect
                label="Mức độ ưu tiên"
                value={String(sourcePriority)}
                options={[
                  { value: "80", label: "Cao (Chính sách/Quy trình chuẩn)" },
                  { value: "50", label: "Tiêu chuẩn (Hướng dẫn sử dụng)" },
                  { value: "20", label: "Tham khảo (Cần đối chiếu thêm)" },
                ]}
                onChange={(val) => setSourcePriority(Number(val))}
              />

              <BentoDatePicker
                label="Hạn nhắc rà soát"
                value={reviewDueAt}
                placeholder="Chọn hạn rà soát…"
                onChange={(val) => setReviewDueAt(val)}
              />

              <Input
                label="Nhóm dịch vụ"
                placeholder="Ví dụ: Email Server, Cloud Hosting"
                value={serviceGroup}
                onChange={(e) => setServiceGroup(e.target.value)}
              />

              <BentoSelect
                label="Cách Trợ lý phản hồi"
                value={responsePolicy}
                options={[
                  { value: "grounded", label: "Trả lời có căn cứ" },
                  { value: "escalate", label: "Chuyển tiếp chuyên gia" },
                ]}
                onChange={(val) => setResponsePolicy(val as "grounded" | "escalate")}
              />
            </div>
          </CardContent>
          <CardFooter style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", position: "relative", zIndex: 0 }}>
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
                          ) : null}
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
