// التصنيفات الموضوعية للبحث
export interface Category {
  id: string
  name: string
  description: string
  icon: string
  ayahRefs: { surah: number; ayah: number }[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'tawhid',
    name: 'التوحيد والعقيدة',
    description: 'آيات إثبات وحدانية الله وصفاته العلى',
    icon: 'star',
    ayahRefs: [
      { surah: 2, ayah: 255 },
      { surah: 3, ayah: 18 },
      { surah: 112, ayah: 1 },
      { surah: 112, ayah: 2 },
      { surah: 112, ayah: 3 },
      { surah: 112, ayah: 4 },
    ],
  },
  {
    id: 'salah',
    name: 'الصلاة',
    description: 'آيات تتعلق بفريضة الصلاة وأهميتها',
    icon: 'pray',
    ayahRefs: [
      { surah: 2, ayah: 3 },
      { surah: 2, ayah: 153 },
    ],
  },
  {
    id: 'siyam',
    name: 'الصيام',
    description: 'آيات تتعلق بفريضة الصيام والشهر الفضيل',
    icon: 'moon',
    ayahRefs: [
      { surah: 2, ayah: 183 },
    ],
  },
  {
    id: 'akhlaq',
    name: 'الأخلاق والسلوك',
    description: 'آيات في مكارم الأخلاق والسلوك القويم',
    icon: 'heart',
    ayahRefs: [
      { surah: 3, ayah: 159 },
      { surah: 4, ayah: 36 },
    ],
  },
  {
    id: 'estiaza',
    name: 'الاستعاذة والذكر',
    description: 'آيات الذكر والاستعاذة والحفظ',
    icon: 'shield',
    ayahRefs: [
      { surah: 2, ayah: 152 },
      { surah: 113, ayah: 1 },
      { surah: 114, ayah: 1 },
    ],
  },
  {
    id: 'qisas',
    name: 'القصص القرآني',
    description: 'آيات قصص الأنبياء والأمم السابقة',
    icon: 'book',
    ayahRefs: [
      { surah: 36, ayah: 1 },
      { surah: 36, ayah: 3 },
    ],
  },
  {
    id: 'qiyam',
    name: 'اليوم الآخر',
    description: 'آيات تتعلق بالبعث والحساب والجزاء',
    icon: 'sun',
    ayahRefs: [
      { surah: 67, ayah: 1 },
      { surah: 67, ayah: 2 },
    ],
  },
  {
    id: 'tashri',
    name: 'الأحكام والتشريع',
    description: 'آيات الأحكام الفقهية والتشريع',
    icon: 'scale',
    ayahRefs: [
      { surah: 5, ayah: 3 },
      { surah: 2, ayah: 256 },
    ],
  },
]

export const getCategoryById = (id: string) => CATEGORIES.find(c => c.id === id)
