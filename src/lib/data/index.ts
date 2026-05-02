// =============================================================================
// Data Access Layer — Entry Point
// =============================================================================
// هذا هو نقطة الدخول الرسمية لطبقة الوصول إلى البيانات.
//
// الاستعمال (الموصى به في الصفحات الجديدة):
//   import { getDataProvider } from './lib/data'
//   const data = getDataProvider(c.env)        // c.env من Hono
//   const stats = await data.getStatsBasic()
//   const ayah = await data.getAyah(1, 1)
//
// السلوك الحالي:
//   - إذا كان `env.DB` موجودًا (binding D1)، سيُرجَع D1 provider لاحقًا
//     (غير مفعّل بعد — TODO).
//   - وإلا يُرجَع seed provider (الافتراضي الحالي).
//
// مهم: لم نُغيّر الكود الحالي في `src/index.tsx` و `src/lib/search.ts`
// و `src/views/*` ليبقى كل ما يعمل اليوم على حاله. هذه الطبقة قاعدة
// تمهيدية فقط، وستُربط تدريجيًا في الصفحات بدءًا من stats / ayah lookup.
// =============================================================================

import { seedProvider } from './seed-provider'
import type { DataProvider, RequestEnv } from './types'

export type { DataProvider, RequestEnv, BasicStats } from './types'
export { seedProvider }

/**
 * يختار مزوّد البيانات المناسب بناءً على البيئة.
 *
 * @param env بيئة Cloudflare Pages من `c.env` في Hono. قد تحتوي `DB` (D1Database).
 *            عند عدم تمريرها يُستعمل seed provider مباشرةً.
 *
 * @returns DataProvider جاهز للاستعمال (متزامن أو غير متزامن).
 *
 * NOTE: D1 provider لم يُفعَّل بعد. عند إضافة D1 binding في `wrangler.jsonc`
 * وتشغيل migrations، سننشئ `d1-provider.ts` ونعيده هنا. لذلك نحتفظ بفرع
 * `if (env?.DB)` معلَّقًا الآن مع علامة TODO حتى لا يفاجئ أحدًا التحوّل.
 */
export function getDataProvider(env?: RequestEnv): DataProvider {
  // TODO(d1): when D1 binding is wired, return makeD1Provider(env.DB).
  // Keeping the branch here documents the intent and gives a single
  // switch-point for the future.
  // if (env && (env as any).DB) {
  //   return makeD1Provider((env as any).DB as D1Database)
  // }
  void env // suppress unused-var lint while D1 path is dormant
  return seedProvider
}

/** اختصار للحصول على المزوّد الافتراضي بدون تمرير env. */
export function getDefaultDataProvider(): DataProvider {
  return seedProvider
}
