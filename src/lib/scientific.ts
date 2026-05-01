// Helpers for scientific reliability: source types, verification statuses, and badge metadata.
// Centralizing these enums keeps the UI consistent and makes the data model easier to reason about.

export const SOURCE_TYPES = [
  'original-text',   // نص أصلي حرفي من المصدر
  'summary',         // ملخّص بأسلوب الفريق العلمي للتطبيق
  'sample',          // عيّنة تجريبية للعرض، تحتاج إلى تحقق
  'review-needed',   // يحتاج إلى مراجعة علمية قبل اعتماده
  'curated',         // مجموع من أكثر من مصدر مع توثيق
] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

export const VERIFICATION_STATUSES = [
  'verified',          // تحقق علمي مكتمل (مصدر، طبعة، صفحة)
  'partially-verified', // تحقق جزئي (مصدر مذكور، تفاصيل ناقصة)
  'unverified',        // غير محقق - عينة أو مسودة
  'flagged',           // مُعلَّم لمراجعة، قد يحوي إشكالًا
] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export interface SourceTypeMeta {
  label: string
  description: string
  cssClass: string
}

export interface VerificationStatusMeta extends SourceTypeMeta {
  isWarning: boolean
}

const SOURCE_TYPE_META: Record<SourceType, SourceTypeMeta> = {
  'original-text': {
    label: 'نص أصلي',
    description: 'نص منقول حرفيًا من المصدر مع ذكر الطبعة والصفحة.',
    cssClass: 'badge-source-original',
  },
  summary: {
    label: 'ملخّص',
    description: 'صياغة مختصرة لمعنى التفسير، مستفادة من المصدر، وليست نقلًا حرفيًا.',
    cssClass: 'badge-source-summary',
  },
  sample: {
    label: 'عيّنة',
    description: 'بطاقة تجريبية لأغراض العرض، تحتاج توسيعًا وتدقيقًا قبل الاعتماد.',
    cssClass: 'badge-source-sample',
  },
  'review-needed': {
    label: 'بحاجة لمراجعة',
    description: 'لم يتم التحقق من هذا النص بعد، يُعرض لأغراض المسودة فقط.',
    cssClass: 'badge-source-review',
  },
  curated: {
    label: 'مجموع موثَّق',
    description: 'مصاغ بأسلوب الفريق العلمي بالاستفادة من أكثر من مصدر مع التوثيق.',
    cssClass: 'badge-source-curated',
  },
}

const VERIFICATION_META: Record<VerificationStatus, VerificationStatusMeta> = {
  verified: {
    label: 'موثّق',
    description: 'تم التحقق من النص ومصدره وطبعته.',
    cssClass: 'badge-verify-ok',
    isWarning: false,
  },
  'partially-verified': {
    label: 'تحقق جزئي',
    description: 'المصدر مذكور لكن بعض تفاصيله ناقصة (طبعة/صفحة).',
    cssClass: 'badge-verify-partial',
    isWarning: true,
  },
  unverified: {
    label: 'غير محقق',
    description: 'هذا النص عيّنة لم يتم التحقق منها بعد.',
    cssClass: 'badge-verify-none',
    isWarning: true,
  },
  flagged: {
    label: 'مُعلَّم للمراجعة',
    description: 'وُسِم هذا النص للمراجعة العلمية لاحتمال وجود إشكال.',
    cssClass: 'badge-verify-flag',
    isWarning: true,
  },
}

export function getSourceTypeMeta(t: SourceType | undefined): SourceTypeMeta {
  return SOURCE_TYPE_META[(t || 'sample') as SourceType] || SOURCE_TYPE_META.sample
}

export function getVerificationMeta(v: VerificationStatus | undefined): VerificationStatusMeta {
  return VERIFICATION_META[(v || 'unverified') as VerificationStatus] || VERIFICATION_META.unverified
}

export function isWarningStatus(v: VerificationStatus | undefined): boolean {
  return getVerificationMeta(v).isWarning
}

// Friendly text snippet used in scientific warnings
export const SCIENTIFIC_DISCLAIMER =
  'هذه النصوص في غالبها صياغات مختصرة بأسلوب الفريق العلمي للتطبيق، مستفادة من معاني التفاسير المذكورة، وليست نقلًا حرفيًا. ' +
  'يُرجى الرجوع للمصدر الأصلي للتحقق قبل الاحتجاج بأي نص.'
