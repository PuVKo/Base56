import {
  AlignLeft,
  BadgePercent,
  Banknote,
  Bell,
  BookOpen,
  Calendar,
  Camera,
  Car,
  ClipboardList,
  CheckSquare,
  Clock,
  Compass,
  Cookie,
  Crown,
  Dice5,
  Dumbbell,
  Flame,
  Folder,
  Gem,
  Gift,
  Hash,
  Heart,
  Home,
  KeyRound,
  Image,
  Lamp,
  Leaf,
  MapPin,
  MessageCircle,
  Music,
  NotebookPen,
  Paintbrush,
  PartyPopper,
  PencilRuler,
  Pin,
  Pizza,
  Plane,
  Scissors,
  ShoppingCart,
  Rocket,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Trophy,
  Truck,
  Users,
  Wallet,
  WandSparkles,
  Wrench,
  Link,
  List,
  ListChecks,
  Mail,
  MessageSquare,
  Phone,
  Tag,
  Type,
  User,
} from 'lucide-react';

/** @typedef {{ key: string, label: string, Icon: any }} FieldIconChoice */

/** @type {FieldIconChoice[]} */
export const FIELD_ICON_CHOICES = [
  // базовые (как раньше)
  { key: 'type', label: 'Текст', Icon: AlignLeft },
  { key: 'title', label: 'Заголовок', Icon: Type },
  { key: 'calendar', label: 'Дата', Icon: Calendar },
  { key: 'clock', label: 'Время', Icon: Clock },
  { key: 'hash', label: 'Число', Icon: Hash },
  { key: 'check', label: 'Флажок', Icon: CheckSquare },
  { key: 'list', label: 'Выбор', Icon: List },
  { key: 'list-checks', label: 'Мультивыбор', Icon: ListChecks },
  { key: 'tag', label: 'Тэги', Icon: Tag },
  { key: 'compass', label: 'Источник', Icon: Compass },
  { key: 'message', label: 'Комментарии', Icon: MessageSquare },
  { key: 'phone', label: 'Телефон', Icon: Phone },
  { key: 'mail', label: 'Email', Icon: Mail },
  { key: 'link', label: 'Ссылка', Icon: Link },
  { key: 'user', label: 'Клиент', Icon: User },

  // расширенные (часто нужны для заказов)
  { key: 'users', label: 'Гости / люди', Icon: Users },
  { key: 'home', label: 'Дом / площадка', Icon: Home },
  { key: 'map-pin', label: 'Локация', Icon: MapPin },
  { key: 'pin', label: 'Важно', Icon: Pin },
  { key: 'camera', label: 'Фото', Icon: Camera },
  { key: 'image', label: 'Галерея', Icon: Image },
  { key: 'party', label: 'Праздник', Icon: PartyPopper },
  { key: 'gift', label: 'Подарок', Icon: Gift },
  { key: 'music', label: 'Музыка', Icon: Music },
  { key: 'sparkles', label: 'Эффекты', Icon: Sparkles },
  { key: 'flame', label: 'Хит', Icon: Flame },
  { key: 'star', label: 'Избранное', Icon: Star },
  { key: 'heart', label: 'Любимое', Icon: Heart },
  { key: 'trophy', label: 'Награда', Icon: Trophy },
  { key: 'crown', label: 'VIP', Icon: Crown },
  { key: 'shield', label: 'Проверено', Icon: ShieldCheck },
  { key: 'ticket', label: 'Билет', Icon: Ticket },
  { key: 'clipboard', label: 'Список', Icon: ClipboardList },
  { key: 'chat', label: 'Чат', Icon: MessageCircle },
  { key: 'tools', label: 'Инвентарь', Icon: PencilRuler },

  // финансы / логистика
  { key: 'wallet', label: 'Оплата', Icon: Wallet },
  { key: 'banknote', label: 'Деньги', Icon: Banknote },
  { key: 'percent', label: 'Скидка', Icon: BadgePercent },

  // транспорт / перемещение
  { key: 'car', label: 'Машина', Icon: Car },
  { key: 'truck', label: 'Доставка', Icon: Truck },
  { key: 'plane', label: 'Поездка', Icon: Plane },
  { key: 'rocket', label: 'Запуск', Icon: Rocket },

  // еда / активность / случайное
  { key: 'pizza', label: 'Еда', Icon: Pizza },
  { key: 'dumbbell', label: 'Активность', Icon: Dumbbell },
  { key: 'dice', label: 'Игра', Icon: Dice5 },

  // ещё (универсальные)
  { key: 'bell', label: 'Уведомление', Icon: Bell },
  { key: 'book', label: 'Книга', Icon: BookOpen },
  { key: 'folder', label: 'Папка', Icon: Folder },
  { key: 'cart', label: 'Покупки', Icon: ShoppingCart },
  { key: 'scissors', label: 'Ножницы', Icon: Scissors },
  { key: 'paint', label: 'Креатив', Icon: Paintbrush },
  { key: 'wand', label: 'Магия', Icon: WandSparkles },
  { key: 'wrench', label: 'Инструменты', Icon: Wrench },
  { key: 'gem', label: 'Ценность', Icon: Gem },
  { key: 'leaf', label: 'Природа', Icon: Leaf },
  { key: 'lamp', label: 'Идея', Icon: Lamp },
  { key: 'key', label: 'Ключ', Icon: KeyRound },
  { key: 'cookie', label: 'Угощение', Icon: Cookie },
  { key: 'note', label: 'Заметка', Icon: NotebookPen },
];

/** @type {Record<string, any>} */
const ICON_MAP = Object.fromEntries(FIELD_ICON_CHOICES.map((x) => [x.key, x.Icon]));

/**
 * @param {string | null | undefined} iconKey
 */
export function iconComponentByKey(iconKey) {
  if (!iconKey || typeof iconKey !== 'string') return null;
  return ICON_MAP[iconKey] || null;
}

