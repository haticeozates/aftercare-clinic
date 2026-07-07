import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Badge, Button, EmptyState, FormField, PageHeader, StatCard, statusBadgeVariant } from "@/components/ui";

describe("premium UI primitives", () => {
  it("renders button variants with stable accessible classes", () => {
    const primary = renderToStaticMarkup(<Button>Kaydet</Button>);
    const secondary = renderToStaticMarkup(<Button variant="secondary">Vazgeç</Button>);
    const danger = renderToStaticMarkup(<Button variant="danger">Arşivle</Button>);

    expect(primary).toContain("ui-button");
    expect(primary).toContain("ui-button--primary");
    expect(secondary).toContain("ui-button--secondary");
    expect(danger).toContain("ui-button--danger");
  });

  it("maps operational statuses to semantic badge variants", () => {
    expect(statusBadgeVariant("active")).toBe("success");
    expect(statusBadgeVariant("open")).toBe("warning");
    expect(statusBadgeVariant("resolved")).toBe("neutral");
    expect(statusBadgeVariant("stopped")).toBe("danger");
  });

  it("renders page headers, stat cards, empty states and form errors consistently", () => {
    const markup = renderToStaticMarkup(
      <section>
        <PageHeader eyebrow="Genel Bakış" title="Operasyon özeti" description="Bugünkü takip akışları" />
        <StatCard label="Aktif bakım planları" value={4} tone="teal" />
        <EmptyState title="Kayıt yok" description="Filtreleri değiştirerek tekrar deneyin." />
        <FormField id="fullName" label="Ad soyad" error="Ad soyad zorunludur">
          <input id="fullName" name="fullName" />
        </FormField>
        <Badge variant="warning">Klinik değerlendirmesi bekliyor</Badge>
      </section>
    );

    expect(markup).toContain("page-title");
    expect(markup).toContain("stat-card--teal");
    expect(markup).toContain("role=\"status\"");
    expect(markup).toContain("aria-describedby=\"fullName-error\"");
    expect(markup).toContain("badge--warning");
  });
});
