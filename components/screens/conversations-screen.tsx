"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { useFeedback } from "@/components/app-shell";
import {
  Card,
  Button,
  Badge,
  Input,
  Tabs,
  TableWrapper,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  EmptyState,
} from "@/components/ui";

export function ConversationsScreen() {
  const router = useRouter();
  const { confirm, notify } = useFeedback();
  const [items, setItems] = useState<
    Array<{
      id: string;
      title: string;
      message_count: number;
      updated_at: string;
      max_confidence: number | null;
      classification: "social" | "normal" | "escalated" | "knowledge_linked";
      status: "active" | "archived";
      expires_at: string;
    }>
  >([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");

  useEffect(() => {
    void fetch(`/api/conversations?status=${status}`)
      .then((r) => r.json())
      .then((b) => setItems(b.conversations ?? []));
  }, [status]);

  const visible = items.filter((item) =>
    item.title.toLowerCase().includes(query.toLowerCase())
  );

  const deletePermanently = async (item: (typeof items)[number]) => {
    if (
      !(await confirm({
        title: "Xóa vĩnh viễn hội thoại?",
        description: `“${item.title}” cùng toàn bộ tin nhắn và ticket liên quan sẽ bị xóa, không thể khôi phục.`,
        confirmLabel: "Xóa vĩnh viễn",
        tone: "danger",
      }))
    )
      return;

    const response = await fetch(
      `/api/conversations/${item.id}?permanent=true`,
      {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      }
    );

    if (response.ok) {
      setItems((current) =>
        current.filter((conversation) => conversation.id !== item.id)
      );
      notify("Đã xóa vĩnh viễn hội thoại.", "success");
    } else {
      notify("Không thể xóa hội thoại. Vui lòng thử lại.", "error");
    }
  };

  return (
    <AppShell screen="conversations">
      <div className="bento-page-header">
        <div>
          <span className="bento-eyebrow">KHÔNG GIAN LÀM VIỆC / HỘI THOẠI</span>
          <h1 className="bento-page-title">Lịch sử hội thoại</h1>
          <p className="bento-page-desc">
            Tra cứu và quản lý các phiên hỏi đáp và phản hồi đã được xử lý trong hệ thống.
          </p>
        </div>
      </div>

      <Card style={{ padding: "var(--space-6)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
          <Tabs
            variant="segmented"
            size="sm"
            activeKey={status}
            onChange={(key) => setStatus(key as "active" | "archived")}
            items={[
              { key: "active", label: "Đang hoạt động" },
              { key: "archived", label: "Đã lưu trữ" },
            ]}
          />
          <span className="bento-table-sub">Lịch sử được lưu trữ tối đa 90 ngày theo chính sách lưu giữ</span>
        </div>

        <div style={{ marginBottom: "var(--space-4)" }}>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm kiếm theo tiêu đề hội thoại…"
          />
        </div>

        <TableWrapper>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hội thoại</TableHead>
                <TableHead>Số tin nhắn</TableHead>
                <TableHead>Cập nhật lúc</TableHead>
                <TableHead>Độ tin cậy cao nhất</TableHead>
                <TableHead style={{ textAlign: "right" }}>Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length ? (
                visible.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <strong className="bento-table-lead">{item.title}</strong>
                      <small className="bento-table-sub">Mã: {item.id.slice(0, 8)}</small>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral" size="sm">
                        {item.message_count} tin nhắn
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(item.updated_at).toLocaleString("vi-VN")}</TableCell>
                    <TableCell>
                      {item.max_confidence === null ? (
                        "—"
                      ) : (
                        <Badge variant="success" size="sm">
                          {Math.round(Number(item.max_confidence) * 100)}%
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell style={{ textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            router.push(`/assistant?conversationId=${item.id}`)
                          }
                        >
                          Mở lại
                        </Button>
                        {status === "active" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={async () => {
                              const response = await fetch(
                                `/api/conversations/${item.id}`,
                                { method: "DELETE" }
                              );
                              if (response.ok)
                                setItems((current) =>
                                  current.filter(
                                    (conversation) => conversation.id !== item.id
                                  )
                                );
                            }}
                          >
                            Lưu trữ
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void deletePermanently(item)}
                        >
                          Xóa vĩnh viễn
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} style={{ padding: "var(--space-8)", textAlign: "center", color: "var(--text-muted)" }}>
                    Không có hội thoại nào phù hợp với bộ lọc hiện tại.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableWrapper>
      </Card>
    </AppShell>
  );
}
