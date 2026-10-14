import { Skeleton } from "@/shared/ui/workbench";

export function JobCardSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "16px 20px",
        borderRadius: "var(--radius-control)",
        border: "1px solid var(--hairline)",
        background: "transparent",
      }}
      aria-hidden="true"
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14, flex: 1 }}>
        <Skeleton width={40} height={40} style={{ borderRadius: "var(--radius-control)", flexShrink: 0 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 360 }}>
          <Skeleton width="70%" height={16} />
          <Skeleton width="45%" height={13} />
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <Skeleton width={60} height={24} style={{ borderRadius: 9999 }} />
        <Skeleton width={160} height={32} style={{ borderRadius: "var(--radius-control)" }} />
      </div>
    </div>
  );
}
