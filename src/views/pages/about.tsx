// صفحة "عن التطبيق"
import { Header, Footer, Breadcrumbs, Toast } from '../components/layout'
import { IconShield, IconSparkles, IconDatabase, IconBolt } from '../icons'

export const AboutPage = () => (
  <>
    <Header />
    <main class="container" style="padding-top:1.5rem">
      <Breadcrumbs items={[{ label: 'الرئيسية', href: '/' }, { label: 'عن التطبيق' }]} />
      <div class="card card-elevated" style="padding:2rem">
        <h1>عن تطبيق "تفسير"</h1>
        <p style="font-size:1.05rem;line-height:1.95;margin-top:1rem">
          <strong>تفسير</strong> تطبيق ويب علمي متقدم موجّه لطلاب العلم والباحثين في القرآن الكريم.
          يوفر بحثًا دقيقًا عبر عدد من أمهات كتب التفسير، ويتيح المقارنة بين أقوال المفسرين،
          والتنقل بين السور والآيات، وفهرسة موضوعية مبدئية.
        </p>

        <div class="feature-grid mt-6">
          <div class="feature-card">
            <div class="feature-icon"><IconBolt /></div>
            <div class="feature-title">سرعة البحث</div>
            <div class="feature-desc">محرك بحث محلي يدعم تطبيع النص العربي والبحث التقريبي.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><IconDatabase /></div>
            <div class="feature-title">قاعدة بيانات منظمة</div>
            <div class="feature-desc">سور وآيات وكتب وتفاسير ومؤلفون مرتبطون بفهارس قابلة للتوسع.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><IconShield /></div>
            <div class="feature-title">مصادر موثقة</div>
            <div class="feature-desc">كل تفسير مرتبط بكتاب ومؤلف، مع تنبيه عند عرض عينات تجريبية.</div>
          </div>
          <div class="feature-card">
            <div class="feature-icon"><IconSparkles /></div>
            <div class="feature-title">تجربة فاخرة</div>
            <div class="feature-desc">واجهة عربية بـRTL، خطوط احترافية، وضع ليلي، وحفظ التفضيلات.</div>
          </div>
        </div>

        <h2 class="mt-6">تنبيه مهم</h2>
        <div class="card mt-2" style="background:var(--bg-secondary);border-style:dashed">
          <p style="line-height:1.85">
            النصوص المعروضة هي معاني مستفادة من كتب التفسير المذكورة في كل بطاقة، ومُعاد صياغتها بأسلوب
            موجز لأغراض البحث والاطلاع، ولا تُغني عن مراجعة الكتب الأصلية. ولا يُعتمد عليها وحدها
            في الفتيا أو التحقيق العلمي.
          </p>
        </div>

        <h2 class="mt-6">التقنيات</h2>
        <ul class="text-tertiary" style="padding-inline-start:1rem;line-height:2">
          <li>Hono Framework على Cloudflare Workers/Pages</li>
          <li>JSX SSR + CSS Design System مخصص بالكامل</li>
          <li>RTL، خطوط Cairo / Tajawal / Amiri / Reem Kufi</li>
          <li>محرك بحث محلي مع تطبيع النص العربي و fuzzy search</li>
          <li>PWA installable مع manifest وأيقونة تطبيق</li>
        </ul>
      </div>
    </main>
    <Footer />
    <Toast />
  </>
)
