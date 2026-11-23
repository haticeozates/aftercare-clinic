import {
  PublicIntro,
  ProductView,
  WorkflowList,
  DemoBand
} from "@/components/public-site/sections";
import { publicMetadata } from "@/lib/public-site/seo";

export const metadata = publicMetadata("/nasil-calisir");

export default function Page() {
  return (
    <>
      <PublicIntro label="İş akışı" title="Plan klinikte başlar, evde devam eder.">
        Klinik ekibi planı ve erişimi yönetir. Danışan kendi bakım adımlarını portalda
        takip eder.
      </PublicIntro>
      <section className="ac-wrap ac-section ac-split">
        <ProductView compact />
        <div>
          <h2>Dört adımda takip</h2>
          <WorkflowList />
        </div>
      </section>
      <DemoBand />
    </>
  );
}
