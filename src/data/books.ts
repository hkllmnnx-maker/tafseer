// كتب التفسير المتوفرة في التطبيق
export type TafseerSchool =
  | 'بالمأثور'
  | 'بالرأي'
  | 'فقهي'
  | 'لغوي'
  | 'بلاغي'
  | 'معاصر'
  | 'ميسر'
  | 'موسوعي'

export interface TafseerBook {
  id: string
  title: string
  fullTitle: string
  authorId: string
  schools: TafseerSchool[]
  volumes?: number
  description: string
  publishedYear?: number
  edition?: string
  popularity: number // 1-10
  featured?: boolean
}

export const BOOKS: TafseerBook[] = [
  {
    id: 'tabari',
    title: 'تفسير الطبري',
    fullTitle: 'جامع البيان عن تأويل آي القرآن',
    authorId: 'tabari',
    schools: ['بالمأثور', 'موسوعي'],
    volumes: 24,
    description:
      'يُعدّ من أوائل وأشمل كتب التفسير، يجمع أقوال الصحابة والتابعين بالأسانيد، ويرجّح بين الأقوال بمنهج علمي رصين.',
    popularity: 10,
    featured: true,
  },
  {
    id: 'ibn-kathir',
    title: 'تفسير ابن كثير',
    fullTitle: 'تفسير القرآن العظيم',
    authorId: 'ibn-kathir',
    schools: ['بالمأثور'],
    volumes: 8,
    description:
      'من أصح كتب التفسير بالمأثور، يفسّر القرآن بالقرآن ثم بالسنة ثم بأقوال الصحابة والتابعين، مع تحقيق علمي للأحاديث.',
    popularity: 10,
    featured: true,
  },
  {
    id: 'qurtubi',
    title: 'تفسير القرطبي',
    fullTitle: 'الجامع لأحكام القرآن والمبيِّن لما تضمَّنه من السنة وآي الفرقان',
    authorId: 'qurtubi',
    schools: ['فقهي', 'موسوعي'],
    volumes: 20,
    description:
      'يعتني بأحكام الفقه المستنبطة من الآيات، ويذكر اختلافات المذاهب وأدلتها، مع عناية بالقراءات واللغة.',
    popularity: 9,
    featured: true,
  },
  {
    id: 'baghawi',
    title: 'تفسير البغوي',
    fullTitle: 'معالم التنزيل في تفسير القرآن',
    authorId: 'baghawi',
    schools: ['بالمأثور'],
    volumes: 8,
    description:
      'تفسير وسط معتدل، يغلب عليه التفسير بالمأثور، مع اختصار وحسن ترتيب، وقد لقّب بـ"محيي السنة".',
    popularity: 8,
  },
  {
    id: 'saadi',
    title: 'تفسير السعدي',
    fullTitle: 'تيسير الكريم الرحمن في تفسير كلام المنان',
    authorId: 'saadi',
    schools: ['ميسر', 'معاصر'],
    volumes: 1,
    description:
      'تفسير ميسر بأسلوب سهل، يستخرج الفوائد والحكم من الآيات، ويُعدّ من أفضل التفاسير المختصرة المعاصرة.',
    popularity: 10,
    featured: true,
  },
  {
    id: 'shawkani',
    title: 'تفسير الشوكاني',
    fullTitle: 'فتح القدير الجامع بين فني الرواية والدراية من علم التفسير',
    authorId: 'shawkani',
    schools: ['بالمأثور', 'بالرأي'],
    volumes: 5,
    description:
      'يجمع بين التفسير بالمأثور والتفسير بالرأي، مع عناية بالقراءات واللغة وأقوال السلف.',
    popularity: 8,
  },
  {
    id: 'razi',
    title: 'التفسير الكبير',
    fullTitle: 'مفاتيح الغيب',
    authorId: 'razi',
    schools: ['بالرأي', 'موسوعي', 'بلاغي'],
    volumes: 32,
    description:
      'تفسير موسوعي عقلي، يتوسّع في المسائل الكلامية والفلسفية والبلاغية، ويُعدّ من أكبر كتب التفسير.',
    popularity: 9,
    featured: true,
  },
  {
    id: 'baidawi',
    title: 'تفسير البيضاوي',
    fullTitle: 'أنوار التنزيل وأسرار التأويل',
    authorId: 'baidawi',
    schools: ['بلاغي', 'لغوي'],
    volumes: 5,
    description:
      'مختصر بليغ من تفسير الزمخشري والرازي، يعتني بالنحو والبلاغة والقراءات بعبارة موجزة.',
    popularity: 8,
  },
  {
    id: 'zamakhshari',
    title: 'الكشاف',
    fullTitle: 'الكشاف عن حقائق التنزيل وعيون الأقاويل في وجوه التأويل',
    authorId: 'zamakhshari',
    schools: ['بلاغي', 'لغوي'],
    volumes: 4,
    description:
      'تفسير لغوي بلاغي عظيم، يُبرز جمال نظم القرآن وأسرار بيانه، مع تنبيه على ما خالف فيه أهل السنة.',
    popularity: 8,
    featured: true,
  },
  {
    id: 'jalalayn',
    title: 'تفسير الجلالين',
    fullTitle: 'تفسير الجلالين',
    authorId: 'jalalayn',
    schools: ['ميسر'],
    volumes: 1,
    description:
      'تفسير مختصر بأسلوب موجز جدًا، بدأه المحلي وأتمّه السيوطي، يُستفاد منه لفهم معاني الكلمات بسرعة.',
    popularity: 9,
    featured: true,
  },
  {
    id: 'wasit',
    title: 'التفسير الوسيط',
    fullTitle: 'التفسير الوسيط للقرآن الكريم',
    authorId: 'tantawi',
    schools: ['معاصر', 'ميسر'],
    volumes: 15,
    description:
      'تفسير معاصر معتدل، يجمع بين الأصالة والمعاصرة، بأسلوب علمي يخاطب طالب العلم والقارئ المثقف.',
    popularity: 7,
  },
  {
    id: 'tahrir',
    title: 'التحرير والتنوير',
    fullTitle: 'تحرير المعنى السديد وتنوير العقل الجديد من تفسير الكتاب المجيد',
    authorId: 'ibn-ashur',
    schools: ['بلاغي', 'معاصر', 'موسوعي'],
    volumes: 30,
    description:
      'من أعظم تفاسير العصر، يعتني بالبلاغة والمقاصد القرآنية، ويُبرز جمال النظم وأسرار البيان.',
    popularity: 9,
    featured: true,
  },
]

export const getBookById = (id: string) => BOOKS.find(b => b.id === id)
export const getBooksByAuthor = (authorId: string) => BOOKS.filter(b => b.authorId === authorId)
export const getBooksBySchool = (school: TafseerSchool) =>
  BOOKS.filter(b => b.schools.includes(school))
